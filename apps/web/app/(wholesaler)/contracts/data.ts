// Server-side data loaders for the wholesaler contract list and detail pages
// (T-05-09 / F-040 / F-041 / F-042 / docs/04 §1.3 S-040 / S-041).
//
// listContracts — paginated 50 rows, status + dateRange filters, wholesalerId
//   scoped via ctx (never from input).
// getContractDetail — Contract + ContractItem[] + GrossProfit? + Construction[]
//   + Application[] in one withTenant transaction.
//
// Both helpers use `contract.read` permission key; wholesalerId comes from ctx.

import "server-only";

import { toContractItemWholesalerDto } from "@solar/contracts";
import { maskName } from "@solar/contracts/services/masking";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import { deriveConstructionStatusValue, deriveSubsidyStatusValue } from "../customers/constants";

import type { ConstructionStatusValue, SubsidyStatusValue } from "../customers/constants";
import type { ContractItemForWholesalerDto } from "@solar/contracts";
import type { ViewerContext } from "@solar/contracts/services/masking";
import type { ContractStatus, Prisma } from "@solar/db";

// 担当者ドロップダウン用（テナント内 ACTIVE ユーザー）。顧客一覧と同じ loader を再利用。
export { listWholesalerUsers } from "../event-detail/data";

export const PAGE_SIZE = 50;

export interface ContractListFilter {
  status?: ContractStatus;
  /** 契約登録者（Contract.createdBy）で絞り込む。顧客一覧の担当者列と同じ意味論。 */
  assigneeUserId?: string;
  /** 顧客名の部分一致（大文字小文字を無視）。 */
  query?: string;
  from?: string;
  to?: string;
  page?: number;
}

export interface ContractListItem {
  id: string;
  customerId: string;
  /** PII マスク済みの顧客名（顧客一覧と同じ maskName を通す）。 */
  customerName: string;
  /** 契約登録者名。解決できないときは null（表示側で「—」）。 */
  assigneeName: string | null;
  contractDate: string;
  contractAmount: string;
  status: ContractStatus;
  /** 後続工程 — 紐づく Construction 群から導出した代表施工状況。 */
  constructionStatus: ConstructionStatusValue | null;
  /** 後続工程 — 紐づく Application 群から導出した代表設置申請状況。 */
  subsidyStatus: SubsidyStatusValue | null;
  cancelDeadline: string;
  ownerRelationshipId: string | null;
  createdAt: string;
}

