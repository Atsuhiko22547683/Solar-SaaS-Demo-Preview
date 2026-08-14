// 施工一覧の server-side data loader（S-046 / F-046 相当・docs/04 §1.3）。
//
// Construction は Contract 経由で顧客・卸業者に紐づく（Construction → Contract →
// Customer）。テナント境界は contract.wholesalerId を where に置き、RLS と
// Prisma extension の二重防御をそのまま通す（withTenant を迂回しない）。
//
// 一覧が返す列はすべて実 DB 列に由来する:
//   Construction.plannedStartDate/plannedEndDate/plannedDate/surveyStatus/status/
//   completedDate/vendorName + Installer.name + Contract.createdBy → User.name +
//   Customer.name/area/address。見た目のためのダミー項目は持たない。
//
// 「施工状態」は顧客一覧と同じ constructionEnumToStatusValue で 4 値
// （現地調査前 / 施工前 / 施工中 / 完工）へ写像し、両画面の表示を一致させる。

import "server-only";

import { maskName } from "@solar/contracts/services/masking";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import { constructionEnumToStatusValue } from "../customers/constants";
import { deriveArea } from "../customers/data";

import type { ConstructionStatusValue, SurveyStatusValue } from "../customers/constants";
import type { ViewerContext } from "@solar/contracts/services/masking";
import type { ConstructionStatus, Prisma } from "@solar/db";

// 担当者ドロップダウン用（テナント内 ACTIVE ユーザー）。顧客一覧と同じ loader を再利用。
export { listWholesalerUsers } from "../event-detail/data";

export const PAGE_SIZE = 50;

export interface ConstructionListFilter {
  /** 顧客名の部分一致（大文字小文字を無視）。 */
  query?: string;
  /** 4 値の施工状態。enum 群へ展開して where に落とす。 */
  status?: ConstructionStatusValue;
  surveyStatus?: SurveyStatusValue;
  /** 施工予定日（plannedStartDate、無い場合は legacy plannedDate）のレンジ。 */
  from?: string;
  to?: string;
  page?: number;
}

export interface ConstructionListItem {
  id: string;
  contractId: string;
  customerId: string;
  /** PII マスク済みの顧客名。 */
  customerName: string;
  area: string | null;
  /** 契約登録者名（Contract.createdBy）。Construction 自体に担当者列は無い。 */
  assigneeName: string | null;
  /** Installer.name、無ければ Construction.vendorName。両方 null なら null。 */
  installerName: string | null;
  /** 施工予定日 — plannedStartDate を優先し、無ければ legacy plannedDate。 */
  plannedDate: string | null;
  plannedEndDate: string | null;
  surveyDate: string | null;
  surveyStatus: SurveyStatusValue | null;
  /** 顧客一覧と同じ 4 値へ写像した施工状態。 */
  status: ConstructionStatusValue;
  completedDate: string | null;
}

export interface PagedConstructionResult {
  items: ConstructionListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 4 値の施工状態 → ConstructionStatus(enum) 群。constructionEnumToStatusValue の逆写像。 */
const STATUS_VALUE_TO_ENUMS: Record<ConstructionStatusValue, ConstructionStatus[]> = {
  not_started: ["REQUEST_PENDING", "REQUESTED"],
  surveyed: ["SURVEYED"],
  in_progress: ["CONSTRUCTING", "PAUSED"],
  done: ["DONE"],
};

/** "YYYY-MM-DD" → 翌日 00:00（ローカル）。期間フィルタの上限を当日終端にする。 */
function nextDay(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

export async function listConstructions(
  filter: ConstructionListFilter = {},
): Promise<PagedConstructionResult> {
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
    action: "construction.read",
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

    // 施工予定日は plannedStartDate 優先・legacy plannedDate フォールバックのため、
    // レンジ条件は OR で両列に掛ける。
    const dateRange =
      filter.from || filter.to
        ? {
            ...(filter.from ? { gte: new Date(filter.from) } : {}),
            ...(filter.to ? { lt: nextDay(filter.to) } : {}),
          }
        : null;

    const where: Prisma.ConstructionWhereInput = {
      contract: {
        wholesalerId: ctx.wholesalerId!,
        ...(queryStr ? { customer: { name: { contains: queryStr, mode: "insensitive" } } } : {}),
      },
      ...(filter.status ? { status: { in: STATUS_VALUE_TO_ENUMS[filter.status] } } : {}),
      ...(filter.surveyStatus ? { surveyStatus: filter.surveyStatus } : {}),
      ...(dateRange
        ? {
            OR: [
              { plannedStartDate: dateRange },
              { plannedStartDate: null, plannedDate: dateRange },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      tx.construction.findMany({
        where,
        // 予定日が近い順（未設定は末尾）。Prisma の nulls last で安定させる。
        orderBy: [{ plannedStartDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        skip,
        take: PAGE_SIZE,
        select: {
          id: true,
          contractId: true,
          plannedDate: true,
          plannedStartDate: true,
          plannedEndDate: true,
          surveyDate: true,
          surveyStatus: true,
          status: true,
          completedDate: true,
          vendorName: true,
          installer: { select: { name: true } },
          contract: {
            select: {
              customerId: true,
              createdBy: true,
              customer: { select: { name: true, area: true, address: true } },
            },
          },
        },
      }),
      tx.construction.count({ where }),
    ]);

    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (rows.length === 0) {
      return { items: [], total, page, pageSize: PAGE_SIZE, totalPages };
    }

    const assigneeIds = [...new Set(rows.map((r) => r.contract.createdBy))];
    const assigneeUsers = await tx.user.findMany({
      where: { id: { in: assigneeIds } },
      select: { id: true, name: true },
    });
    const assigneeNameById = new Map(assigneeUsers.map((u) => [u.id, u.name]));

    return {
      items: rows.map((r) => ({
        id: r.id,
        contractId: r.contractId,
        customerId: r.contract.customerId,
        customerName: maskName(r.contract.customer.name, viewer),
        area: r.contract.customer.area ?? deriveArea(r.contract.customer.address),
        assigneeName: assigneeNameById.get(r.contract.createdBy) ?? null,
        installerName: r.installer?.name ?? r.vendorName,
        plannedDate: (r.plannedStartDate ?? r.plannedDate)?.toISOString() ?? null,
        plannedEndDate: r.plannedEndDate?.toISOString() ?? null,
        surveyDate: r.surveyDate?.toISOString() ?? null,
        surveyStatus: (r.surveyStatus as SurveyStatusValue | null) ?? null,
        status: constructionEnumToStatusValue(r.status),
        completedDate: r.completedDate?.toISOString() ?? null,
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages,
    };
  });
}
