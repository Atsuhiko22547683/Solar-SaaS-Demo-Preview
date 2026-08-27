// ローン審査一覧の server-side data loader。
//
// LoanReview は Customer に直接ぶら下がる（LoanReview → Customer）。テナント境界は
// customer.wholesalerId を where に置き、RLS と Prisma extension の二重防御を
// そのまま通す（withTenant を迂回しない）。権限キーは顧客詳細のローン審査タブと
// 同じ customer.read を使う（LoanReview 専用のポリシーキーは存在しない）。
//
// 一覧が返す列はすべて実 DB 列に由来する:
//   LoanReview.status/loanCompany/reviewedAt/updatedAt +
//   LoanReviewLog.result/reviewedAt/defectContent/defectResolved/assigneeUserId +
//   Customer.name/area/address/registeredByUserId → User.name。
//
// 「不備状態」と「直近の審査結果」は LoanReviewLog 群からの導出であり、
// DB に持たない集計値である（顧客詳細のローン審査タブと同じ意味論）。

import "server-only";

import { maskName } from "@solar/contracts/services/masking";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import { deriveArea } from "../customers/data";

import type { DefectFilterValue, DefectStateValue } from "./constants";
import type { ViewerContext } from "@solar/contracts/services/masking";
import type { Prisma } from "@solar/db";

// 担当者ドロップダウン用（テナント内 ACTIVE ユーザー）。顧客一覧と同じ loader を再利用。
export { listWholesalerUsers } from "../event-detail/data";

export const PAGE_SIZE = 50;

export interface LoanReviewListFilter {
  /** 顧客名の部分一致（大文字小文字を無視）。 */
  query?: string;
  /** LoanReview.status の完全一致。 */
  status?: string;
  /** 不備の有無。DB 列ではなくログからの導出のため、ここで where に落とす。 */
  defect?: DefectFilterValue;
  /** 並び替え（項目 × 昇順/降順）。未指定は従来どおり更新日時の降順。 */
  sortField?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
}

/**
 * 並び替え項目 → Prisma orderBy。いずれも LoanReview の実列。
 * 一覧から「最終更新」列は外したが、並び替えのキーとしては引き続き使える。
 */
function buildOrderBy(
  sortField: string | undefined,
  direction: "asc" | "desc" = "desc",
): Prisma.LoanReviewOrderByWithRelationInput[] {
  if (sortField === "created_at") return [{ createdAt: direction }];
  return [{ updatedAt: direction }];
}

export interface LoanReviewListItem {
  id: string;
  customerId: string;
  /** PII マスク済みの顧客名。 */
  customerName: string;
  area: string | null;
  /** 顧客の登録担当者名（Customer.registeredByUserId）。LoanReview に担当者列は無い。 */
  assigneeName: string | null;
  loanCompany: string | null;
  status: string;
  /** ログ群からの導出（未解消の不備があれば open、解消済みのみなら resolved）。 */
  defectState: DefectStateValue;
  /** 未解消の不備の担当者名（最新の未解消ログ）。無ければ null。 */
  defectAssigneeName: string | null;
  /** 直近ログの審査結果。ログが無ければ null。 */
  latestResult: string | null;
  latestReviewedAt: string | null;
  updatedAt: string;
}

export interface PagedLoanReviewResult {
  items: LoanReviewListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listLoanReviews(
  filter: LoanReviewListFilter = {},
): Promise<PagedLoanReviewResult> {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError({
      code: "INVALID_CREDENTIALS",
      message: "Session missing — sign in is required",
    });
  }
  const ctx = await getTenantContext();
  assertCan({
    user: {
      userId: ctx.actorUserId,
      roles: session.user.roles,
      isSaasAdmin: ctx.isSaasAdmin,
      tenantId: ctx.tenantId,
      wholesalerId: ctx.wholesalerId,
      dealerId: ctx.dealerId,
      relationshipIds: ctx.relationshipIds,
    },
    action: "customer.read",
  });

