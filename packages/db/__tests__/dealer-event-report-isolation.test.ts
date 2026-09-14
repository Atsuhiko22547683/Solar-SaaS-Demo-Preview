// DealerEventReport の RLS を PostgreSQL レベルで直接検証する（T-Partner）。
//
// アプリ層（requirePartnerContext / where 句）を通さず、GUC を直接立てて
// app_user 権限で SELECT / INSERT / UPDATE / DELETE を叩く。アプリ側の検証が
// 将来抜けても、DB がテナント境界を守ることを保証するのが目的。
//
// 検証する分岐（ポリシー "DealerEventReport_isolation"）:
//   a. SaaS 運営者      … 全件
//   b. 代理店（卸業者）  … 自社に紐づく Relationship の日報だけ
//   c. 二次店            … 自社の relationshipId の日報だけ
//   d. テナント情報なし  … 何も見えない
//
// あわせて WITH CHECK（INSERT / UPDATE の書き込み側）と、
// relationshipId と wholesalerId の整合性（他社配下に別代理店の ID を紐付けない）
// も確認する。

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
    `dealer-event-report-isolation tests refuse to run: TEST_DB_* must target '${REQUIRED_DB_NAME}'.`,
  );
}

const admin = new PrismaClient({ datasourceUrl: ADMIN_URL, log: ["error"] });

interface Fixture {
  wholesalerA: string;
  wholesalerB: string;
  dealerAlpha: string;
  dealerBeta: string;
  userAlpha: string;
  userBeta: string;
  userA: string;
  userB: string;
  /** A ↔ アルファ */
  relAAlpha: string;
  /** B ↔ ベータ */
  relBBeta: string;
  reportAlpha: string;
  reportBeta: string;
}

let f: Fixture;

function dealerCtx(fx: {
  dealerId: string;
  wholesalerId: string;
  relationshipIds: string[];
  actorUserId: string;
}): TenantContext {
  return {
    tenantId: fx.dealerId,
    dealerId: fx.dealerId,
    wholesalerId: fx.wholesalerId,
    relationshipIds: fx.relationshipIds,
    isSaasAdmin: false,
    actorUserId: fx.actorUserId,
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

const BASE_REPORT = {
  eventDate: new Date("2026-04-01T00:00:00Z"),
  venuePlace: "テスト会場",
  category: "HOUSING_EQUIPMENT" as const,
  venueChain: "CAINZ_V" as const,
  areaInFacility: "入口",
  startTime: "10:00",
  endTime: "18:00",
  lotteryBoth: 1,
  lotterySingle: 1,
  seatedBoth: 1,
  seatedSingle: 1,
  apptBoth: 1,
  apptSingle: 1,
};

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
    `TRUNCATE TABLE "DealerEventReport", "Relationship", "UserRole", "User", "WholesalerSettings", "Tenant" RESTART IDENTITY CASCADE;`,
  );

  const wA = await admin.tenant.create({
    data: { type: "WHOLESALER", name: "卸 A", plan: "PILOT" },
  });
  const wB = await admin.tenant.create({
    data: { type: "WHOLESALER", name: "卸 B", plan: "PILOT" },
  });
  const dAlpha = await admin.tenant.create({ data: { type: "DEALER", name: "二次店アルファ" } });
  const dBeta = await admin.tenant.create({ data: { type: "DEALER", name: "二次店ベータ" } });

  const mkUser = (tenantId: string, email: string) =>
    admin.user.create({
      data: { tenantId, email, name: email, status: "ACTIVE", passwordHash: "x" },
    });
  const uA = await mkUser(wA.id, "a@example.com");
  const uB = await mkUser(wB.id, "b@example.com");
  const uAlpha = await mkUser(dAlpha.id, "alpha@example.com");
  const uBeta = await mkUser(dBeta.id, "beta@example.com");

  const relAAlpha = await admin.relationship.create({
    data: { wholesalerId: wA.id, dealerId: dAlpha.id, franchiseNo: "ERP01" },
  });
  const relBBeta = await admin.relationship.create({
    data: { wholesalerId: wB.id, dealerId: dBeta.id, franchiseNo: "ERP02" },
  });

  const rAlpha = await admin.dealerEventReport.create({
    data: {
      ...BASE_REPORT,
      wholesalerId: wA.id,
      relationshipId: relAAlpha.id,
      createdByUserId: uAlpha.id,
      venuePlace: "アルファ会場",
    },
  });
  const rBeta = await admin.dealerEventReport.create({
    data: {
      ...BASE_REPORT,
      wholesalerId: wB.id,
      relationshipId: relBBeta.id,
      createdByUserId: uBeta.id,
      venuePlace: "ベータ会場",
    },
  });

  f = {
    wholesalerA: wA.id,
    wholesalerB: wB.id,
    dealerAlpha: dAlpha.id,
    dealerBeta: dBeta.id,
    userAlpha: uAlpha.id,
    userBeta: uBeta.id,
    userA: uA.id,
    userB: uB.id,
    relAAlpha: relAAlpha.id,
    relBBeta: relBBeta.id,
    reportAlpha: rAlpha.id,
    reportBeta: rBeta.id,
  };
});

