// DealerCommissionRate の RLS を PostgreSQL レベルで直接検証する。
//
// 二次店ポータルの「手数料管理」で、二次店が自社に適用されている手数料率を
// 読めるようにした（20260924000000_dealer_commission_rate_dealer_read）。
// 追加したのは SELECT 専用のポリシーなので、
//   - 自社の行は読める
//   - 他社の行は読めない
//   - 二次店からは更新も削除もできない（率を決めるのは代理店の業務）
//   - 代理店側の既存の挙動は変わらない
// の 4 点を DB 側で固定する。
//
// 二次店セッションでは app.current_wholesaler_id が空のことがある
// （取引先を 1 社しか持たない二次店は代理店切り替えを通らない）。
// この状態でも読めることが今回の要点なので、wholesalerId を持たない
// コンテキストで検証する。

import { execSync } from "node:child_process";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withTenant, type TenantContext } from "../src/index.js";

const ADMIN_URL = process.env.TEST_DB_ADMIN_URL!;
const APP_URL = process.env.TEST_DB_APP_URL!;
const REQUIRED_DB_NAME = "solar_saas_test";

if (!ADMIN_URL?.includes(REQUIRED_DB_NAME) || !APP_URL?.includes(REQUIRED_DB_NAME)) {
  throw new Error(
    `dealer-commission-rate-isolation tests refuse to run: TEST_DB_* must target '${REQUIRED_DB_NAME}'.`,
  );
}

const admin = new PrismaClient({ datasourceUrl: ADMIN_URL, log: ["error"] });

interface Fixture {
  wholesalerA: string;
  dealerAlpha: string;
  dealerBeta: string;
  userAlpha: string;
  userBeta: string;
  userA: string;
  relAAlpha: string;
  relABeta: string;
  rateAlpha: string;
  rateBeta: string;
}

let f: Fixture;

/** 取引先の代理店を選んでいない二次店セッション（wholesalerId なし）。 */
function dealerCtx(
  dealerId: string,
  relationshipIds: string[],
  actorUserId: string,
): TenantContext {
  return {
    tenantId: dealerId,
    dealerId,
    relationshipIds,
    isSaasAdmin: false,
    actorUserId,
  };
}

function wholesalerCtx(wholesalerId: string, actorUserId: string): TenantContext {
  return {
    tenantId: wholesalerId,
    wholesalerId,
    relationshipIds: [],
    isSaasAdmin: false,
    actorUserId,
  };
}

beforeAll(async () => {
  execSync("pnpm prisma migrate deploy --schema=prisma/schema.prisma", {
    cwd: resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: ADMIN_URL, DATABASE_URL_DIRECT: ADMIN_URL },
    stdio: "inherit",
  });
  await admin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO app_user;`);
  await admin.$executeRawUnsafe(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;`,
  );
  await admin.$executeRawUnsafe(
    `TRUNCATE TABLE "DealerCommissionRateChange", "DealerCommissionRate", "Relationship", "UserRole", "User", "WholesalerSettings", "Tenant" RESTART IDENTITY CASCADE;`,
  );

  const wA = await admin.tenant.create({
    data: { type: "WHOLESALER", name: "卸 A", plan: "PILOT" },
  });
  const dAlpha = await admin.tenant.create({ data: { type: "DEALER", name: "二次店アルファ" } });
  const dBeta = await admin.tenant.create({ data: { type: "DEALER", name: "二次店ベータ" } });

  const mkUser = (tenantId: string, email: string) =>
    admin.user.create({
      data: { tenantId, email, name: email, status: "ACTIVE", passwordHash: "x" },
    });
  const uA = await mkUser(wA.id, "a@example.com");
  const uAlpha = await mkUser(dAlpha.id, "alpha@example.com");
  const uBeta = await mkUser(dBeta.id, "beta@example.com");

  // 同じ代理店の配下に 2 つの二次店。二次店同士が見えないことを確かめるため。
  const relAAlpha = await admin.relationship.create({
    data: { wholesalerId: wA.id, dealerId: dAlpha.id, franchiseNo: "ERP01" },
  });
  const relABeta = await admin.relationship.create({
    data: { wholesalerId: wA.id, dealerId: dBeta.id, franchiseNo: "ERP02" },
  });

  const base = { applyFrom: new Date("2026-04-01T00:00:00Z"), updatedByUserId: uA.id };
  const rateAlpha = await admin.dealerCommissionRate.create({
    data: {
      ...base,
      wholesalerId: wA.id,
      relationshipId: relAAlpha.id,
      tossUpRate: 5,
      closingRate: 12,
    },
  });
  const rateBeta = await admin.dealerCommissionRate.create({
    data: {
      ...base,
      wholesalerId: wA.id,
      relationshipId: relABeta.id,
      tossUpRate: 6,
      closingRate: 14,
    },
  });

  f = {
    wholesalerA: wA.id,
    dealerAlpha: dAlpha.id,
    dealerBeta: dBeta.id,
    userAlpha: uAlpha.id,
    userBeta: uBeta.id,
    userA: uA.id,
    relAAlpha: relAAlpha.id,
    relABeta: relABeta.id,
    rateAlpha: rateAlpha.id,
    rateBeta: rateBeta.id,
  };
});