  const page = Math.max(1, filter.page ?? 1);
  const skip = (page - 1) * PAGE_SIZE;

  return withTenant(ctx, async (tx) => {
    const settings = ctx.wholesalerId
      ? await tx.wholesalerSettings.findUnique({
          where: { wholesalerId: ctx.wholesalerId },
          select: { piiMaskingMode: true },
        })
      : null;
    const viewer: ViewerContext = {
      role: (session.user.roles[0] ?? "WHOLESALER_ADMIN") as ViewerContext["role"],
      tenantType: "WHOLESALER",
      isSelfTenant: true,
      piiMaskingMode: (settings?.piiMaskingMode ?? "MASKED") as "FULL" | "PARTIAL" | "MASKED",
    };

    const queryStr = filter.query?.trim();

    // 「未解消の不備あり」= defectContent があり defectResolved=false のログを持つ審査。
    const openDefectLog: Prisma.LoanReviewLogWhereInput = {
      defectContent: { not: null },
      defectResolved: false,
    };

    const where: Prisma.LoanReviewWhereInput = {
      customer: {
        wholesalerId: ctx.wholesalerId!,
        ...(queryStr ? { name: { contains: queryStr, mode: "insensitive" } } : {}),
      },
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.defect === "open" ? { logs: { some: openDefectLog } } : {}),
      ...(filter.defect === "none" ? { logs: { none: { defectContent: { not: null } } } } : {}),
    };

    const [rows, total] = await Promise.all([
      tx.loanReview.findMany({
        where,
        orderBy: buildOrderBy(filter.sortField, filter.sortDirection),
        skip,
        take: PAGE_SIZE,
        select: {
          id: true,
          customerId: true,
          loanCompany: true,
          status: true,
          updatedAt: true,
          customer: {
            select: { name: true, area: true, address: true, registeredByUserId: true },
          },
          logs: {
            orderBy: { reviewedAt: "desc" },
            select: {
              reviewedAt: true,
              result: true,
              defectContent: true,
              defectResolved: true,
              assigneeUserId: true,
            },
          },
        },
      }),
      tx.loanReview.count({ where }),
    ]);

    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (rows.length === 0) {
      return { items: [], total, page, pageSize: PAGE_SIZE, totalPages };
    }

    // 顧客担当者 + 不備担当者の名前を 1 クエリでまとめて解決（N+1 回避）。
    const userIds = new Set<string>();
    for (const r of rows) {
      userIds.add(r.customer.registeredByUserId);
      for (const log of r.logs) {
        if (log.assigneeUserId) userIds.add(log.assigneeUserId);
      }
    }
    const users = await tx.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, name: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.name]));

    return {
      items: rows.map((r) => {
        const defectLogs = r.logs.filter((l) => l.defectContent !== null);
        const openDefect = defectLogs.find((l) => !l.defectResolved) ?? null;
        const defectState: DefectStateValue =
          defectLogs.length === 0 ? "none" : openDefect ? "open" : "resolved";
        // logs は reviewedAt desc 済みなので先頭が直近。
        const latest = r.logs[0] ?? null;

        return {
          id: r.id,
          customerId: r.customerId,
          customerName: maskName(r.customer.name, viewer),
          area: r.customer.area ?? deriveArea(r.customer.address),
          assigneeName: nameById.get(r.customer.registeredByUserId) ?? null,
          loanCompany: r.loanCompany,
          status: r.status,
          defectState,
          defectAssigneeName: openDefect?.assigneeUserId
            ? (nameById.get(openDefect.assigneeUserId) ?? null)
            : null,
          latestResult: latest?.result ?? null,
          latestReviewedAt: latest?.reviewedAt.toISOString() ?? null,
          updatedAt: r.updatedAt.toISOString(),
        };
      }),
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages,
    };
  });
}
