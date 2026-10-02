// DealerVisitAppointment / DealerContractReport の RLS を PostgreSQL レベルで
// 直接検証する（T-Partner 第 2 弾）。
//
// アプリ層（requirePartnerContext / where 句）を通さず、GUC を直接立てて
// app_user 権限で SELECT / INSERT / UPDATE を叩く。アプリ側の検証が将来抜けても、
// DB がテナント境界を守ることを保証するのが目的。
//
// 検証する分岐（既存 "DealerEventReport_isolation" と同じ 3 通り）:
//   a. SaaS 運営者      … 全件
//   b. 代理店（卸業者）  … 自社に紐づく Relationship の行だけ
//   c. 二次店            … 自社の relationshipId の行だけ
//   d. テナント情報なし  … 何も見えない
//
// あわせて WITH CHECK（書き込み側）と、外部キーの差し替えによる他社参照
// （relationshipId と wholesalerId の組み合わせ不整合）も確認する。

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
    `partner-submission-isolation tests refuse to run: TEST_DB_* must target '${REQUIRED_DB_NAME}'.`,
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
  relAAlpha: string;
  relBBeta: string;
  spAlpha: string;
  spBeta: string;
  visitAlpha: string;
  visitBeta: string;
  contractAlpha: string;
  contractBeta: string;
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

const BASE_VISIT = {
  tossDept: "第一営業部",
  maekakuOperator: "コール班 鈴木",
  closeDept: "クローズ第二課",
  salesChannel: "VISIT_SALES" as const,
};