export interface PagedContractResult {
  items: ContractListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listContracts(filter: ContractListFilter = {}): Promise<PagedContractResult> {
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
    action: "contract.read",
  });

  const page = Math.max(1, filter.page ?? 1);
  const skip = (page - 1) * PAGE_SIZE;

  return withTenant(ctx, async (tx) => {
    // PII マスクモードは顧客一覧（customers/data.ts）と同じ経路で解決する。
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

    const where: Prisma.ContractWhereInput = {
      wholesalerId: ctx.wholesalerId!,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.assigneeUserId ? { createdBy: filter.assigneeUserId } : {}),
      ...(queryStr ? { customer: { name: { contains: queryStr, mode: "insensitive" } } } : {}),
      ...(filter.from || filter.to
        ? {
            contractDate: {
              ...(filter.from ? { gte: new Date(filter.from) } : {}),
              // to は当日終端まで含める（日付入力の直感に合わせる）。
              ...(filter.to ? { lt: nextDay(filter.to) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      tx.contract.findMany({
        where,
        orderBy: [{ contractDate: "desc" }],
        skip,
        take: PAGE_SIZE,
        select: {
          id: true,
          customerId: true,
          contractDate: true,
          contractAmount: true,
          status: true,
          cancelDeadline: true,
          ownerRelationshipId: true,
          createdBy: true,
          createdAt: true,
          customer: { select: { name: true } },
          // 後続工程（施工 / 設置申請）の代表状況を導出するための最小 select。
          constructions: { select: { status: true } },
          applications: { select: { status: true } },
        },
      }),
      tx.contract.count({ where }),
    ]);

    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (rows.length === 0) {
      return { items: [], total, page, pageSize: PAGE_SIZE, totalPages };
    }

    // 契約登録者名を 1 クエリでまとめて解決（N+1 回避）。
    const assigneeIds = [...new Set(rows.map((r) => r.createdBy))];
    const assigneeUsers = await tx.user.findMany({
      where: { id: { in: assigneeIds } },
      select: { id: true, name: true },
    });
    const assigneeNameById = new Map(assigneeUsers.map((u) => [u.id, u.name]));

    return {
      items: rows.map((r) => ({
        id: r.id,
        customerId: r.customerId,
        customerName: maskName(r.customer.name, viewer),
        assigneeName: assigneeNameById.get(r.createdBy) ?? null,
        contractDate: r.contractDate.toISOString(),
        contractAmount: r.contractAmount.toString(),
        status: r.status,
        // 顧客一覧と同一の導出関数を使い、両画面の表示が食い違わないようにする。
        constructionStatus:
          r.constructions.length > 0
            ? deriveConstructionStatusValue(r.constructions, "not_started")
            : null,
        subsidyStatus: r.applications.length > 0 ? deriveSubsidyStatusValue(r.applications) : null,
        cancelDeadline: r.cancelDeadline.toISOString(),
        ownerRelationshipId: r.ownerRelationshipId,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages,
    };
  });
}

/** "YYYY-MM-DD" → 翌日 00:00（ローカル）。期間フィルタの上限を当日終端にする。 */
export function nextDay(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

export interface ContractDetailGrossProfit {
  id: string;
  salesPrice: string;
  purchaseTotal: string;
  dealerTotal: string;
  constructionFee: string;
  otherCost: string;
  discount: string;
  projectProfit: string;
  wholesaleProfit: string;
  profitRate: string;
  incentiveTargetProfit: string;
  incentiveTargetType: string;
  manualAdjustedAt: string | null;
  manualAdjustmentReason: string | null;
}

export interface ContractDetailConstruction {
  id: string;
  status: string;
  plannedDate: string | null;
  completedDate: string | null;
  fee: string | null;
}

export interface ContractDetailApplication {
  id: string;
  type: string;
  status: string;
  expectedAmount: string | null;
  grantedAmount: string | null;
  plannedDate: string | null;
}

export interface ContractDetail {
  id: string;
  customerId: string;
  customerName: string;
  dealId: string;
  contractDate: string;
  contractAmount: string;
  status: ContractStatus;
  cancelDeadline: string;
  incentiveRateSnapshot: string | null;
  incentiveTargetTypeSnapshot: string | null;
  isSelfHosted: boolean;
  ownerRelationshipId: string | null;
  createdAt: string;
  updatedAt: string;
  items: ContractItemForWholesalerDto[];
  grossProfit: ContractDetailGrossProfit | null;
  constructions: ContractDetailConstruction[];
  applications: ContractDetailApplication[];
}

export async function getContractDetail(id: string): Promise<ContractDetail | null> {
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
    action: "contract.read",
  });

  return withTenant(ctx, async (tx) => {
    const row = await tx.contract.findUnique({
      where: { id },
      select: {
        id: true,
        dealId: true,
        customerId: true,
        contractDate: true,
        contractAmount: true,
        status: true,
        cancelDeadline: true,
        incentiveRateSnapshot: true,
        incentiveTargetTypeSnapshot: true,
        isSelfHosted: true,
        ownerRelationshipId: true,
        createdAt: true,
        updatedAt: true,
        customer: { select: { name: true } },
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            contractId: true,
            productId: true,
            productName: true,
            maker: true,
            modelNo: true,
            qty: true,
            unit: true,
            snapshotPurchasePrice: true,
            snapshotDealerPrice: true,
            snapshotListPrice: true,
            createdAt: true,
          },
        },
        grossProfit: {
          select: {
            id: true,
            salesPrice: true,
            purchaseTotal: true,
            dealerTotal: true,
            constructionFee: true,
            otherCost: true,
            discount: true,
            projectProfit: true,
            wholesaleProfit: true,
            profitRate: true,
            incentiveTargetProfit: true,
            incentiveTargetType: true,
            manualAdjustedAt: true,
            manualAdjustmentReason: true,
          },
        },
        constructions: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            status: true,
            plannedDate: true,
            completedDate: true,
            fee: true,
          },
        },
        applications: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            type: true,
            status: true,
            expectedAmount: true,
            grantedAmount: true,
            plannedDate: true,
          },
        },
      },
    });

    if (!row) return null;

    const items: ContractItemForWholesalerDto[] = row.items.map((r) => {
      const qty = Number(r.qty);
      const listPrice = Number(r.snapshotListPrice.toString());
      const subtotal = (qty * listPrice).toFixed(2);
      return toContractItemWholesalerDto({
        id: r.id,
        contractId: r.contractId,
        productId: r.productId,
        productName: r.productName,
        maker: r.maker,
        modelNo: r.modelNo,
        qty: r.qty.toString(),
        unit: r.unit,
        snapshotPurchasePrice: r.snapshotPurchasePrice.toString(),
        snapshotDealerPrice: r.snapshotDealerPrice.toString(),
        snapshotListPrice: r.snapshotListPrice.toString(),
        subtotal,
        createdAt: r.createdAt.toISOString(),
      });
    });

    return {
      id: row.id,
      dealId: row.dealId,
      customerId: row.customerId,
      customerName: row.customer.name,
      contractDate: row.contractDate.toISOString(),
      contractAmount: row.contractAmount.toString(),
      status: row.status,
      cancelDeadline: row.cancelDeadline.toISOString(),
      incentiveRateSnapshot: row.incentiveRateSnapshot?.toString() ?? null,
      incentiveTargetTypeSnapshot: row.incentiveTargetTypeSnapshot ?? null,
      isSelfHosted: row.isSelfHosted,
      ownerRelationshipId: row.ownerRelationshipId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      items,
      grossProfit: row.grossProfit
        ? {
            id: row.grossProfit.id,
            salesPrice: row.grossProfit.salesPrice.toString(),
            purchaseTotal: row.grossProfit.purchaseTotal.toString(),
            dealerTotal: row.grossProfit.dealerTotal.toString(),
            constructionFee: row.grossProfit.constructionFee.toString(),
            otherCost: row.grossProfit.otherCost.toString(),
            discount: row.grossProfit.discount.toString(),
            projectProfit: row.grossProfit.projectProfit.toString(),
            wholesaleProfit: row.grossProfit.wholesaleProfit.toString(),
            profitRate: row.grossProfit.profitRate.toString(),
            incentiveTargetProfit: row.grossProfit.incentiveTargetProfit.toString(),
            incentiveTargetType: row.grossProfit.incentiveTargetType,
            manualAdjustedAt: row.grossProfit.manualAdjustedAt?.toISOString() ?? null,
            manualAdjustmentReason: row.grossProfit.manualAdjustmentReason,
          }
        : null,
      constructions: row.constructions.map((c) => ({
        id: c.id,
        status: c.status,
        plannedDate: c.plannedDate?.toISOString() ?? null,
        completedDate: c.completedDate?.toISOString() ?? null,
        fee: c.fee?.toString() ?? null,
      })),
      applications: row.applications.map((a) => ({
        id: a.id,
        type: a.type,
        status: a.status,
        expectedAmount: a.expectedAmount?.toString() ?? null,
        grantedAmount: a.grantedAmount?.toString() ?? null,
        plannedDate: a.plannedDate?.toISOString() ?? null,
      })),
    };
  });
}
