// 会社管理の読み取り。
//
// 会社をまたぐ取得は requireSystemAdmin() を通したこの関数だけが行う。
// 代理店 1 社・複数パートナーの前提なので、代理店との関係は Relationship から引く。

import "server-only";

import { requireSystemAdmin } from "@/lib/system-admin/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { Prisma, TenantStatus, TenantType } from "@solar/db";

export interface CompanyListItem {
  id: string;
  name: string;
  type: "WHOLESALER" | "DEALER";
  status: "ACTIVE" | "SUSPENDED";
  userCount: number;
  /** 代理店との関係（パートナー会社のみ）。代理店本体は null。 */
  relationWith: string | null;
  contactEmail: string | null;
  createdAt: string;
}

export interface CompanyListResult {
  rows: CompanyListItem[];
  total: number;
  page: number;
  pages: number;
}

export interface CompanyListQuery {
  q?: string;
  type?: string;
  status?: string;
  page?: number;
}

const PAGE_SIZE = 20;

/** 会社の連絡先。Tenant に専用列が無いので、管理者利用者のメールを連絡先として出す。 */
async function contactEmails(
  tx: Parameters<Parameters<typeof withTenant>[1]>[0],
  tenantIds: string[],
): Promise<Map<string, string>> {
  if (tenantIds.length === 0) return new Map();
  const rows = await tx.user.findMany({
    where: { tenantId: { in: tenantIds } },
    orderBy: { createdAt: "asc" },
    select: { tenantId: true, email: true },
  });
  const out = new Map<string, string>();
  for (const r of rows) if (!out.has(r.tenantId)) out.set(r.tenantId, r.email);
  return out;
}

export async function listCompanies(query: CompanyListQuery): Promise<CompanyListResult> {
  const { ctx } = await requireSystemAdmin("system_admin.company.read");
  const page = Math.max(1, query.page ?? 1);

  return withTenant(ctx, async (tx) => {
    // 値域外の絞り込みは「条件なし」に倒す（URL 直打ちで where を壊さない）。
    const where: Prisma.TenantWhereInput = {
      ...(query.q ? { name: { contains: query.q, mode: "insensitive" } } : {}),
      ...(query.type === "WHOLESALER" || query.type === "DEALER"
        ? { type: query.type as TenantType }
        : {}),
      ...(query.status === "ACTIVE" || query.status === "SUSPENDED"
        ? { status: query.status as TenantStatus }
        : {}),
    };

    const [total, rows] = await Promise.all([
      tx.tenant.count({ where }),
      tx.tenant.findMany({
        where,
        orderBy: [{ type: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          createdAt: true,
          _count: { select: { users: true } },
          asDealer: {
            where: { status: "ACTIVE" },
            select: { wholesaler: { select: { name: true } } },
          },
        },
      }),
    ]);

    const emails = await contactEmails(
      tx,
      rows.map((r) => r.id),
    );

    return {
      rows: rows.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type as "WHOLESALER" | "DEALER",
        status: r.status as "ACTIVE" | "SUSPENDED",
        userCount: r._count.users,
        relationWith: r.asDealer[0]?.wholesaler.name ?? null,
        contactEmail: emails.get(r.id) ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  });
}

export interface CompanyDetail extends CompanyListItem {
  /** 停止・再開したときに影響する範囲。実行前に確認して出す。 */
  impact: { users: number; relationships: number };
  users: { id: string; name: string; email: string; status: string }[];
  /** この会社に関する操作履歴（直近）。 */
  recentAudit: {
    id: string;
    createdAt: string;
    action: string;
    targetType: string;
    targetId: string;
    actorName: string | null;
  }[];
}

export async function getCompany(id: string): Promise<CompanyDetail | null> {
  const { ctx } = await requireSystemAdmin("system_admin.company.read");

  return withTenant(ctx, async (tx) => {
    const row = await tx.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        createdAt: true,
        _count: { select: { users: true } },
        asDealer: { select: { id: true, status: true, wholesaler: { select: { name: true } } } },
        asWholesaler: { select: { id: true } },
        users: {
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, email: true, status: true },
        },
      },
    });
    if (!row) return null;

    const audit = await tx.auditLog.findMany({
      where: { OR: [{ tenantId: id }, { targetType: "Tenant", targetId: id }] },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        createdAt: true,
        action: true,
        targetType: true,
        targetId: true,
        actorUserId: true,
      },
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

    return {
      id: row.id,
      name: row.name,
      type: row.type as "WHOLESALER" | "DEALER",
      status: row.status as "ACTIVE" | "SUSPENDED",
      userCount: row._count.users,
      relationWith: row.asDealer.find((r) => r.status === "ACTIVE")?.wholesaler.name ?? null,
      contactEmail: row.users[0]?.email ?? null,
      createdAt: row.createdAt.toISOString(),
      impact: {
        users: row._count.users,
        relationships: row.asDealer.length + row.asWholesaler.length,
      },
      users: row.users,
      recentAudit: audit.map((a) => ({
        id: a.id.toString(),
        createdAt: a.createdAt.toISOString(),
        action: a.action,
        targetType: a.targetType,
        targetId: a.targetId,
        actorName: a.actorUserId ? (actorName.get(a.actorUserId) ?? null) : null,
      })),
    };
  });
}

/** パートナー会社を追加するときの取引先（代理店）候補。前提は代理店 1 社。 */
export async function listWholesalerOptions(): Promise<{ id: string; name: string }[]> {
  const { ctx } = await requireSystemAdmin("system_admin.company.read");
  return withTenant(ctx, (tx) =>
    tx.tenant.findMany({
      where: { type: "WHOLESALER", status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
  );
}
