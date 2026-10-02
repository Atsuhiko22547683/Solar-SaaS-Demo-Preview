"use server";

// 二次店ポータル：成約の登録・編集。
//
// 保存先は専用テーブル DealerContractReport。既存 Contract は dealId / customerId /
// contractAmount / cancelDeadline が必須で粗利・インセンティブ計算の起点になるため、
// 項目の足りないこのフォームを相乗りさせない（ダミー値を作らない）。
//
// 所属系（wholesalerId / relationshipId / 登録者）は認証情報から設定し、
// フォームからは受け取らない。

import {
  DealerContractReportCreateSchema,
  DealerContractReportUpdateSchema,
  type DealerContractReportCreateInput,
  type DealerContractReportUpdateInput,
} from "@solar/contracts";
import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/lib/errors";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext, resolveRelationship } from "@/lib/partner/context";
import { customerScope, relationshipScope } from "@/lib/partner/scope";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { PartnerContext } from "@/lib/partner/context";
import type { TxClient } from "@solar/db";

const LIST_PATH = "/p-contracts";

/**
 * 成約報告の対象顧客を確かめる。
 *
 * 顧客は自社が取り扱っている顧客であること。ここで返すのは顧客だけで、
 * 商談・契約は作らない・結び付けない（このフォームは金額も解約期限も持たないので、
 * 正式な契約に載せるには架空値が要る。売上・手数料はこれまでどおり商談から積む）。
 */
async function resolveContractTargetCustomerId(
  tx: TxClient,
  partner: PartnerContext,
  customerId: string | undefined,
): Promise<string | null> {
  if (!customerId) return null;
  const customer = await tx.customer.findFirst({
    where: { id: customerId, AND: [customerScope(partner)] },
    select: { id: true },
  });
  if (!customer) throw new NotFoundError(labels.partner.errors.notFound);
  return customer.id;
}

export async function createPartnerContractAction(
  input: DealerContractReportCreateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_contract_report.write");
  const parsed = DealerContractReportCreateSchema.parse(input);
  // 依頼元代理店は候補の中から確定させる（送信値をそのまま書き込み先にしない）。
  const origin = resolveRelationship(partner, parsed.relationshipId);

  return withTenant(partner.ctx, async (tx) => {
    const customerId = await resolveContractTargetCustomerId(tx, partner, parsed.customerId);

    const row = await tx.dealerContractReport.create({
      data: {
        wholesalerId: origin.wholesalerId,
        relationshipId: origin.id,
        createdByUserId: partner.userId,
        customerId,
        contractDate: parsed.contractDate,
        tossDate: parsed.tossDate,
        tossDept: parsed.tossDept,
        apptGetter: parsed.apptGetter,
        salesRep: parsed.salesRep,
        referralBranch: parsed.referralBranch,
        affiliation: parsed.affiliation,
        affiliationDept: parsed.affiliationDept,
        acquisitionChannel: parsed.acquisitionChannel,
      },
      select: { id: true },
    });

    revalidatePath(LIST_PATH);
    return { id: row.id };
  });
}

export async function updatePartnerContractAction(
  input: DealerContractReportUpdateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_contract_report.write");
  const parsed = DealerContractReportUpdateSchema.parse(input);

  return withTenant(partner.ctx, async (tx) => {
    // 自社が登録した行かを先に確認する（URL の id 書き換え対策）。
    const existing = await tx.dealerContractReport.findFirst({
      where: { id: parsed.id, ...relationshipScope(partner) },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError(labels.partner.errors.notFound);

    const customerId = await resolveContractTargetCustomerId(tx, partner, parsed.customerId);

    await tx.dealerContractReport.update({
      where: { id: existing.id },
      data: {
        customerId,
        contractDate: parsed.contractDate,
        tossDate: parsed.tossDate,
        tossDept: parsed.tossDept,
        apptGetter: parsed.apptGetter,
        salesRep: parsed.salesRep,
        referralBranch: parsed.referralBranch,
        affiliation: parsed.affiliation,
        affiliationDept: parsed.affiliationDept,
        acquisitionChannel: parsed.acquisitionChannel,
      },
    });

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${existing.id}`);
    return { id: existing.id };
  });
}