afterAll(async () => {
  await admin.$disconnect();
});

const alphaCtx = () => dealerCtx(f.dealerAlpha, [f.relAAlpha], f.userAlpha);
const betaCtx = () => dealerCtx(f.dealerBeta, [f.relABeta], f.userBeta);

describe("DealerCommissionRate — 二次店のスコープ", () => {
  it("自社の手数料率は SELECT できる（代理店を選んでいなくても）", async () => {
    const rows = await withTenant(alphaCtx(), (tx) => tx.dealerCommissionRate.findMany());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(f.rateAlpha);
    expect(rows[0]!.tossUpRate.toString()).toBe("5");
  });

  it("同じ代理店配下でも、他の二次店の手数料率は SELECT できない", async () => {
    const row = await withTenant(alphaCtx(), (tx) =>
      tx.dealerCommissionRate.findUnique({ where: { id: f.rateBeta } }),
    );
    expect(row).toBeNull();

    const rows = await withTenant(betaCtx(), (tx) => tx.dealerCommissionRate.findMany());
    expect(rows.map((r) => r.id)).toEqual([f.rateBeta]);
  });

  it("二次店は自社の手数料率でも UPDATE できない", async () => {
    await expect(
      withTenant(alphaCtx(), (tx) =>
        tx.dealerCommissionRate.update({
          where: { id: f.rateAlpha },
          data: { closingRate: 99 },
        }),
      ),
    ).rejects.toThrow();
    const row = await admin.dealerCommissionRate.findUnique({ where: { id: f.rateAlpha } });
    expect(row!.closingRate.toString()).toBe("12");
  });

  it("二次店は自社の手数料率でも DELETE できない", async () => {
    await expect(
      withTenant(alphaCtx(), (tx) =>
        tx.dealerCommissionRate.delete({ where: { id: f.rateAlpha } }),
      ),
    ).rejects.toThrow();
    const row = await admin.dealerCommissionRate.findUnique({ where: { id: f.rateAlpha } });
    expect(row).not.toBeNull();
  });

  it("二次店は手数料率を INSERT できない（WITH CHECK）", async () => {
    await expect(
      withTenant(alphaCtx(), (tx) =>
        tx.dealerCommissionRate.create({
          data: {
            wholesalerId: f.wholesalerA,
            relationshipId: f.relAAlpha,
            tossUpRate: 50,
            closingRate: 50,
            applyFrom: new Date("2026-05-01T00:00:00Z"),
            updatedByUserId: f.userAlpha,
          },
        }),
      ),
    ).rejects.toThrow();
  });
});

describe("DealerCommissionRate — 代理店の挙動は変わらない", () => {
  it("代理店は配下の二次店の手数料率をすべて SELECT できる", async () => {
    const rows = await withTenant(wholesalerCtx(f.wholesalerA, f.userA), (tx) =>
      tx.dealerCommissionRate.findMany({ orderBy: { tossUpRate: "asc" } }),
    );
    expect(rows.map((r) => r.id).sort()).toEqual([f.rateAlpha, f.rateBeta].sort());
  });

  it("代理店は手数料率を UPDATE できる", async () => {
    await withTenant(wholesalerCtx(f.wholesalerA, f.userA), (tx) =>
      tx.dealerCommissionRate.update({ where: { id: f.rateBeta }, data: { closingRate: 15 } }),
    );
    const row = await admin.dealerCommissionRate.findUnique({ where: { id: f.rateBeta } });
    expect(row!.closingRate.toString()).toBe("15");
  });
});
