"use server";

// 二次店ポータル：顧客・商談の更新。
//
// このファイルには 2 系統が入っている。
//   - 商談情報の編集（スタッフ本人が担当の商談だけ）… updateMyDealAction
//   - 自社顧客の編集・削除（二次店管理者だけ）      … updatePartnerCustomer/DeleteAction
// どちらも対象範囲は customerScope（data.ts）に合わせる。
//
// 受け付けるのは PartnerDealUpdateSchema の項目だけ（.strict()）。顧客の基本情報・
// 担当者・所属・粗利見込みは、リクエストに載せても Zod で落ちるので更新されない。
//
// ステータス変更は既存の遷移規則（DEAL_ALLOWED_TRANSITIONS）と二次店スコープ
// （Relationship.defaultScope: APPOINTMENT_ONLY / FIRST_VISIT / FULL_CLOSING）に従う。
// 代理店側 deals/actions.ts と同じ判定で、契約・売上・インセンティブの自動計算は
// ここでは一切起こさない（成約報告とも独立）。

import {
  PartnerCustomerDeleteSchema,
  PartnerCustomerUpdateSchema,
  PartnerDealUpdateSchema,
  canDealerCloseDeal,
  dealStatusToScopeAction,
  isDealStatusTransitionValid,
  type DealerScope,
  type PartnerCustomerDeleteInput,
  type PartnerCustomerUpdateInput,
  type PartnerDealUpdateInput,
} from "@solar/contracts";
import { rawPrisma } from "@solar/db";
import { revalidatePath } from "next/cache";

import {
  ForbiddenError,
  InvalidStateTransitionError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext } from "@/lib/partner/context";
import { salespersonScope } from "@/lib/partner/scope";
import { withTenant } from "@/lib/tenancy/with-tenant";

import { customerScope } from "./data";

const LIST_PATH = "/p-customers";

export async function updateMyDealAction(input: PartnerDealUpdateInput): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_deal.write");
  const parsed = PartnerDealUpdateSchema.parse(input);

  return withTenant(partner.ctx, async (tx) => {
    // 自社（所属パートナー会社）が保有する商談を対象にする。担当者以外も更新できる
    // （引継ぎ・共同対応）。他社の商談はここで弾かれる。
    const existing = await tx.deal.findFirst({
      where: { id: parsed.id, ownerRelationshipId: { in: partner.relationshipIds } },
      select: { id: true, status: true, customerId: true, ownerRelationshipId: true },
    });
    if (!existing) throw new NotFoundError(labels.partner.errors.notFound);

    // 取引範囲はその商談の依頼元代理店との取り決めに従う。APPOINTMENT_ONLY は
    // 商談情報そのものを触れない。
    const relationship = await tx.relationship.findFirst({
      where: { id: existing.ownerRelationshipId ?? "" },
      select: { defaultScope: true },
    });
    const scope = (relationship?.defaultScope ?? "FULL_CLOSING") as DealerScope;
    if (!canDealerCloseDeal(scope, "visit")) {
      throw new ForbiddenError("このスコープでは商談の更新はできません", { scope });
    }

    if (parsed.status !== undefined && parsed.status !== existing.status) {
      if (!isDealStatusTransitionValid(existing.status, parsed.status)) {
        throw new InvalidStateTransitionError(
          `${existing.status} から ${parsed.status} への遷移はできません`,
          { from: existing.status, to: parsed.status },
        );
      }
      const required = dealStatusToScopeAction(parsed.status);
      if (required !== null && !canDealerCloseDeal(scope, required)) {
        throw new ForbiddenError(
          `このスコープではこのステータス変更 (${parsed.status}) はできません`,
          { scope, requiredAction: required, to: parsed.status },
        );
      }
    }

    await tx.deal.update({
      where: { id: existing.id },
      data: {
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        proposedProduct: parsed.proposedProduct ?? null,
        proposedAmount: parsed.proposedAmount ?? null,
        expectedContractDate: parsed.expectedContractDate
          ? new Date(parsed.expectedContractDate)
          : null,
        lostReason: parsed.lostReason ?? null,
        nextAction: parsed.nextAction ?? null,
        note: parsed.note ?? null,
      },
    });

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${existing.customerId}`);
    return { id: existing.id };
  });
}

/**
 * 顧客の基本情報の更新（二次店管理者のみ）。
 *
 * 受け付けるのは PartnerCustomerUpdateSchema の項目だけ（`.strict()`）。
 * 契約・施工・補助金・電気契約など代理店側の業務項目は、送っても検証で落ちる。
 *
 * 個人情報が伏せられている設定（piiMaskingMode !== FULL）では編集できない。
 * 伏せた値をそのまま保存すると元の情報が失われるため、画面でも入口を出さない。
 */
export async function updatePartnerCustomerAction(
  input: PartnerCustomerUpdateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_customer.write");
  const parsed = PartnerCustomerUpdateSchema.parse(input);

  // 取引先が複数あるときは最も厳しい水準に倒す（マスクされた値で実データを上書きしない）。
  const settingsRows = await rawPrisma.wholesalerSettings.findMany({
    where: { wholesalerId: { in: partner.relationships.map((r) => r.wholesalerId) } },
    select: { piiMaskingMode: true },
  });
  const allFull =
    settingsRows.length === partner.relationships.length &&
    settingsRows.every((r) => r.piiMaskingMode === "FULL");
  if (!allFull) {
    throw new ForbiddenError(labels.partner.errors.forbidden, { reason: "PII_MASKED" });
  }

  return withTenant(partner.ctx, async (tx) => {
    // 自社の顧客であることを先に確認する。クライアントから来た id を直接 update に渡さない。
    const existing = await tx.customer.findFirst({
      where: { id: parsed.id, ...customerScope(partner) },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError(labels.partner.errors.notFound);

    // 担当販売員は自社のものだけ。他社の販売員 id を送られても通さない。
    const ids = [parsed.tossUpSalespersonId, parsed.closingSalespersonId].filter(
      (v): v is string => typeof v === "string",
    );
    if (ids.length > 0) {
      const found = await tx.salesperson.findMany({
        where: { id: { in: ids }, ...salespersonScope(partner) },
        select: { id: true },
      });
      if (found.length !== new Set(ids).size) {
        throw new NotFoundError(labels.partner.errors.notFound);
      }
    }

    await tx.customer.update({
      where: { id: existing.id },
      data: {
        name: parsed.name,
        kana: parsed.kana ?? null,
        phone: parsed.phone,
        landlinePhone: parsed.landlinePhone ?? null,
        mobilePhone: parsed.mobilePhone ?? null,
        postalCode: parsed.postalCode ?? null,
        prefecture: parsed.prefecture ?? null,
        city: parsed.city ?? null,
        addressLine: parsed.addressLine ?? null,
        status: parsed.status,
        tossUpSalespersonId: parsed.tossUpSalespersonId ?? null,
        closingSalespersonId: parsed.closingSalespersonId ?? null,
        note: parsed.note ?? null,
      },
    });

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${existing.id}`);
    return { id: existing.id };
  });
}

