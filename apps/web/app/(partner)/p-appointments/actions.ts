"use server";

// 二次店ポータル：アポイントの登録・編集。
//
// フォーム 2 種で保存先が違う。
//   初訪アポ … Customer 1 行 + Appointment 1 行（既存モデルをそのまま使う）
//   訪問アポ … DealerVisitAppointment 1 行（顧客も日時も無いフォームなので専用テーブル）
//
// どちらも所属系（wholesalerId / relationshipId / 登録者）は認証情報から設定し、
// フォームからは受け取らない。担当者は自社の販売員だけを指定できる。
//
// 登録後のアポ区分変更は用意しない。別フォームの項目が食い違い、片方の必須項目が
// 埋まらない行ができるため（画面にも導線を出さない）。

import {
  PartnerFirstVisitCreateSchema,
  PartnerFirstVisitUpdateSchema,
  PartnerVisitCreateSchema,
  PartnerVisitUpdateSchema,
  toFaceToFaceBoolean,
  type PartnerFirstVisitCreateInput,
  type PartnerFirstVisitUpdateInput,
  type PartnerVisitCreateInput,
  type PartnerVisitUpdateInput,
} from "@solar/contracts";
import { revalidatePath } from "next/cache";

import { NotFoundError, ValidationError } from "@/lib/errors";
import { labels } from "@/lib/i18n/labels";
import { assertCheckedInForEvent } from "@/lib/partner/attendance";
import { requirePartnerContext, resolveRelationship } from "@/lib/partner/context";
import { resolveOptionalPartnerEvent } from "@/lib/partner/events";
import { customerScope, relationshipScope } from "@/lib/partner/scope";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { PartnerContext } from "@/lib/partner/context";
import type { TxClient } from "@solar/db";

const LIST_PATH = "/p-appointments";

/**
 * 指定された販売員が本当に自社の販売員かを確認する。
 *
 * クライアントから来た ID をそのまま書くと他社の販売員を自社の担当として
 * 記録できてしまうため、必ず relationshipId 込みで引き直す。
 */
async function assertOwnSalespeople(
  tx: TxClient,
  relationshipIds: string[],
  ids: (string | undefined)[],
): Promise<void> {
  const targets = ids.filter((v): v is string => Boolean(v));
  if (targets.length === 0) return;
  const found = await tx.salesperson.findMany({
    where: { id: { in: targets }, relationshipId: { in: relationshipIds } },
    select: { id: true },
  });
  if (found.length !== new Set(targets).size) {
    throw new ValidationError("自社に登録されていない販売員が指定されています");
  }
}

/**
 * クローズ会社が「参照を許された Relationship」かを確認する。
 *
 * 画面のセレクトは読める範囲しか出さないが、リクエストを直接送られたときのために
 * サーバー側でも引き直す。RLS 下で引けない ID はここで弾かれる。
 */
