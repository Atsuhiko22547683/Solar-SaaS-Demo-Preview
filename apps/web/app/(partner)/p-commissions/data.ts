// 二次店ポータル：手数料（営業フィー）のデータローダー（二次店管理者のみ）。
//
// 扱うのは自社の relationshipId に紐づく 2 つだけ。
//   a. DealerCommissionRate … 適用中の手数料率（トスアップ率 / クロージング率）
//   b. Incentive (FINALIZED) … 確定した営業フィーの金額
// 率の設定は代理店の業務（commission_rate.write）なので、ここには更新系が無い。
//
// 仕入値・原価は返さない（CLAUDE.md #5）。Incentive から出すのは
// 「インセンティブ対象粗利 / 率 / 金額」だけで、GrossProfit の内訳や
// ContractItem のスナップショット原価は select しない。

import "server-only";

import { requirePartnerContext } from "@/lib/partner/context";
import { DEFAULT_PAGE_SIZE, dateOnlyBounds, hasBounds } from "@/lib/partner/list-query";
import { relationshipScope } from "@/lib/partner/scope";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { CommissionListQuery } from "./query";
import type { Prisma } from "@solar/db";

export interface PartnerCommissionRate {
  tossUpRate: string;
  closingRate: string;
  applyFrom: string;
  applyTo: string | null;
  updatedAt: string;
}

export interface PartnerCommissionItem {
  id: string;
  settledMonth: string;
  contractDate: string | null;
  targetProfit: string;
  rate: string;
  amount: string;
  finalizedAt: string | null;
}

export interface PartnerCommissionResult {
  rate: PartnerCommissionRate | null;
  rows: PartnerCommissionItem[];
  total: number;
  page: number;
  pageCount: number;
  /** 絞り込み後の全件合計（表示中のページだけではない）。 */
  totalAmount: string;
}

export async function getPartnerCommissions(
  q: CommissionListQuery,
): Promise<PartnerCommissionResult> {
  const partner = await requirePartnerContext("partner_commission.read");
  return withTenant(partner.ctx, async (tx) => {
    const monthWhere =
      q.monthFrom || q.monthTo
        ? {
            settledMonth: {
              ...(q.monthFrom ? { gte: q.monthFrom } : {}),
              ...(q.monthTo ? { lte: q.monthTo } : {}),
            },
          }
        : {};
    const amountWhere =
      q.amount.min !== undefined || q.amount.max !== undefined
        ? {
            amount: {
              ...(q.amount.min !== undefined ? { gte: q.amount.min } : {}),
              ...(q.amount.max !== undefined ? { lte: q.amount.max } : {}),
            },
          }
        : {};

    // 契約日は Incentive ではなく Contract 側の列。関係条件で絞る。
    const contractBounds = dateOnlyBounds(q.contractDate);
    const where: Prisma.IncentiveWhereInput = {
      ...relationshipScope(partner),
      // 確定済みだけを見せる（下書き・取消は代理店側の作業中の状態）。
      status: "FINALIZED",
      ...monthWhere,
      ...amountWhere,
      ...(hasBounds(contractBounds) ? { contract: { contractDate: contractBounds } } : {}),
    };

    const orderBy: Prisma.IncentiveOrderByWithRelationInput[] = [
      { [q.sort.field]: q.sort.direction },
      { id: "asc" },
    ];

    const [rateRow, total, sum] = await Promise.all([
      tx.dealerCommissionRate.findFirst({
        where: { ...relationshipScope(partner) },
        select: {
          tossUpRate: true,
          closingRate: true,
          applyFrom: true,
          applyTo: true,
          updatedAt: true,
        },
      }),
      tx.incentive.count({ where }),
      tx.incentive.aggregate({ where, _sum: { amount: true } }),
    ]);

    const pageCount = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));
    const current = Math.min(q.page, pageCount);
    const rows = await tx.incentive.findMany({
      where,
      orderBy,
      skip: (current - 1) * DEFAULT_PAGE_SIZE,
      take: DEFAULT_PAGE_SIZE,
      select: {
        id: true,
        settledMonth: true,
        targetProfit: true,
        rate: true,
        amount: true,
        finalizedAt: true,
        // 契約は日付だけ。金額・原価・粗利の内訳は引かない。
        contract: { select: { contractDate: true } },
      },
    });

    return {
      rate: rateRow
        ? {
            tossUpRate: rateRow.tossUpRate.toString(),
            closingRate: rateRow.closingRate.toString(),
            applyFrom: rateRow.applyFrom.toISOString(),
            applyTo: rateRow.applyTo ? rateRow.applyTo.toISOString() : null,
            updatedAt: rateRow.updatedAt.toISOString(),
          }
        : null,
      rows: rows.map((r) => ({
        id: r.id,
        settledMonth: r.settledMonth,
        contractDate: r.contract?.contractDate ? r.contract.contractDate.toISOString() : null,
        targetProfit: r.targetProfit.toString(),
        rate: r.rate.toString(),
        amount: r.amount.toString(),
        finalizedAt: r.finalizedAt ? r.finalizedAt.toISOString() : null,
      })),
      total,
      page: current,
      pageCount,
      totalAmount: (sum._sum.amount ?? 0).toString(),
    };
  });
}
