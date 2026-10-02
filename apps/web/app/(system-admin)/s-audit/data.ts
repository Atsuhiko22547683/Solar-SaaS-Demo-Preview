// 操作履歴の読み取り。
//
// 運営者による会社・利用者・権限の変更を記録した AuditLog を出す。
// この画面は読み取り専用で、編集・削除の操作は用意しない（Server Action も作らない）。
//
// 過去の履歴が無い場合は空のまま出す（作り物で埋めない）。

import "server-only";

import { requireSystemAdmin } from "@/lib/system-admin/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { AuditAction, Prisma } from "@solar/db";

/** 運営操作として扱う対象。業務データの監査は混ぜない。 */
const OPERATOR_TARGETS = ["Tenant", "User", "UserRole", "UserInvitation"] as const;

export interface AuditRow {
  id: string;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
  targetType: string;
  targetId: string;
  targetLabel: string | null;
  companyName: string | null;
  action: string;
  changes: { field: string; before: unknown; after: unknown }[];
}

export interface AuditListResult {
  rows: AuditRow[];
  total: number;
  page: number;
  pages: number;
}

export interface AuditListQuery {
  from?: string;
  to?: string;
  actorId?: string;
  companyId?: string;
  action?: string;
  page?: number;
}

const PAGE_SIZE = 20;

function diff(
  before: unknown,
  after: unknown,
): { field: string; before: unknown; after: unknown }[] {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return keys
    .filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]))
    .map((k) => ({ field: k, before: b[k] ?? null, after: a[k] ?? null }));
}

export async function listAuditLogs(query: AuditListQuery): Promise<AuditListResult> {
  const { ctx } = await requireSystemAdmin("system_admin.audit.read");
  const page = Math.max(1, query.page ?? 1);

  return withTenant(ctx, async (tx) => {
    const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined;
    // 終了日は当日を含める（翌日 0 時の手前まで）。
    const to = query.to ? new Date(`${query.to}T00:00:00.000Z`) : undefined;
    if (to) to.setUTCDate(to.getUTCDate() + 1);

    const where: Prisma.AuditLogWhereInput = {
      targetType: { in: [...OPERATOR_TARGETS] },
      // 運営者の操作だけを出す（操作者が無い行は業務側・自動処理の記録）。
      actorUserId: query.actorId ? query.actorId : { not: null },
      ...(from || to
        ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } }
        : {}),
      ...(query.companyId ? { tenantId: query.companyId } : {}),
      ...(query.action ? { action: query.action as AuditAction } : {}),
    };

    const [total, rows] = await Promise.all([
      tx.auditLog.count({ where }),
      tx.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          createdAt: true,
          actorUserId: true,
          tenantId: true,
          targetType: true,
          targetId: true,
          action: true,
          before: true,
          after: true,
        },
      }),
    ]);

    // 表示名の解決。取れないものは null のままにする（作り話をしない）。
    const actorIds = [...new Set(rows.map((r) => r.actorUserId).filter((x): x is string => !!x))];
    const tenantIds = [...new Set(rows.map((r) => r.tenantId))];
    const userTargets = rows.filter((r) => r.targetType === "User").map((r) => r.targetId);
    const tenantTargets = rows.filter((r) => r.targetType === "Tenant").map((r) => r.targetId);

    const [actors, tenants, targetUsers, targetTenants] = await Promise.all([
      actorIds.length
        ? tx.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, name: true, email: true },
          })
        : [],
      tenantIds.length
        ? tx.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } })
        : [],
      userTargets.length
        ? tx.user.findMany({ where: { id: { in: userTargets } }, select: { id: true, name: true } })
        : [],
      tenantTargets.length
        ? tx.tenant.findMany({
            where: { id: { in: tenantTargets } },
            select: { id: true, name: true },
          })
        : [],
    ]);
    const actorById = new Map(actors.map((a) => [a.id, a]));
    const tenantById = new Map(tenants.map((x) => [x.id, x.name]));
    const userNameById = new Map(targetUsers.map((u) => [u.id, u.name]));
    const tenantNameById = new Map(targetTenants.map((x) => [x.id, x.name]));

    return {
      rows: rows.map((r) => ({
        id: r.id.toString(),
        createdAt: r.createdAt.toISOString(),
        actorName: r.actorUserId ? (actorById.get(r.actorUserId)?.name ?? null) : null,
        actorEmail: r.actorUserId ? (actorById.get(r.actorUserId)?.email ?? null) : null,
        targetType: r.targetType,
        targetId: r.targetId,
        targetLabel:
          r.targetType === "User"
            ? (userNameById.get(r.targetId) ?? null)
            : r.targetType === "Tenant"
              ? (tenantNameById.get(r.targetId) ?? null)
              : null,
        companyName: tenantById.get(r.tenantId) ?? null,
        action: r.action,
        changes: diff(r.before, r.after),
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  });
}

/** 絞り込み用の操作者候補（運営者）。 */
export async function listAuditActors(): Promise<{ id: string; name: string }[]> {
  const { ctx } = await requireSystemAdmin("system_admin.audit.read");
  return withTenant(ctx, (tx) =>
    tx.user.findMany({
      where: { roles: { some: { role: "SAAS_ADMIN" } } },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
  );
}
