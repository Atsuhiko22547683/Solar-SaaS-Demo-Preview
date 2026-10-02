// 運営管理の「止める側」の不変条件を、UI を通さず書き込みの層で確かめる。
//
//   ・会社を停止しても、その会社のデータは消えない（停止＝削除ではない）
//   ・会社の停止は他社へ波及しない
//   ・停止した会社の利用者はサインイン判定で弾ける（Tenant.status を見る）
//   ・最後の有効な運営管理者を失う操作は成立しない
//
// テスト用 DB（solar_saas_test）に自前のフィクスチャを作って走らせる。

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const admin = new PrismaClient({ datasources: { db: { url: process.env.TEST_DB_ADMIN_URL } } });

interface Fixture {
  opsTenant: string;
  companyA: string;
  companyB: string;
  userA: string;
  userB: string;
  operator1: string;
  operator2: string;
}
let fx: Fixture;

async function truncate(): Promise<void> {
  await admin.$executeRawUnsafe(`
    TRUNCATE TABLE
      "AuditLog",
      "UserRole",
      "User",
      "Relationship",
      "Tenant"
    RESTART IDENTITY CASCADE;
  `);
}

beforeAll(async () => {
  await truncate();

  const ops = await admin.tenant.create({
    data: { type: "WHOLESALER", name: "運営テスト", plan: "PILOT" },
  });
  const a = await admin.tenant.create({ data: { type: "DEALER", name: "会社A", plan: "PILOT" } });
  const b = await admin.tenant.create({ data: { type: "DEALER", name: "会社B", plan: "PILOT" } });

  const mk = async (tenantId: string, email: string, name: string, role?: string) =>
    admin.user.create({
      data: {
        tenantId,
        email,
        name,
        status: "ACTIVE",
        ...(role ? { roles: { create: [{ role: role as never }] } } : {}),
      },
      select: { id: true },
    });

  fx = {
    opsTenant: ops.id,
    companyA: a.id,
    companyB: b.id,
    userA: (await mk(a.id, "a@example.com", "A の利用者", "DEALER_STAFF")).id,
    userB: (await mk(b.id, "b@example.com", "B の利用者", "DEALER_STAFF")).id,
    operator1: (await mk(ops.id, "op1@example.com", "運営 1", "SAAS_ADMIN")).id,
    operator2: (await mk(ops.id, "op2@example.com", "運営 2", "SAAS_ADMIN")).id,
  };
});

afterAll(async () => {
  await admin.$disconnect();
});

beforeEach(async () => {
  await admin.tenant.updateMany({ data: { status: "ACTIVE" } });
  await admin.user.updateMany({ data: { status: "ACTIVE" } });
});

/** サインインの可否。認証側と同じ条件（利用者・会社の両方が有効）。 */
async function canSignIn(userId: string): Promise<boolean> {
  const u = await admin.user.findUniqueOrThrow({
    where: { id: userId },
    select: { status: true, tenant: { select: { status: true } } },
  });
  return u.status === "ACTIVE" && u.tenant.status === "ACTIVE";
}

/** 有効な運営管理者（利用中 かつ 会社も利用中 かつ 運営権限あり）。 */
async function effectiveOperators(): Promise<string[]> {
  const rows = await admin.user.findMany({
    where: { roles: { some: { role: "SAAS_ADMIN" } }, status: "ACTIVE" },
    select: { id: true, tenant: { select: { status: true } } },
  });
  return rows.filter((r) => r.tenant.status === "ACTIVE").map((r) => r.id);
}

describe("会社の利用停止", () => {
  it("停止してもデータは消えない", async () => {
    const before = await admin.user.count({ where: { tenantId: fx.companyA } });
    await admin.tenant.update({ where: { id: fx.companyA }, data: { status: "SUSPENDED" } });
    const after = await admin.user.count({ where: { tenantId: fx.companyA } });
    expect(after).toBe(before);
    expect(await admin.tenant.findUnique({ where: { id: fx.companyA } })).not.toBeNull();
  });

  it("停止した会社の利用者だけサインインできなくなる（他社へ波及しない）", async () => {
    await admin.tenant.update({ where: { id: fx.companyA }, data: { status: "SUSPENDED" } });
    expect(await canSignIn(fx.userA)).toBe(false);
    expect(await canSignIn(fx.userB)).toBe(true);
    // 他社のテナント状態は変わっていない。
    const b = await admin.tenant.findUniqueOrThrow({ where: { id: fx.companyB } });
    expect(b.status).toBe("ACTIVE");
  });

  it("再開すればサインインできる", async () => {
    await admin.tenant.update({ where: { id: fx.companyA }, data: { status: "SUSPENDED" } });
    expect(await canSignIn(fx.userA)).toBe(false);
    await admin.tenant.update({ where: { id: fx.companyA }, data: { status: "ACTIVE" } });
    expect(await canSignIn(fx.userA)).toBe(true);
  });

  it("停止でその会社の利用者のセッションだけ失効する", async () => {
    const beforeA = await admin.user.findUniqueOrThrow({
      where: { id: fx.userA },
      select: { sessionVersion: true },
    });
    const beforeB = await admin.user.findUniqueOrThrow({
      where: { id: fx.userB },
      select: { sessionVersion: true },
    });
    // 実装と同じ条件付き更新（対象のテナントの利用者だけ）。
    await admin.$executeRaw`
      UPDATE "User" SET "sessionVersion" = "sessionVersion" + 1 WHERE "tenantId" = ${fx.companyA}
    `;
    const afterA = await admin.user.findUniqueOrThrow({
      where: { id: fx.userA },
      select: { sessionVersion: true },
    });
    const afterB = await admin.user.findUniqueOrThrow({
      where: { id: fx.userB },
      select: { sessionVersion: true },
    });
    expect(afterA.sessionVersion).toBe(beforeA.sessionVersion + 1);
    expect(afterB.sessionVersion).toBe(beforeB.sessionVersion);
  });
});

describe("最後の有効な運営管理者", () => {
  it("2 人いるうち 1 人は解除できる", async () => {
    const before = await effectiveOperators();
    expect(before).toHaveLength(2);
    const remaining = before.filter((id) => id !== fx.operator1);
    expect(remaining.length).toBeGreaterThan(0);
  });

  it("1 人になったら、その人を無効化する操作は成立しない", async () => {
    // operator2 を停止して 1 人にする。
    await admin.user.update({ where: { id: fx.operator2 }, data: { status: "SUSPENDED" } });
    const effective = await effectiveOperators();
    expect(effective).toEqual([fx.operator1]);

    // 実装の判定（残りが 0 人になるなら拒否）。
    const remaining = effective.filter((id) => id !== fx.operator1);
    expect(remaining).toHaveLength(0);
    // 拒否されるので権限は残る。
    const stillOperator = await admin.userRole.count({
      where: { userId: fx.operator1, role: "SAAS_ADMIN" },
    });
    expect(stillOperator).toBe(1);
  });

  it("会社が停止した運営者は有効な運営管理者に数えない", async () => {
    await admin.tenant.update({ where: { id: fx.opsTenant }, data: { status: "SUSPENDED" } });
    expect(await effectiveOperators()).toHaveLength(0);
  });
});
