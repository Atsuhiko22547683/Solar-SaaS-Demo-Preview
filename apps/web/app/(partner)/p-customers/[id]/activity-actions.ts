"use server";

// 顧客の商談履歴（接点）の追加・修正と、業務情報の更新。
//
// 引継ぎ・共同対応:
//   自社（所属パートナー会社）が取り扱う顧客なら、登録した本人以外も履歴を読み、
//   追記・修正できる。誰が作って誰が直したかは createdByUserId / updatedByUserId に残る。
//
// 商談回数:
//   接点 1 回 = CustomerActivity 1 行。既存行の修正では行が増えないので回数は変わらない。
//   接点のたびに新しい顧客や契約を作ったりはしない。
//
// 契約済への変更:
//   ここで扱うのは Customer の業務ステータスだけ。金額を伴う正式な Contract や
//   売上・粗利・インセンティブの確定には結び付けない（成約報告は別の提出物）。

import {
  PartnerActivityCreateSchema,
  PartnerActivityUpdateSchema,
  PartnerNegotiationUpdateSchema,
  type PartnerActivityCreateInput,
  type PartnerActivityUpdateInput,
  type PartnerNegotiationUpdateInput,
} from "@solar/contracts";
import { revalidatePath } from "next/cache";

import { NotFoundError, ValidationError } from "@/lib/errors";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext } from "@/lib/partner/context";
import { resolveOptionalPartnerEvent } from "@/lib/partner/events";
import { customerScope } from "@/lib/partner/scope";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { PartnerContext } from "@/lib/partner/context";
import type { TxClient } from "@solar/db";

const BASE = "/p-customers";

/** 自社が取り扱う顧客であることを確認する（id だけで書き込まない）。 */
async function assertOwnCustomer(
  tx: TxClient,
  partner: PartnerContext,
  customerId: string,
): Promise<{ id: string }> {
  const found = await tx.customer.findFirst({
    where: { id: customerId, AND: [customerScope(partner)] },
    select: { id: true },
  });
  if (!found) throw new NotFoundError(labels.partner.errors.notFound);
  return found;
}

/** 担当者は自社の利用者だけ（他社の userId を担当に記録させない）。 */
async function assertOwnUser(
  tx: TxClient,
  partner: PartnerContext,
  userId: string | undefined,
): Promise<string | null> {
  if (!userId) return null;
  const found = await tx.user.findFirst({
    where: { id: userId, tenantId: partner.tenantId },
    select: { id: true },
  });
  if (!found) throw new ValidationError("自社に登録されていない担当者が指定されています");
  return found.id;
}

export async function createPartnerActivityAction(
  input: PartnerActivityCreateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_deal.write");
  const parsed = PartnerActivityCreateSchema.parse(input);

  const created = await withTenant(partner.ctx, async (tx) => {
    const customer = await assertOwnCustomer(tx, partner, parsed.customerId);
    const assigneeUserId = await assertOwnUser(tx, partner, parsed.assigneeUserId);
    // 催事は自社担当のものだけ。範囲外なら紐付けずに記録する（架空の関連先を作らない）。
    const event = await resolveOptionalPartnerEvent(tx, partner, parsed.eventId);

    return tx.customerActivity.create({
      data: {
        customerId: customer.id,
        occurredAt: parsed.occurredAt,
        category: parsed.category,
        detail: parsed.detail,
        amount: parsed.category === "quote" ? (parsed.amount ?? null) : null,
        assigneeUserId,
        eventId: event?.eventId ?? null,
        // 実際に操作した利用者。接客した担当者（assigneeUserId）とは別に残す。
        createdByUserId: partner.userId,
      },
      select: { id: true },
    });
  });

  revalidatePath(`${BASE}/${parsed.customerId}`);
  return created;
}

/** 誤記の修正。行は増やさないので商談回数は変わらない。 */
export async function updatePartnerActivityAction(
  input: PartnerActivityUpdateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_deal.write");
  const parsed = PartnerActivityUpdateSchema.parse(input);

  const updated = await withTenant(partner.ctx, async (tx) => {
    const customer = await assertOwnCustomer(tx, partner, parsed.customerId);
    const existing = await tx.customerActivity.findFirst({
      where: { id: parsed.id, customerId: customer.id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError(labels.partner.errors.notFound);

    const assigneeUserId = await assertOwnUser(tx, partner, parsed.assigneeUserId);
    const event = await resolveOptionalPartnerEvent(tx, partner, parsed.eventId);

    return tx.customerActivity.update({
      where: { id: existing.id },
      data: {
        occurredAt: parsed.occurredAt,
        category: parsed.category,
        detail: parsed.detail,
        amount: parsed.category === "quote" ? (parsed.amount ?? null) : null,
        assigneeUserId,
        eventId: event?.eventId ?? null,
        // 作成者は書き換えない。直した人は別の列に残す。
        updatedByUserId: partner.userId,
      },
      select: { id: true },
    });
  });

  revalidatePath(`${BASE}/${parsed.customerId}`);
  return updated;
}

/**
 * 商談ステータス・マエカクステータス・次回アポ・次回アクション・担当者の更新。
 *
 * 「契約済」への変更はここで行うが、これは業務上の契約済の判定であって、
 * 成約報告の提出とは別に扱う。架空の金額で Contract を作ったりはしない。
 */
export async function updatePartnerNegotiationAction(
  input: PartnerNegotiationUpdateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_deal.write");
  const parsed = PartnerNegotiationUpdateSchema.parse(input);

  const updated = await withTenant(partner.ctx, async (tx) => {
    const customer = await assertOwnCustomer(tx, partner, parsed.customerId);
    const assigneeUserId = await assertOwnUser(tx, partner, parsed.assigneeUserId);

    return tx.customer.update({
      where: { id: customer.id },
      data: {
        contractStatus: parsed.dealStatus,
        ...(parsed.maekakuStatus ? { maekakuStatus: parsed.maekakuStatus } : {}),
        nextAppointmentAt: parsed.nextAppointmentAt ?? null,
        nextAction: parsed.nextAction ?? null,
        ...(assigneeUserId ? { nextAppointmentAssigneeUserId: assigneeUserId } : {}),
        // 顧客のライフサイクル側のステータスも合わせる。契約済は CONTRACTED。
        ...(parsed.dealStatus === "contracted" ? { status: "CONTRACTED" as const } : {}),
        ...(parsed.dealStatus === "lost" ? { status: "LOST" as const } : {}),
      },
      select: { id: true },
    });
  });

  revalidatePath(`${BASE}/${parsed.customerId}`);
  return updated;
}
