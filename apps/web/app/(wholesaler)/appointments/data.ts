// Server-side data loader for the wholesaler appointment list (T-04-08 /
// F-034 / docs/04 §1.3 S-034 / docs/05 §4.7).
//
// Wholesaler sees all appointments linked to their wholesaler tenant via the
// Customer.wholesalerId FK. Filters: customerId / status / 取得担当者 /
// 顧客名部分一致 / 予定日レンジ。Pagination: PAGE_SIZE rows per page.
//
// 一覧が返す列はすべて実 DB 列に由来する（Appointment 本体 + Customer.area/
// address/nextAction + PreCall.result/calledAt/nextAction + User.name）。
// 顧客名は顧客一覧と同じ maskName を通す（CLAUDE.md ルール 6）。

import "server-only";

import { maskName } from "@solar/contracts/services/masking";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import { deriveArea } from "../customers/data";

import type { ViewerContext } from "@solar/contracts/services/masking";
import type { AppointmentStatus, PreCallResult, Prisma } from "@solar/db";

// 担当者ドロップダウン用（テナント内 ACTIVE ユーザー）。顧客一覧と同じ loader を再利用。
export { listWholesalerUsers } from "../event-detail/data";

export const PAGE_SIZE = 50;

export interface AppointmentListFilter {
  customerId?: string;
  status?: AppointmentStatus;
  /** 取得担当者（Appointment.acquiredByUserId）で絞り込む。 */
  assigneeUserId?: string;
  /** 顧客名の部分一致（大文字小文字を無視）。 */
  query?: string;
  from?: string;
  to?: string;
  page?: number;
}

export interface AppointmentListItem {
  id: string;
  customerId: string;
  /** PII マスク済みの顧客名（顧客一覧と同じ maskName を通す）。 */
  customerName: string;
  /** 住所先頭の都道府県（Customer.area、無ければ住所から導出）。 */
  area: string | null;
  /** 取得担当者名。テナント外（二次店取得）は解決できず null。 */
  assigneeName: string | null;
  scheduledAt: string;
  /** Appointment.appointmentType（任意入力・未設定は null）。 */
  appointmentType: string | null;
  location: string | null;
  status: AppointmentStatus;
  /** マエカク（PreCall）の結果。未実施は null。 */
  preCallResult: PreCallResult | null;
  preCallCalledAt: string | null;
  /** 次に必要な対応 — PreCall.nextAction を優先し、無ければ Customer.nextAction。 */
  nextAction: string | null;
  acquiredOrgType: "WHOLESALER" | "DEALER";
  createdAt: string;
}

export interface PagedAppointmentResult {
  items: AppointmentListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listAppointments(
  filter: AppointmentListFilter = {},
): Promise<PagedAppointmentResult> {
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
    action: "appointment.read",
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

    const where: Prisma.AppointmentWhereInput = {
      customer: {
        wholesalerId: ctx.wholesalerId!,
        ...(queryStr ? { name: { contains: queryStr, mode: "insensitive" } } : {}),
      },
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.assigneeUserId ? { acquiredByUserId: filter.assigneeUserId } : {}),
      ...(filter.from || filter.to
        ? {
            scheduledAt: {
              ...(filter.from ? { gte: new Date(filter.from) } : {}),
              // to は当日終端まで含める（日付入力の直感に合わせる）。
              ...(filter.to ? { lt: endOfDay(filter.to) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      tx.appointment.findMany({
        where,
        orderBy: [{ scheduledAt: "desc" }],
        skip,
        take: PAGE_SIZE,
        select: {
          id: true,
          customerId: true,
          scheduledAt: true,
          appointmentType: true,
          location: true,
          status: true,
          acquiredByUserId: true,
          acquiredOrgType: true,
          createdAt: true,
          customer: { select: { name: true, area: true, address: true, nextAction: true } },
          preCall: { select: { result: true, calledAt: true, nextAction: true } },
        },
      }),
      tx.appointment.count({ where }),
    ]);

    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (rows.length === 0) {
      return { items: [], total, page, pageSize: PAGE_SIZE, totalPages };
    }

    // 取得担当者名を 1 クエリでまとめて解決（N+1 回避）。二次店ユーザーは RLS で
    // 見えないため未解決 → null のまま返し、表示側で「—」にフォールバックする。
    const assigneeIds = [...new Set(rows.map((r) => r.acquiredByUserId))];
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
        area: r.customer.area ?? deriveArea(r.customer.address),
        assigneeName: assigneeNameById.get(r.acquiredByUserId) ?? null,
        scheduledAt: r.scheduledAt.toISOString(),
        appointmentType: r.appointmentType,
        location: r.location,
        status: r.status,
        preCallResult: r.preCall?.result ?? null,
        preCallCalledAt: r.preCall?.calledAt.toISOString() ?? null,
        nextAction: r.preCall?.nextAction ?? r.customer.nextAction,
        acquiredOrgType: r.acquiredOrgType as "WHOLESALER" | "DEALER",
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
export function endOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}
