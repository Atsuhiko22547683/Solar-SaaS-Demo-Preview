// 運営者管理の読み取り。
//
// 運営者＝運営権限（SAAS_ADMIN ロール）を持つ利用者。別テーブルは作らない。

import "server-only";

import { requireSystemAdmin } from "@/lib/system-admin/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

export interface OperatorRow {
  id: string;
  name: string;
  email: string;
  status: string;
  lastLoginAt: string | null;
  companyName: string;
  /** 有効な運営者か（利用中かつ運営権限あり）。最後の 1 人を守る判定に使う。 */
  isEffective: boolean;
}

export interface OperatorListResult {
  rows: OperatorRow[];
  /** 有効な運営管理者の数。1 人のときは無効化の操作を止める。 */
  effectiveCount: number;
}

export async function listOperators(): Promise<OperatorListResult> {
  const { ctx } = await requireSystemAdmin("system_admin.operator.read");

  return withTenant(ctx, async (tx) => {
    const rows = await tx.user.findMany({
      where: { roles: { some: { role: "SAAS_ADMIN" } } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        lastLoginAt: true,
        tenant: { select: { name: true, status: true } },
      },
    });

    const mapped = rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      status: u.status as string,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      companyName: u.tenant.name,
      // 会社が停止していればサインインできないので、有効な運営者に数えない。
      isEffective: u.status === "ACTIVE" && u.tenant.status === "ACTIVE",
    }));

    return { rows: mapped, effectiveCount: mapped.filter((r) => r.isEffective).length };
  });
}

/** 運営権限を付与できる候補（まだ運営者でない利用中の利用者）。 */
export async function listGrantCandidates(): Promise<
  { id: string; name: string; email: string; companyName: string }[]
> {
  const { ctx } = await requireSystemAdmin("system_admin.operator.read");
  return withTenant(ctx, async (tx) => {
    const rows = await tx.user.findMany({
      where: { status: "ACTIVE", roles: { none: { role: "SAAS_ADMIN" } } },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: { id: true, name: true, email: true, tenant: { select: { name: true } } },
    });
    return rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      companyName: u.tenant.name,
    }));
  });
}

/** 運営者を招待するときの所属先（運営会社）。 */
export async function listOperatorTenants(): Promise<{ id: string; name: string }[]> {
  const { ctx } = await requireSystemAdmin("system_admin.operator.read");
  return withTenant(ctx, (tx) =>
    tx.tenant.findMany({
      where: { type: "WHOLESALER" },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    }),
  );
}
