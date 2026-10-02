// 二次店ポータル：成約のデータローダー。
//
// 保存先は専用テーブル DealerContractReport（既存 Contract には相乗りしない）。
// 自社の relationshipId を取得条件にするので、URL の id 書き換えでは他社の行に
// 届かない（RLS と併せて二重に塞ぐ）。

import "server-only";

import {
  listDealerUserOptions,
  resolveUserNames,
  submittedByWhere,
  type DealerUserOption,
} from "@/lib/partner/admin";
import { requirePartnerContext } from "@/lib/partner/context";
import { DEFAULT_PAGE_SIZE, dateOnlyBounds, hasBounds } from "@/lib/partner/list-query";
import { relationshipScope } from "@/lib/partner/scope";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { ContractListQuery } from "./query";
import type { Prisma } from "@solar/db";

export interface PartnerContractListItem {
  id: string;
  contractDate: string;
  tossDate: string;
  tossDept: string;
  salesRep: string;
  referralBranch: string;
  affiliation: string;
  acquisitionChannel: string;
  /** 提出したスタッフ。管理者向けの列にだけ使う。 */
  submitterName: string | null;
  createdAt: string;
}

export interface PartnerContractListResult {
  rows: PartnerContractListItem[];
  total: number;
  page: number;
  pageCount: number;
  isAdmin: boolean;
  staffOptions: DealerUserOption[];
}

/** 一覧。権限による対象限定 → 絞り込み → 並べ替え → ページ分割をすべて DB 側で行う。 */
export async function listPartnerContracts(
  q: ContractListQuery,
): Promise<PartnerContractListResult> {
  const partner = await requirePartnerContext("partner_contract_report.read");
  const isAdmin = partner.role === "ADMIN";
  return withTenant(partner.ctx, async (tx) => {
    const contractBounds = dateOnlyBounds(q.contractDate);
    const tossBounds = dateOnlyBounds(q.tossDate);
    const contains = (v: string | undefined) =>
      v ? { contains: v, mode: "insensitive" as const } : undefined;
    const where: Prisma.DealerContractReportWhereInput = {
      ...relationshipScope(partner),
      ...submittedByWhere(partner, q.submittedBy),
      ...(hasBounds(contractBounds) ? { contractDate: contractBounds } : {}),
      ...(hasBounds(tossBounds) ? { tossDate: tossBounds } : {}),
      ...(q.tossDept ? { tossDept: contains(q.tossDept) } : {}),
      ...(q.apptGetter ? { apptGetter: contains(q.apptGetter) } : {}),
      ...(q.salesRep ? { salesRep: contains(q.salesRep) } : {}),
      ...(q.referralBranch ? { referralBranch: contains(q.referralBranch) } : {}),
      ...(q.affiliation ? { affiliation: q.affiliation } : {}),
      ...(q.affiliationDept ? { affiliationDept: contains(q.affiliationDept) } : {}),
      ...(q.acquisitionChannel ? { acquisitionChannel: q.acquisitionChannel } : {}),
    };
    // 並べ替え対象は query.ts の許可リストに限る。同値は id で安定させる。
    const orderBy: Prisma.DealerContractReportOrderByWithRelationInput[] = [
      { [q.sort.field]: q.sort.direction },
      { id: "asc" },
    ];
    const total = await tx.dealerContractReport.count({ where });
    const pageCount = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));
    const current = Math.min(q.page, pageCount);
    const rows = await tx.dealerContractReport.findMany({
      where,
      orderBy,
      skip: (current - 1) * DEFAULT_PAGE_SIZE,
      take: DEFAULT_PAGE_SIZE,
      select: {
        id: true,
        contractDate: true,
        tossDate: true,
        tossDept: true,
        salesRep: true,
        referralBranch: true,
        affiliation: true,
        acquisitionChannel: true,
        createdByUserId: true,
        createdAt: true,
      },
    });
    // 提出者の氏名は User へのリレーションが無いので、同じ tx 内でまとめて引く。
    const [names, staffOptions] = await Promise.all([
      isAdmin
        ? resolveUserNames(
            tx,
            rows.map((r) => r.createdByUserId),
          )
        : Promise.resolve(null),
      isAdmin ? listDealerUserOptions(tx, partner) : Promise.resolve([]),
    ]);
    return {
      rows: rows.map((r) => ({
        id: r.id,
        contractDate: r.contractDate.toISOString(),
        tossDate: r.tossDate.toISOString(),
        tossDept: r.tossDept,
        salesRep: r.salesRep,
        referralBranch: r.referralBranch,
        affiliation: r.affiliation,
        acquisitionChannel: r.acquisitionChannel,
        submitterName: names?.get(r.createdByUserId) ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page: current,
      pageCount,
      isAdmin,
      staffOptions,
    };
  });
}

export interface PartnerContractDetail {
  id: string;
  /** 対象の顧客。選ばれていなければ null。正式な契約とは別物。 */
  customerId: string | null;
  contractDate: string;
  tossDate: string;
  tossDept: string;
  apptGetter: string;
  salesRep: string;
  referralBranch: string;
  affiliation: string;
  affiliationDept: string;
  acquisitionChannel: string;
  /** 提出したスタッフ。管理者向けの表示のみ。 */
  submitterName: string | null;
  createdAt: string;
}

export async function getPartnerContract(id: string): Promise<PartnerContractDetail | null> {
  const partner = await requirePartnerContext("partner_contract_report.read");
  return withTenant(partner.ctx, async (tx) => {
    const r = await tx.dealerContractReport.findFirst({
      where: { id, ...relationshipScope(partner) },
    });
    if (!r) return null;
    const names = partner.role === "ADMIN" ? await resolveUserNames(tx, [r.createdByUserId]) : null;
    return {
      id: r.id,
      customerId: r.customerId,
      contractDate: r.contractDate.toISOString(),
      tossDate: r.tossDate.toISOString(),
      tossDept: r.tossDept,
      apptGetter: r.apptGetter,
      salesRep: r.salesRep,
      referralBranch: r.referralBranch,
      affiliation: r.affiliation,
      affiliationDept: r.affiliationDept,
      acquisitionChannel: r.acquisitionChannel,
      submitterName: names?.get(r.createdByUserId) ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  });
}
