// 設置申請一覧の server-side data loader（S-047 / F-047 相当・docs/04 §1.3）。
//
// Application は Contract 経由で顧客・卸業者に紐づく（Application → Contract →
// Customer）。テナント境界は contract.wholesalerId を where に置き、RLS と
// Prisma extension の二重防御をそのまま通す（withTenant を迂回しない）。
//
// 一覧が返す列はすべて実 DB 列に由来する:
//   Application.type/agency/plannedDate/submittedDate/approvedDate/status/fileKeys
//   + CustomerFile 件数 + Contract.createdBy → User.name + Customer.name/area/address。
//
// 「申請状態」は顧客一覧の「設置申請状況」と同じ 4 値へ写像して表示する
// （applicationEnumToSubsidyValue）。両画面の表示が食い違わないようにするため。

import "server-only";

import { maskName } from "@solar/contracts/services/masking";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import { FILTER_VALUE_TO_ENUMS } from "./constants";
import { applicationEnumToSubsidyValue } from "../customers/constants";
import { deriveArea } from "../customers/data";

import type { ApplicationFilterValue } from "./constants";
import type { SubsidyStatusValue } from "../customers/constants";
import type { ViewerContext } from "@solar/contracts/services/masking";
import type { Prisma } from "@solar/db";

export const PAGE_SIZE = 50;

export interface ApplicationListFilter {
  /** 顧客名の部分一致（大文字小文字を無視）。 */
  query?: string;
  /** 4 値の申請状態。enum 群へ展開して where に落とす。 */
  status?: ApplicationFilterValue;
  /** 申請種別（Application.type の完全一致）。値域は DB 実データから供給する。 */
  type?: string;
  /** 申請予定日（plannedDate）のレンジ。 */
  from?: string;
  to?: string;
  page?: number;
}

export interface ApplicationListItem {
  id: string;
  contractId: string;
  customerId: string;
  /** PII マスク済みの顧客名。 */
  customerName: string;
  area: string | null;
  /** 契約登録者名（Contract.createdBy）。Application 自体に担当者列は無い。 */
  assigneeName: string | null;
  /** Application.type（自由入力）。 */
  type: string;
  /** 提出先（Application.agency）。未設定は null。 */
  agency: string | null;
  plannedDate: string | null;
  submittedDate: string | null;
  approvedDate: string | null;
  /** 顧客一覧と同じ 4 値へ写像した申請状態。 */
  status: SubsidyStatusValue;
  /** 関連書類の件数 — fileKeys[] と CustomerFile(applicationId) の合計。 */
  fileCount: number;
}

export interface PagedApplicationResult {
  items: ApplicationListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** "YYYY-MM-DD" → 翌日 00:00（ローカル）。期間フィルタの上限を当日終端にする。 */
function nextDay(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

export async function listApplications(
  filter: ApplicationListFilter = {},
): Promise<PagedApplicationResult> {
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
    action: "application.read",
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

    const where: Prisma.ApplicationWhereInput = {
      contract: {
        wholesalerId: ctx.wholesalerId!,
        ...(queryStr ? { customer: { name: { contains: queryStr, mode: "insensitive" } } } : {}),
      },
      ...(filter.status ? { status: { in: FILTER_VALUE_TO_ENUMS[filter.status] } } : {}),
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.from || filter.to
        ? {
            plannedDate: {
              ...(filter.from ? { gte: new Date(filter.from) } : {}),
              ...(filter.to ? { lt: nextDay(filter.to) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      tx.application.findMany({
        where,
        // 申請予定日が近い順（未設定は末尾）。
        orderBy: [{ plannedDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
        skip,
        take: PAGE_SIZE,
        select: {
          id: true,
          contractId: true,
          type: true,
          agency: true,
          plannedDate: true,
          submittedDate: true,
          approvedDate: true,
          status: true,
          fileKeys: true,
          _count: { select: { files: true } },
          contract: {
            select: {
              customerId: true,
              createdBy: true,
              customer: { select: { name: true, area: true, address: true } },
            },
          },
        },
      }),
      tx.application.count({ where }),
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
        type: r.type,
        agency: r.agency,
        plannedDate: r.plannedDate?.toISOString() ?? null,
        submittedDate: r.submittedDate?.toISOString() ?? null,
        approvedDate: r.approvedDate?.toISOString() ?? null,
        status: applicationEnumToSubsidyValue(r.status),
        fileCount: r.fileKeys.length + r._count.files,
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages,
    };
  });
}

/**
 * 申請種別の絞り込みドロップダウン用。Application.type は自由入力なので、
 * 選択肢は「実際に登録されている値」を DB から取る（架空の値域を作らない）。
 */
export async function listApplicationTypes(): Promise<string[]> {
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
    action: "application.read",
  });

  return withTenant(ctx, async (tx) => {
    const rows = await tx.application.findMany({
      where: { contract: { wholesalerId: ctx.wholesalerId! } },
      distinct: ["type"],
      orderBy: { type: "asc" },
      select: { type: true },
    });
    return rows.map((r) => r.type).filter((t) => t.length > 0);
  });
}