afterAll(async () => {
  await admin.$disconnect();
});

describe("二次店（DEALER）のスコープ", () => {
  it("自社の日報は SELECT できる", async () => {
    const ctx = dealerCtx({
      dealerId: f.dealerAlpha,
      wholesalerId: f.wholesalerA,
      relationshipIds: [f.relAAlpha],
      actorUserId: f.userAlpha,
    });
    const rows = await withTenant(ctx, (tx) => tx.dealerEventReport.findMany());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.venuePlace).toBe("アルファ会場");
  });

  it("他の二次店の日報は SELECT できない", async () => {
    const ctx = dealerCtx({
      dealerId: f.dealerAlpha,
      wholesalerId: f.wholesalerA,
      relationshipIds: [f.relAAlpha],
      actorUserId: f.userAlpha,
    });
    const row = await withTenant(ctx, (tx) =>
      tx.dealerEventReport.findUnique({ where: { id: f.reportBeta } }),
    );
    expect(row).toBeNull();
  });

  it("他の二次店の relationshipId では INSERT できない（WITH CHECK）", async () => {
    const ctx = dealerCtx({
      dealerId: f.dealerAlpha,
      wholesalerId: f.wholesalerA,
      relationshipIds: [f.relAAlpha],
      actorUserId: f.userAlpha,
    });
    await expect(
      withTenant(ctx, (tx) =>
        tx.dealerEventReport.create({
          data: {
            ...BASE_REPORT,
            wholesalerId: f.wholesalerB,
            relationshipId: f.relBBeta,
            createdByUserId: f.userAlpha,
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it("他の二次店の日報は UPDATE できない", async () => {
    const ctx = dealerCtx({
      dealerId: f.dealerAlpha,
      wholesalerId: f.wholesalerA,
      relationshipIds: [f.relAAlpha],
      actorUserId: f.userAlpha,
    });
    // 行が見えないので更新件数 0（例外ではなく「対象なし」になる）。
    const res = await withTenant(ctx, (tx) =>
      tx.dealerEventReport.updateMany({
        where: { id: f.reportBeta },
        data: { venuePlace: "改ざん" },
      }),
    );
    expect(res.count).toBe(0);

    const after = await admin.dealerEventReport.findUnique({ where: { id: f.reportBeta } });
    expect(after!.venuePlace).toBe("ベータ会場");
  });

  it("他の二次店の日報は DELETE できない", async () => {
    const ctx = dealerCtx({
      dealerId: f.dealerAlpha,
      wholesalerId: f.wholesalerA,
      relationshipIds: [f.relAAlpha],
      actorUserId: f.userAlpha,
    });
    const res = await withTenant(ctx, (tx) =>
      tx.dealerEventReport.deleteMany({ where: { id: f.reportBeta } }),
    );
    expect(res.count).toBe(0);
    expect(await admin.dealerEventReport.count({ where: { id: f.reportBeta } })).toBe(1);
  });

  it("自社の日報は UPDATE できる", async () => {
    const ctx = dealerCtx({
      dealerId: f.dealerAlpha,
      wholesalerId: f.wholesalerA,
      relationshipIds: [f.relAAlpha],
      actorUserId: f.userAlpha,
    });
    const res = await withTenant(ctx, (tx) =>
      tx.dealerEventReport.updateMany({
        where: { id: f.reportAlpha },
        data: { impression: "更新済み" },
      }),
    );
    expect(res.count).toBe(1);
  });

  it("自社の行を他社の relationshipId へ付け替えられない（WITH CHECK）", async () => {
    const ctx = dealerCtx({
      dealerId: f.dealerAlpha,
      wholesalerId: f.wholesalerA,
      relationshipIds: [f.relAAlpha],
      actorUserId: f.userAlpha,
    });
    await expect(
      withTenant(ctx, (tx) =>
        tx.dealerEventReport.update({
          where: { id: f.reportAlpha },
          data: { relationshipId: f.relBBeta },
        }),
      ),
    ).rejects.toThrow();
  });
});

describe("代理店（WHOLESALER）のスコープ", () => {
  it("自社配下の二次店の日報は閲覧できる", async () => {
    const ctx = wholesalerCtx(f.wholesalerA, f.userA);
    const rows = await withTenant(ctx, (tx) => tx.dealerEventReport.findMany());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(f.reportAlpha);
  });

  it("他の代理店配下の日報は閲覧できない", async () => {
    const ctx = wholesalerCtx(f.wholesalerA, f.userA);
    const row = await withTenant(ctx, (tx) =>
      tx.dealerEventReport.findUnique({ where: { id: f.reportBeta } }),
    );
    expect(row).toBeNull();
  });
});

describe("SaaS 運営者 / テナント未設定", () => {
  it("SaaS 運営者は全件見える（既存ポリシーと同じ方針）", async () => {
    const ctx: TenantContext = { isSaasAdmin: true, relationshipIds: [], actorUserId: f.userA };
    const rows = await withTenant(ctx, (tx) => tx.dealerEventReport.findMany());
    expect(rows).toHaveLength(2);
  });

  it("テナント情報が無ければ 1 件も見えない", async () => {
    const ctx: TenantContext = { isSaasAdmin: false, relationshipIds: [], actorUserId: f.userA };
    const rows = await withTenant(ctx, (tx) => tx.dealerEventReport.findMany());
    expect(rows).toHaveLength(0);
  });
});

describe("relationshipId と wholesalerId の整合性", () => {
  it("二次店は自社 relationship に別の代理店の wholesalerId を紐付けられない", async () => {
    const ctx = dealerCtx({
      dealerId: f.dealerAlpha,
      wholesalerId: f.wholesalerA,
      relationshipIds: [f.relAAlpha],
      actorUserId: f.userAlpha,
    });
    // relationshipId は自社（= RLS は通る）だが、wholesalerId が別代理店。
    // アプリ側の検証を通さずに直接書いても DB が拒否すること。
    await expect(
      withTenant(ctx, (tx) =>
        tx.dealerEventReport.create({
          data: {
            ...BASE_REPORT,
            wholesalerId: f.wholesalerB,
            relationshipId: f.relAAlpha,
            createdByUserId: f.userAlpha,
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it("整合した組み合わせは保存できる", async () => {
    const ctx = dealerCtx({
      dealerId: f.dealerAlpha,
      wholesalerId: f.wholesalerA,
      relationshipIds: [f.relAAlpha],
      actorUserId: f.userAlpha,
    });
    const created = await withTenant(ctx, (tx) =>
      tx.dealerEventReport.create({
        data: {
          ...BASE_REPORT,
          wholesalerId: f.wholesalerA,
          relationshipId: f.relAAlpha,
          createdByUserId: f.userAlpha,
          venuePlace: "整合テスト",
        },
        select: { id: true },
      }),
    );
    expect(created.id).toBeTruthy();
    await admin.dealerEventReport.delete({ where: { id: created.id } });
  });
});
