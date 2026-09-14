"use server";

// 二次店ポータル：アポイントの登録・編集。
//
// 1 件の登録で Customer 1 行 + Appointment 1 行を作る（既存モデルをそのまま使い、
// 二次店用の重複テーブルは作らない）。代理店側の顧客一覧・アポ一覧から同じ行が
// そのまま見える。
//
// 所属系（wholesalerId / registeredByRelationshipId / registeredByUserId /
// closingRelationshipId / acquiredRelationshipId）はすべて認証情報から設定し、
// フォームからは受け取らない。担当者は自社の販売員だけを指定できる。

import {
  PartnerAppointmentCreateSchema,
  PartnerAppointmentUpdateSchema,
  toFaceToFaceBoolean,
  type PartnerAppointmentCreateInput,
  type PartnerAppointmentUpdateInput,
} from "@solar/contracts";
import { revalidatePath } from "next/cache";

import { NotFoundError, ValidationError } from "@/lib/errors";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext } from "@/lib/partner/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { TxClient } from "@solar/db";

const LIST_PATH = "/p-appointments";

/**
 * 催事情報の保存値。
 *
 * イベントを選んだ場合はイベント側が正なので source* には書かない（重複保存しない）。
 * 未選択の場合だけ入力値を入れる。ブース場所の自由記述は「その他」のときだけ残す。
 */
function venueColumns(parsed: {
  sourceEventId?: string;
  eventDate?: Date;
  venuePlace?: string;
  venueChain?: string;
  boothArea?: string;
  boothAreaNote?: string;
}) {
  if (parsed.sourceEventId) {
    return {
      sourceEventDate: null,
      sourceVenuePlace: null,
      sourceVenueChain: null,
      sourceBoothArea: null,
      sourceBoothAreaNote: null,
    };
  }
  return {
    sourceEventDate: parsed.eventDate ?? null,
    sourceVenuePlace: parsed.venuePlace ?? null,
    sourceVenueChain: (parsed.venueChain ?? null) as never,
    sourceBoothArea: (parsed.boothArea ?? null) as never,
    sourceBoothAreaNote: parsed.boothArea === "OTHER" ? (parsed.boothAreaNote ?? null) : null,
  };
}

/**
 * 指定された販売員が本当に自社の販売員かを確認する。
 *
 * クライアントから来た ID をそのまま Customer へ書くと、他社の販売員を
 * 自社の担当として記録できてしまうため、必ず relationshipId 込みで引き直す。
 */
async function assertOwnSalespeople(
  tx: TxClient,
  relationshipId: string,
  ids: (string | undefined)[],
): Promise<void> {
  const targets = ids.filter((v): v is string => Boolean(v));
  if (targets.length === 0) return;
  const found = await tx.salesperson.findMany({
    where: { id: { in: targets }, relationshipId },
    select: { id: true },
  });
  if (found.length !== new Set(targets).size) {
    throw new ValidationError("自社に登録されていない販売員が指定されています");
  }
}

/** 選択された催事が自社の担当イベントかを確認する。 */
async function assertOwnEvent(
  tx: TxClient,
  relationshipId: string,
  eventId: string | undefined,
): Promise<void> {
  if (!eventId) return;
  const assigned = await tx.eventDealer.findFirst({
    where: { eventId, relationshipId },
    select: { eventId: true },
  });
  if (!assigned) {
    throw new ValidationError("担当していない催事は指定できません");
  }
}

