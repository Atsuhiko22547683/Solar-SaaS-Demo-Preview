// 利用者管理の読み取り。
//
// 会社をまたぐ取得は requireSystemAdmin() を通したこの関数だけが行う。
// パスワードそのものは読まない（passwordHash も select しない）。

import "server-only";

import { requireSystemAdmin } from "@/lib/system-admin/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { Prisma, UserStatus } from "@solar/db";

/** 利用可能サイトはロールから決まる。ロール表（can.ts）と同じ考え方で分類する。 */
export function sitesForRoles(roles: string[], tenantType: string): string[] {
  const out: string[] = [];
  if (roles.includes("SAAS_ADMIN")) out.push("systemAdmin");
  if (tenantType === "WHOLESALER" && roles.some((r) => r !== "SAAS_ADMIN")) out.push("agency");
  if (tenantType === "DEALER") {
    out.push("partner");
    if (roles.includes("DEALER_ADMIN")) out.push("partnerAdmin");
  }
  return out;
}

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  companyId: string;
  companyName: string;
  companyType: string;
  roles: string[];
  sites: string[];
  status: string;
  lastLoginAt: string | null;
  salespersonName: string | null;
}

export interface UserListResult {
  rows: UserListItem[];
  total: number;
  page: number;
  pages: number;
}

export interface UserListQuery {
  q?: string;
  companyId?: string;
  status?: string;
  page?: number;
}

const PAGE_SIZE = 20;

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  status: true,
  lastLoginAt: true,
  tenant: { select: { id: true, name: true, type: true } },
  roles: { select: { role: true } },
  salesperson: { select: { name: true } },
} as const;

export async function listUsers(query: UserListQuery): Promise<UserListResult> {
  const { ctx } = await requireSystemAdmin("system_admin.user.read");
  const page = Math.max(1, query.page ?? 1);

  return withTenant(ctx, async (tx) => {
    const status = ["INVITED", "ACTIVE", "SUSPENDED", "LOCKED"].includes(query.status ?? "")
      ? (query.status as UserStatus)
      : undefined;
    const where: Prisma.UserWhereInput = {
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { email: { contains: query.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(query.companyId ? { tenantId: query.companyId } : {}),
      ...(status ? { status } : {}),
    };

    const [total, rows] = await Promise.all([
      tx.user.count({ where }),
      tx.user.findMany({
        where,
        orderBy: [{ createdAt: "asc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: USER_SELECT,
      }),
    ]);

    return {
      rows: rows.map((u) => {
        const roles = u.roles.map((r) => r.role as string);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          companyId: u.tenant.id,
          companyName: u.tenant.name,
          companyType: u.tenant.type,
          roles,
          sites: sitesForRoles(roles, u.tenant.type),
          status: u.status,
          lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
          salespersonName: u.salesperson?.name ?? null,
        };
      }),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  });
}

export interface UserDetail extends UserListItem {
  createdAt: string;
  /** この利用者に関する操作履歴（直近）。 */
  recentAudit: {
    id: string;
    createdAt: string;
    action: string;
    targetType: string;
    actorName: string | null;
  }[];
}

export async function getUser(id: string): Promise<UserDetail | null> {
  const { ctx } = await requireSystemAdmin("system_admin.user.read");

  return withTenant(ctx, async (tx) => {
    const u = await tx.user.findUnique({
      where: { id },
      select: { ...USER_SELECT, createdAt: true },
    });
    if (!u) return null;

    const audit = await tx.auditLog.findMany({
      where: { targetType: "User", targetId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, createdAt: true, action: true, targetType: true, actorUserId: true },
    });
    const actorIds = [...new Set(audit.map((a) => a.actorUserId).filter((x): x is string => !!x))];
    const actors =
      actorIds.length > 0
        ? await tx.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, name: true },
          })
        : [];
    const actorName = new Map(actors.map((a) => [a.id, a.name]));

    const roles = u.roles.map((r) => r.role as string);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      companyId: u.tenant.id,
      companyName: u.tenant.name,
      companyType: u.tenant.type,
      roles,
      sites: sitesForRoles(roles, u.tenant.type),
      status: u.status,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      salespersonName: u.salesperson?.name ?? null,
      createdAt: u.createdAt.toISOString(),
      recentAudit: audit.map((a) => ({
        id: a.id.toString(),
        createdAt: a.createdAt.toISOString(),
        action: a.action,
        targetType: a.targetType,
        actorName: a.actorUserId ? (actorName.get(a.actorUserId) ?? null) : null,
      })),
    };
  });
}

/** 絞り込み用の会社候補。 */
export async function listCompanyOptions(): Promise<{ id: string; name: string }[]> {
  const { ctx } = await requireSystemAdmin("system_admin.user.read");
  return withTenant(ctx, (tx) =>
    tx.tenant.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  );
}