const BASE_CONTRACT = {
  contractDate: new Date("2026-04-10T00:00:00Z"),
  tossDate: new Date("2026-04-01T00:00:00Z"),
  tossDept: "第一営業部",
  apptGetter: "佐々木 孝",
  salesRep: "鳥居 佑馬",
  referralBranch: "さいたま拠点",
  affiliation: "VE" as const,
  affiliationDept: "住設事業部",
  acquisitionChannel: "TELE_APPOINTMENT" as const,
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
    `TRUNCATE TABLE "DealerVisitAppointment", "DealerContractReport", "DealerEventReport", "Salesperson", "Relationship", "UserRole", "User", "WholesalerSettings", "Tenant" RESTART IDENTITY CASCADE;`,
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

  const spAlpha = await admin.salesperson.create({
    data: { wholesalerId: wA.id, relationshipId: relAAlpha.id, name: "アルファ担当" },
  });
  const spBeta = await admin.salesperson.create({
    data: { wholesalerId: wB.id, relationshipId: relBBeta.id, name: "ベータ担当" },
  });

  const vAlpha = await admin.dealerVisitAppointment.create({
    data: {
      ...BASE_VISIT,
      wholesalerId: wA.id,
      relationshipId: relAAlpha.id,
      createdByUserId: uAlpha.id,
      salespersonId: spAlpha.id,
      closeDept: "アルファ クローズ課",
    },
  });
  const vBeta = await admin.dealerVisitAppointment.create({
    data: {
      ...BASE_VISIT,
      wholesalerId: wB.id,
      relationshipId: relBBeta.id,
      createdByUserId: uBeta.id,
      salespersonId: spBeta.id,
      closeDept: "ベータ クローズ課",
    },
  });

  const kAlpha = await admin.dealerContractReport.create({
    data: {
      ...BASE_CONTRACT,
      wholesalerId: wA.id,
      relationshipId: relAAlpha.id,
      createdByUserId: uAlpha.id,
      referralBranch: "アルファ拠点",
    },
  });
  const kBeta = await admin.dealerContractReport.create({
    data: {
      ...BASE_CONTRACT,
      wholesalerId: wB.id,
      relationshipId: relBBeta.id,
      createdByUserId: uBeta.id,
      referralBranch: "ベータ拠点",
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
    spAlpha: spAlpha.id,
    spBeta: spBeta.id,
    visitAlpha: vAlpha.id,
    visitBeta: vBeta.id,
    contractAlpha: kAlpha.id,
    contractBeta: kBeta.id,
  };
});

afterAll(async () => {
  await admin.$disconnect();
});

const alphaCtx = () =>
  dealerCtx({
    dealerId: f.dealerAlpha,
    wholesalerId: f.wholesalerA,
    relationshipIds: [f.relAAlpha],
    actorUserId: f.userAlpha,
  });

describe("DealerVisitAppointment — 二次店のスコープ", () => {
  it("自社の訪問アポは SELECT できる", async () => {
    const rows = await withTenant(alphaCtx(), (tx) => tx.dealerVisitAppointment.findMany());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.closeDept).toBe("アルファ クローズ課");
  });

  it("他社の訪問アポは SELECT できない", async () => {
    const row = await withTenant(alphaCtx(), (tx) =>
      tx.dealerVisitAppointment.findUnique({ where: { id: f.visitBeta } }),
    );
    expect(row).toBeNull();
  });

  it("自社の訪問アポは UPDATE できる", async () => {
    await withTenant(alphaCtx(), (tx) =>
      tx.dealerVisitAppointment.update({
        where: { id: f.visitAlpha },
        data: { tossDept: "更新後の部署" },
      }),
    );
    const row = await admin.dealerVisitAppointment.findUnique({ where: { id: f.visitAlpha } });
    expect(row!.tossDept).toBe("更新後の部署");
  });

  it("他社の訪問アポは UPDATE できない", async () => {
    await expect(
      withTenant(alphaCtx(), (tx) =>
        tx.dealerVisitAppointment.update({
          where: { id: f.visitBeta },
          data: { tossDept: "乗っ取り" },
        }),
      ),
    ).rejects.toThrow();
    const row = await admin.dealerVisitAppointment.findUnique({ where: { id: f.visitBeta } });
    expect(row!.tossDept).toBe("第一営業部");
  });

  it("他社の relationshipId では INSERT できない（WITH CHECK）", async () => {
    await expect(
      withTenant(alphaCtx(), (tx) =>
        tx.dealerVisitAppointment.create({
          data: {
            ...BASE_VISIT,
            wholesalerId: f.wholesalerB,
            relationshipId: f.relBBeta,
            createdByUserId: f.userAlpha,
            salespersonId: f.spBeta,
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it("自社 relationship に別代理店の wholesalerId は紐付けられない（複合 FK）", async () => {
    await expect(
      withTenant(alphaCtx(), (tx) =>
        tx.dealerVisitAppointment.create({
          data: {
            ...BASE_VISIT,
            wholesalerId: f.wholesalerB,
            relationshipId: f.relAAlpha,
            createdByUserId: f.userAlpha,
            salespersonId: f.spAlpha,
          },
        }),
      ),
    ).rejects.toThrow();
  });
});

describe("DealerVisitAppointment — 代理店 / SaaS 運営者のスコープ", () => {
  it("自社配下の二次店の訪問アポは閲覧できる", async () => {
    const rows = await withTenant(wholesalerCtx(f.wholesalerA, f.userA), (tx) =>
      tx.dealerVisitAppointment.findMany(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(f.visitAlpha);
  });

  it("別代理店の訪問アポは閲覧できない", async () => {
    const rows = await withTenant(wholesalerCtx(f.wholesalerB, f.userB), (tx) =>
      tx.dealerVisitAppointment.findMany(),
    );
    expect(rows.map((r) => r.id)).toEqual([f.visitBeta]);
  });

  it("SaaS 運営者は全件見える（既存ポリシーと同じ方針）", async () => {
    const rows = await withTenant(
      {
        tenantId: f.wholesalerA,
        relationshipIds: [],
        isSaasAdmin: true,
        actorUserId: f.userA,
      },
      (tx) => tx.dealerVisitAppointment.findMany(),
    );
    expect(rows).toHaveLength(2);
  });

  it("テナント情報が無ければ 1 件も見えない", async () => {
    const rows = await withTenant(
      { tenantId: "", relationshipIds: [], isSaasAdmin: false, actorUserId: f.userA },
      (tx) => tx.dealerVisitAppointment.findMany(),
    );
    expect(rows).toHaveLength(0);
  });
});

describe("DealerContractReport — 二次店のスコープ", () => {
  it("自社の成約は SELECT できる", async () => {
    const rows = await withTenant(alphaCtx(), (tx) => tx.dealerContractReport.findMany());
    expect(rows).toHaveLength(1);
    expect(rows[0]!.referralBranch).toBe("アルファ拠点");
  });

  it("他社の成約は SELECT できない", async () => {
    const row = await withTenant(alphaCtx(), (tx) =>
      tx.dealerContractReport.findUnique({ where: { id: f.contractBeta } }),
    );
    expect(row).toBeNull();
  });

  it("自社の成約は UPDATE できる", async () => {
    await withTenant(alphaCtx(), (tx) =>
      tx.dealerContractReport.update({
        where: { id: f.contractAlpha },
        data: { referralBranch: "更新後の拠点" },
      }),
    );
    const row = await admin.dealerContractReport.findUnique({ where: { id: f.contractAlpha } });
    expect(row!.referralBranch).toBe("更新後の拠点");
  });

  it("他社の成約は UPDATE できない", async () => {
    await expect(
      withTenant(alphaCtx(), (tx) =>
        tx.dealerContractReport.update({
          where: { id: f.contractBeta },
          data: { referralBranch: "乗っ取り" },
        }),
      ),
    ).rejects.toThrow();
    const row = await admin.dealerContractReport.findUnique({ where: { id: f.contractBeta } });
    expect(row!.referralBranch).toBe("ベータ拠点");
  });

  it("他社の relationshipId では INSERT できない（WITH CHECK）", async () => {
    await expect(
      withTenant(alphaCtx(), (tx) =>
        tx.dealerContractReport.create({
          data: {
            ...BASE_CONTRACT,
            wholesalerId: f.wholesalerB,
            relationshipId: f.relBBeta,
            createdByUserId: f.userAlpha,
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it("自社 relationship に別代理店の wholesalerId は紐付けられない（複合 FK）", async () => {
    await expect(
      withTenant(alphaCtx(), (tx) =>
        tx.dealerContractReport.create({
          data: {
            ...BASE_CONTRACT,
            wholesalerId: f.wholesalerB,
            relationshipId: f.relAAlpha,
            createdByUserId: f.userAlpha,
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it("整合した組み合わせは保存できる", async () => {
    const created = await withTenant(alphaCtx(), (tx) =>
      tx.dealerContractReport.create({
        data: {
          ...BASE_CONTRACT,
          wholesalerId: f.wholesalerA,
          relationshipId: f.relAAlpha,
          createdByUserId: f.userAlpha,
          referralBranch: "追加拠点",
        },
      }),
    );
    expect(created.id).toBeTruthy();
    await admin.dealerContractReport.delete({ where: { id: created.id } });
  });
});

describe("DealerContractReport — 代理店 / SaaS 運営者のスコープ", () => {
  it("自社配下の二次店の成約は閲覧できる", async () => {
    const rows = await withTenant(wholesalerCtx(f.wholesalerA, f.userA), (tx) =>
      tx.dealerContractReport.findMany(),
    );
    expect(rows.map((r) => r.id)).toEqual([f.contractAlpha]);
  });

  it("別代理店の成約は閲覧できない", async () => {
    const rows = await withTenant(wholesalerCtx(f.wholesalerB, f.userB), (tx) =>
      tx.dealerContractReport.findMany(),
    );
    expect(rows.map((r) => r.id)).toEqual([f.contractBeta]);
  });

  it("SaaS 運営者は全件見える", async () => {
    const rows = await withTenant(
      { tenantId: f.wholesalerA, relationshipIds: [], isSaasAdmin: true, actorUserId: f.userA },
      (tx) => tx.dealerContractReport.findMany(),
    );
    expect(rows).toHaveLength(2);
  });

  it("テナント情報が無ければ 1 件も見えない", async () => {
    const rows = await withTenant(
      { tenantId: "", relationshipIds: [], isSaasAdmin: false, actorUserId: f.userA },
      (tx) => tx.dealerContractReport.findMany(),
    );
    expect(rows).toHaveLength(0);
  });
});