/**
 * 顧客の削除（二次店管理者のみ）。物理削除。
 *
 * 削除できない条件は checkPartnerCustomerDeletable と同じで、ここでも必ず再確認する
 * （画面のボタンを無効にするだけでは足りない）。
 *   - 契約（Contract）が紐づく顧客 … 粗利・インセンティブ・月次集計の起点のため
 *   - 添付ファイル（CustomerFile）がある顧客 … ストレージ上の実体を消す経路が無いため
 *
 * Customer への参照のうち、活動履歴・タスク・通話ログ・メッセージ・既存設備・
 * ローン審査は onDelete: Cascade で消える。アポイント・商談は Cascade が無いので、
 * 同じトランザクションで先に消す（マエカク → アポイント → 商談 の順）。
 */
export async function deletePartnerCustomerAction(
  input: PartnerCustomerDeleteInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_customer.delete");
  const parsed = PartnerCustomerDeleteSchema.parse(input);
  const t = labels.partner.customer.admin;

  return withTenant(partner.ctx, async (tx) => {
    const c = await tx.customer.findFirst({
      where: { id: parsed.id, ...customerScope(partner) },
      select: { id: true, name: true, _count: { select: { files: true, contracts: true } } },
    });
    if (!c) throw new NotFoundError(labels.partner.errors.notFound);
    if (c._count.contracts > 0) throw new ValidationError(t.blockedByContract);
    if (c._count.files > 0) throw new ValidationError(t.blockedByFile);
    // 誤操作よけ。入力されたお客様名が DB の値と一致しないと削除しない。
    if (parsed.confirmName !== c.name) throw new ValidationError(t.nameMismatch);

    const appointments = await tx.appointment.findMany({
      where: { customerId: c.id },
      select: { id: true },
    });
    const appointmentIds = appointments.map((a) => a.id);
    if (appointmentIds.length > 0) {
      const preCalls = await tx.preCall.findMany({
        where: { appointmentId: { in: appointmentIds } },
        select: { id: true },
      });
      const preCallIds = preCalls.map((p) => p.id);
      if (preCallIds.length > 0) {
        await tx.preCallNotification.deleteMany({ where: { preCallId: { in: preCallIds } } });
        await tx.preCall.deleteMany({ where: { id: { in: preCallIds } } });
      }
      await tx.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
    }
    await tx.deal.deleteMany({ where: { customerId: c.id } });
    await tx.customer.delete({ where: { id: c.id } });

    revalidatePath(LIST_PATH);
    return { id: c.id };
  });
}