export async function createPartnerAppointmentAction(
  input: PartnerAppointmentCreateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_appointment.write");
  const parsed = PartnerAppointmentCreateSchema.parse(input);

  return withTenant(partner.ctx, async (tx) => {
    await assertOwnSalespeople(tx, partner.relationshipId, [
      parsed.tossUpSalespersonId,
      parsed.closingSalespersonId,
    ]);
    await assertOwnEvent(tx, partner.relationshipId, parsed.sourceEventId);

    // Customer.phone は NOT NULL。入力された方を代表値にする
    // （スキーマ側でどちらか一方必須を検証済み）。
    const primaryPhone = parsed.mobilePhone ?? parsed.landlinePhone!;

    const customer = await tx.customer.create({
      data: {
        wholesalerId: partner.wholesalerId,
        // 登録元・所有。二次店が自社データとして引けるキー。
        ownerRelationshipId: partner.relationshipId,
        registeredByRelationshipId: partner.relationshipId,
        registeredByUserId: partner.userId,
        registeredByOrgType: "DEALER",
        // クローズ会社は提出した二次店（認証情報から自動設定）。
        closingRelationshipId: partner.relationshipId,
        tossUpRelationshipId: partner.relationshipId,

        name: parsed.name,
        kana: parsed.kana ?? null,
        phone: primaryPhone,
        landlinePhone: parsed.landlinePhone ?? null,
        mobilePhone: parsed.mobilePhone ?? null,
        postalCode: parsed.postalCode ?? null,
        prefecture: parsed.prefecture ?? null,
        addressLine: parsed.cityAddress ?? null,
        note: parsed.note ?? null,

        tossDept: parsed.tossDept ?? null,
        salesChannel: parsed.salesChannel ?? null,
        faceToFace: toFaceToFaceBoolean(parsed.faceToFace),
        maekakuPreferredAt: parsed.maekakuPreferredAt ?? null,
        maekakuOperator: parsed.maekakuOperator ?? null,
        tossUpSalespersonId: parsed.tossUpSalespersonId ?? null,
        closingSalespersonId: parsed.closingSalespersonId ?? null,
        sourceEventId: parsed.sourceEventId ?? null,
        ...venueColumns(parsed),

        // 獲得チャネルは登録時に確定する不変値。催事経由なら EVENT。
        channel: parsed.sourceEventId ? "EVENT" : "OTHER",
      },
      select: { id: true },
    });

    // 初回訪問アポ。日時が入力されたときだけ作る（架空の予定を作らない）。
    if (parsed.firstVisitAt) {
      await tx.appointment.create({
        data: {
          customerId: customer.id,
          eventId: parsed.sourceEventId ?? null,
          scheduledAt: parsed.firstVisitAt,
          // location は「アポイントの場所」。催事場所とは別概念なので流用しない
          // （催事場所は Customer.sourceVenuePlace / イベント側が持つ）。
          acquiredByUserId: partner.userId,
          acquiredOrgType: "DEALER",
          acquiredRelationshipId: partner.relationshipId,
        },
      });
    }

    revalidatePath(LIST_PATH);
    return { id: customer.id };
  });
}

export async function updatePartnerAppointmentAction(
  input: PartnerAppointmentUpdateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_appointment.write");
  const parsed = PartnerAppointmentUpdateSchema.parse(input);

  return withTenant(partner.ctx, async (tx) => {
    // 自社が登録した顧客かを先に確認する。
    const existing = await tx.customer.findFirst({
      where: { id: parsed.id, registeredByRelationshipId: partner.relationshipId },
      select: {
        id: true,
        appointments: { orderBy: { createdAt: "asc" }, take: 1, select: { id: true } },
      },
    });
    if (!existing) throw new NotFoundError(labels.partner.errors.notFound);

    await assertOwnSalespeople(tx, partner.relationshipId, [
      parsed.tossUpSalespersonId,
      parsed.closingSalespersonId,
    ]);
    await assertOwnEvent(tx, partner.relationshipId, parsed.sourceEventId);

    const primaryPhone = parsed.mobilePhone ?? parsed.landlinePhone!;

    await tx.customer.update({
      where: { id: existing.id },
      data: {
        name: parsed.name,
        kana: parsed.kana ?? null,
        phone: primaryPhone,
        landlinePhone: parsed.landlinePhone ?? null,
        mobilePhone: parsed.mobilePhone ?? null,
        postalCode: parsed.postalCode ?? null,
        prefecture: parsed.prefecture ?? null,
        addressLine: parsed.cityAddress ?? null,
        note: parsed.note ?? null,
        tossDept: parsed.tossDept ?? null,
        salesChannel: parsed.salesChannel ?? null,
        faceToFace: toFaceToFaceBoolean(parsed.faceToFace),
        maekakuPreferredAt: parsed.maekakuPreferredAt ?? null,
        maekakuOperator: parsed.maekakuOperator ?? null,
        tossUpSalespersonId: parsed.tossUpSalespersonId ?? null,
        closingSalespersonId: parsed.closingSalespersonId ?? null,
        sourceEventId: parsed.sourceEventId ?? null,
        ...venueColumns(parsed),
      },
    });

    const apptId = existing.appointments[0]?.id;
    if (parsed.firstVisitAt) {
      if (apptId) {
        await tx.appointment.update({
          where: { id: apptId },
          data: {
            scheduledAt: parsed.firstVisitAt,
            eventId: parsed.sourceEventId ?? null,
          },
        });
      } else {
        await tx.appointment.create({
          data: {
            customerId: existing.id,
            eventId: parsed.sourceEventId ?? null,
            scheduledAt: parsed.firstVisitAt,
            acquiredByUserId: partner.userId,
            acquiredOrgType: "DEALER",
            acquiredRelationshipId: partner.relationshipId,
          },
        });
      }
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${existing.id}`);
    return { id: existing.id };
  });
}