async function assertSelectableCloseCompany(tx: TxClient, id: string): Promise<void> {
  const found = await tx.relationship.findFirst({
    where: { id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!found) {
    throw new ValidationError("選択できないクローズ会社が指定されています");
  }
}

/**
 * 獲得チャネル（Customer.channel・登録時に確定する不変値）。
 *
 * 販売チャネルと語彙が一致する値だけを写し、それ以外は OTHER にする。
 * 意味の違う値へ無理に読み替えない。
 */
function acquisitionChannelFor(salesChannel: string): "EVENT" | "REFERRAL" | "OTHER" {
  if (salesChannel === "EVENT") return "EVENT";
  if (salesChannel === "REFERRAL") return "REFERRAL";
  return "OTHER";
}

/** 催事情報の保存値。条件付き項目は対象チャネル以外では保存しない。 */
function venueColumns(parsed: {
  eventDate: Date;
  venuePlace: string;
  venueChain?: string;
  boothArea: string;
  boothAreaNote?: string;
}) {
  return {
    sourceEventDate: parsed.eventDate,
    sourceVenuePlace: parsed.venuePlace,
    sourceVenueChain: (parsed.venueChain ?? null) as never,
    sourceBoothArea: parsed.boothArea as never,
    sourceBoothAreaNote: parsed.boothArea === "OTHER" ? (parsed.boothAreaNote ?? null) : null,
  };
}

// ---------------------------------------------------------------------------
// 初訪アポ
// ---------------------------------------------------------------------------

export async function createPartnerFirstVisitAction(
  input: PartnerFirstVisitCreateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_appointment.write");
  const parsed = PartnerFirstVisitCreateSchema.parse(input);

  return withTenant(partner.ctx, async (tx) => {
    await assertOwnSalespeople(tx, partner.relationshipIds, [
      parsed.tossUpSalespersonId,
      parsed.closingSalespersonId,
    ]);
    await assertSelectableCloseCompany(tx, parsed.closingRelationshipId);

    // 催事から登録された場合は、依頼元代理店をその催事から決める。催事は id で結び、
    // 自社担当のものだけ受け付ける（店舗名の一致では結ばない）。
    const event = await resolveOptionalPartnerEvent(tx, partner, parsed.eventId, parsed.eventDayId);
    // 催事からの登録は、その日に出勤した本人だけが行える（URL 直打ち・Server Action への
    // 直接送信でも同じ関数で止める）。催事を指定しない登録にはこの条件を広げない。
    if (event) {
      await assertCheckedInForEvent(tx, partner, event.eventId, event.eventDayId ?? null);
    }
    // 催事外からの登録は、取引先が 1 社なら自動、複数社ならフォームの選択を検証して使う。
    const origin = event
      ? resolveRelationship(partner, event.relationshipId)
      : resolveRelationship(partner, parsed.relationshipId);

    const customer = await tx.customer.create({
      data: {
        wholesalerId: origin.wholesalerId,
        // 登録元・所有。パートナー会社が自社データとして引けるキー。
        ownerRelationshipId: origin.id,
        registeredByRelationshipId: origin.id,
        // 実際に操作したログイン利用者。接客した担当者（下の salesperson 列）とは別に残す。
        registeredByUserId: partner.userId,
        registeredByOrgType: "DEALER",
        // クローズ会社はフォームで選択された会社（自社とは限らない）。
        closingRelationshipId: parsed.closingRelationshipId,
        tossUpRelationshipId: origin.id,
        // 催事との紐付け（id）。催事外からの登録では null。
        sourceEventId: event?.eventId ?? null,

        name: parsed.name,
        kana: parsed.kana,
        // Customer.phone は NOT NULL。携帯番号が必須なのでそれを代表値にする。
        phone: parsed.mobilePhone,
        landlinePhone: parsed.landlinePhone ?? null,
        mobilePhone: parsed.mobilePhone,
        postalCode: parsed.postalCode,
        prefecture: parsed.prefecture,
        addressLine: parsed.cityAddress,
        note: parsed.note ?? null,

        salesChannel: parsed.salesChannel,
        faceToFace: toFaceToFaceBoolean(parsed.faceToFace),
        maekakuPreferredAt: parsed.maekakuPreferredAt ?? null,
        maekakuOperator: parsed.maekakuOperator,
        tossUpSalespersonId: parsed.tossUpSalespersonId ?? null,
        closingSalespersonId: parsed.closingSalespersonId,
        ...venueColumns(parsed),

        channel: acquisitionChannelFor(parsed.salesChannel),
      },
      select: { id: true },
    });

    // 初回訪問アポ日時は必須なので必ず 1 件作る。
    await tx.appointment.create({
      data: {
        customerId: customer.id,
        scheduledAt: parsed.firstVisitAt,
        // フォーム区分。既存 appointmentType（内容・段階の自由記述）とは別列。
        partnerKind: "FIRST_VISIT",
        // アポを登録した操作者。アポ獲得者（Customer.tossUpSalespersonId）とは別概念。
        acquiredByUserId: partner.userId,
        acquiredOrgType: "DEALER",
        acquiredRelationshipId: origin.id,
        eventId: event?.eventId ?? null,
      },
    });

    revalidatePath(LIST_PATH);
    return { id: customer.id };
  });
}

export async function updatePartnerFirstVisitAction(
  input: PartnerFirstVisitUpdateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_appointment.write");
  const parsed = PartnerFirstVisitUpdateSchema.parse(input);

  return withTenant(partner.ctx, async (tx) => {
    const existing = await tx.customer.findFirst({
      // 自社が取り扱う顧客であること。本人登録分に限らない（会社全件）。
      where: { id: parsed.id, AND: [customerScope(partner)] },
      select: {
        id: true,
        // 依頼元は登録時に決まっている。更新で付け替えない。
        registeredByRelationshipId: true,
        appointments: { orderBy: { createdAt: "asc" }, take: 1, select: { id: true } },
      },
    });
    if (!existing) throw new NotFoundError(labels.partner.errors.notFound);

    await assertOwnSalespeople(tx, partner.relationshipIds, [
      parsed.tossUpSalespersonId,
      parsed.closingSalespersonId,
    ]);
    await assertSelectableCloseCompany(tx, parsed.closingRelationshipId);

    await tx.customer.update({
      where: { id: existing.id },
      data: {
        name: parsed.name,
        kana: parsed.kana,
        phone: parsed.mobilePhone,
        landlinePhone: parsed.landlinePhone ?? null,
        mobilePhone: parsed.mobilePhone,
        postalCode: parsed.postalCode,
        prefecture: parsed.prefecture,
        addressLine: parsed.cityAddress,
        note: parsed.note ?? null,
        salesChannel: parsed.salesChannel,
        faceToFace: toFaceToFaceBoolean(parsed.faceToFace),
        maekakuPreferredAt: parsed.maekakuPreferredAt ?? null,
        maekakuOperator: parsed.maekakuOperator,
        tossUpSalespersonId: parsed.tossUpSalespersonId ?? null,
        closingSalespersonId: parsed.closingSalespersonId,
        closingRelationshipId: parsed.closingRelationshipId,
        ...venueColumns(parsed),
      },
    });

    const apptId = existing.appointments[0]?.id;
    if (apptId) {
      await tx.appointment.update({
        where: { id: apptId },
        data: { scheduledAt: parsed.firstVisitAt, partnerKind: "FIRST_VISIT" },
      });
    } else {
      await tx.appointment.create({
        data: {
          customerId: existing.id,
          scheduledAt: parsed.firstVisitAt,
          partnerKind: "FIRST_VISIT",
          acquiredByUserId: partner.userId,
          acquiredOrgType: "DEALER",
          // 顧客の登録時に決まった依頼元を引き継ぐ（担当者の付け替えで変えない）。
          acquiredRelationshipId: existing.registeredByRelationshipId,
        },
      });
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${existing.id}`);
    return { id: existing.id };
  });
}

// ---------------------------------------------------------------------------
// 訪問アポ
// ---------------------------------------------------------------------------

/**
 * 訪問アポ報告の対象顧客を確かめ、紐付ける先を返す。
 *
 * 顧客は自社が取り扱っている顧客であること（URL・送信値の書き換え対策）。
 * アポは「その顧客の初回訪問アポ」を指す。無ければ null のままにして作らない
 * （報告のために架空のアポ日時を作らない）。
 */
async function resolveVisitTarget(
  tx: TxClient,
  partner: PartnerContext,
  customerId: string | undefined,
): Promise<{ customerId: string | null; appointmentId: string | null }> {
  if (!customerId) return { customerId: null, appointmentId: null };
  const customer = await tx.customer.findFirst({
    where: { id: customerId, AND: [customerScope(partner)] },
    select: {
      id: true,
      appointments: {
        where: { partnerKind: "FIRST_VISIT" },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!customer) throw new NotFoundError(labels.partner.errors.notFound);
  return { customerId: customer.id, appointmentId: customer.appointments[0]?.id ?? null };
}

export async function createPartnerVisitAction(
  input: PartnerVisitCreateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_visit_appointment.write");
  const parsed = PartnerVisitCreateSchema.parse(input);
  // 依頼元代理店は候補の中から確定させる（送信値をそのまま書き込み先にしない）。
  const origin = resolveRelationship(partner, parsed.relationshipId);

  return withTenant(partner.ctx, async (tx) => {
    await assertOwnSalespeople(tx, partner.relationshipIds, [parsed.salespersonId]);
    const target = await resolveVisitTarget(tx, partner, parsed.customerId);

    const row = await tx.dealerVisitAppointment.create({
      data: {
        wholesalerId: origin.wholesalerId,
        relationshipId: origin.id,
        createdByUserId: partner.userId,
        customerId: target.customerId,
        appointmentId: target.appointmentId,
        tossDept: parsed.tossDept,
        maekakuOperator: parsed.maekakuOperator,
        closeDept: parsed.closeDept,
        salespersonId: parsed.salespersonId,
        salesChannel: parsed.salesChannel,
      },
      select: { id: true },
    });

    revalidatePath(LIST_PATH);
    return { id: row.id };
  });
}

export async function updatePartnerVisitAction(
  input: PartnerVisitUpdateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_visit_appointment.write");
  const parsed = PartnerVisitUpdateSchema.parse(input);

  return withTenant(partner.ctx, async (tx) => {
    const existing = await tx.dealerVisitAppointment.findFirst({
      where: { id: parsed.id, ...relationshipScope(partner) },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError(labels.partner.errors.notFound);

    await assertOwnSalespeople(tx, partner.relationshipIds, [parsed.salespersonId]);
    const target = await resolveVisitTarget(tx, partner, parsed.customerId);

    await tx.dealerVisitAppointment.update({
      where: { id: existing.id },
      data: {
        customerId: target.customerId,
        appointmentId: target.appointmentId,
        tossDept: parsed.tossDept,
        maekakuOperator: parsed.maekakuOperator,
        closeDept: parsed.closeDept,
        salespersonId: parsed.salespersonId,
        salesChannel: parsed.salesChannel,
      },
    });

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/visit/${existing.id}`);
    return { id: existing.id };
  });
}
