// 複数代理店に対応した RLS を PostgreSQL レベルで直接検証する。
//
// アプリ層（requirePartnerContext / scope.ts の where 句）を通さず、GUC を直接立てて
// app_user 権限で読み書きする。アプリ側の絞り込みが将来抜けても、DB が境界を守ることを
// 確かめるのが目的。
//
// 確認すること（業務要件 §2・§3・§12⑧）:
//   - 1 つのパートナー会社が代理店 A・B の両方から依頼を受け、両方の催事を閲覧できる
//   - 代理店 A のセッションから代理店 B の案件は見えない（代理店間の境界）
//   - 無関係な他社（別パートナー会社）の催事・顧客・スタッフは見えない
//   - シフトは自社担当の催事ぶんだけ見える（代理店をまたいだ重複判定の根拠）
//   - 書き込み側（WITH CHECK）でも他社の catalogue を作れない

import { execSync } from "node:child_process";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

import { withTenant, type TenantContext } from "../src/index.js";

const ADMIN_URL = process.env.TEST_DB_ADMIN_URL!;
const APP_URL = process.env.TEST_DB_APP_URL!;
const REQUIRED_DB_NAME = "solar_saas_test";

if (!ADMIN_URL?.includes(REQUIRED_DB_NAME) || !APP_URL?.includes(REQUIRED_DB_NAME)) {
  throw new Error(
    `partner-multi-agency tests refuse to run: TEST_DB_* must target '${REQUIRED_DB_NAME}'.`,
  );
}

const admin = new PrismaClient({ datasourceUrl: ADMIN_URL, log: ["error"] });

interface Fixture {
  wA: string;
  wB: string;
  dealerAlpha: string;
  dealerOther: string;
  userAlpha: string;
  userOther: string;
  userWA: string;
  relAAlpha: string;
  relBAlpha: string;
  relAOther: string;
  eventA: string;
  eventB: string;
  eventOther: string;
  shiftA: string;
  shiftB: string;
  customerA: string;
  customerOther: string;
  spAlpha: string;
  spOther: string;
}

let f: Fixture;

/** パートナー側セッション。wholesalerId は持たない（AppRole が DEALER のため）。 */
function partnerCtx(
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

function agencyCtx(wholesalerId: string, actorUserId: string): TenantContext {
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
    `TRUNCATE TABLE "EventShift", "EventDay", "EventDealer", "Event", "EventCandidate",
       "Customer", "Salesperson", "Relationship", "UserRole", "User",
       "WholesalerSettings", "Tenant" RESTART IDENTITY CASCADE;`,
  );

  const wA = await admin.tenant.create({
    data: { type: "WHOLESALER", name: "代理店A", plan: "PILOT" },
  });
  const wB = await admin.tenant.create({
    data: { type: "WHOLESALER", name: "代理店B", plan: "PILOT" },
  });
  const alpha = await admin.tenant.create({ data: { type: "DEALER", name: "パートナーα" } });
  const other = await admin.tenant.create({ data: { type: "DEALER", name: "無関係パートナー" } });

  const mkUser = (tenantId: string, email: string) =>
    admin.user.create({
      data: { tenantId, email, name: email, status: "ACTIVE", passwordHash: "x" },
    });
  const uAlpha = await mkUser(alpha.id, "alpha@example.com");
  const uOther = await mkUser(other.id, "other@example.com");
  const uWA = await mkUser(wA.id, "wa@example.com");

  // α は代理店 A・B の両方から依頼を受ける（多対多）。
  const relAAlpha = await admin.relationship.create({
    data: { wholesalerId: wA.id, dealerId: alpha.id, status: "ACTIVE" },
  });
  const relBAlpha = await admin.relationship.create({
    data: { wholesalerId: wB.id, dealerId: alpha.id, status: "ACTIVE" },
  });
  const relAOther = await admin.relationship.create({
    data: { wholesalerId: wA.id, dealerId: other.id, status: "ACTIVE" },
  });

  const mkEvent = async (wholesalerId: string, relationshipId: string, store: string) => {
    const cand = await admin.eventCandidate.create({
      data: {
        wholesalerId,
        targetMonth: "2026-06",
        scheduledDate: new Date("2026-06-10T00:00:00Z"),
        storeName: store,
        deadlineAt: new Date("2026-06-01T00:00:00Z"),
        status: "DECIDED",
        createdBy: "seed",
      },
    });
    const ev = await admin.event.create({
      data: { wholesalerId, eventCandidateId: cand.id, mode: "DEALER", decidedBy: "seed" },
    });
    await admin.eventDealer.create({
      data: { eventId: ev.id, relationshipId, assignedBy: "seed" },
    });
    return ev.id;
  };

  const eventA = await mkEvent(wA.id, relAAlpha.id, "A社催事");
  const eventB = await mkEvent(wB.id, relBAlpha.id, "B社催事");
  const eventOther = await mkEvent(wA.id, relAOther.id, "他社催事");

  const shiftA = await admin.eventShift.create({
    data: {
      eventId: eventA,
      userId: uAlpha.id,
      role: "CATCH",
      startPlanned: new Date("2026-06-10T01:00:00Z"),
      endPlanned: new Date("2026-06-10T09:00:00Z"),
    },
  });
  const shiftB = await admin.eventShift.create({
    data: {
      eventId: eventB,
      userId: uAlpha.id,
      role: "TOSS",
      // A 社催事と重ならない日にする（EXCLUDE 制約に当たらないように）。
      startPlanned: new Date("2026-06-11T01:00:00Z"),
      endPlanned: new Date("2026-06-11T09:00:00Z"),
    },
  });

  const customerA = await admin.customer.create({
    data: {
      wholesalerId: wA.id,
      ownerRelationshipId: relAAlpha.id,
      registeredByRelationshipId: relAAlpha.id,
      registeredByUserId: uAlpha.id,
      registeredByOrgType: "DEALER",
      name: "自社顧客",
      phone: "09000000001",
      channel: "EVENT",
    },
  });
  const customerOther = await admin.customer.create({
    data: {
      wholesalerId: wA.id,
      ownerRelationshipId: relAOther.id,
      registeredByRelationshipId: relAOther.id,
      registeredByUserId: uOther.id,
      registeredByOrgType: "DEALER",
      name: "他社顧客",
      phone: "09000000002",
      channel: "EVENT",
    },
  });

  const spAlpha = await admin.salesperson.create({
    data: { wholesalerId: wA.id, relationshipId: relAAlpha.id, name: "自社スタッフ" },
  });
  const spOther = await admin.salesperson.create({
    data: { wholesalerId: wA.id, relationshipId: relAOther.id, name: "他社スタッフ" },
  });

  f = {
    wA: wA.id,
    wB: wB.id,
    dealerAlpha: alpha.id,
    dealerOther: other.id,
    userAlpha: uAlpha.id,
    userOther: uOther.id,
    userWA: uWA.id,
    relAAlpha: relAAlpha.id,
    relBAlpha: relBAlpha.id,
    relAOther: relAOther.id,
    eventA,
    eventB,
    eventOther,
    shiftA: shiftA.id,
    shiftB: shiftB.id,
    customerA: customerA.id,
    customerOther: customerOther.id,
    spAlpha: spAlpha.id,
    spOther: spOther.id,
  };
}, 180_000);

afterAll(async () => {
  await admin.$disconnect();
});

/** α のセッション（代理店 A・B の両方と取引）。 */
const alphaCtx = (): TenantContext =>
  partnerCtx(f.dealerAlpha, [f.relAAlpha, f.relBAlpha], f.userAlpha);

describe("複数代理店 — Event", () => {
  it("パートナー会社は代理店 A・B 双方の自社担当催事を見られる", async () => {
    const rows = await withTenant(alphaCtx(), (tx) => tx.event.findMany({ select: { id: true } }));
    expect(rows.map((r) => r.id).sort()).toEqual([f.eventA, f.eventB].sort());
  });

  it("無関係な他社（別パートナー会社）の催事は見えない", async () => {
    const rows = await withTenant(alphaCtx(), (tx) => tx.event.findMany({ select: { id: true } }));
    expect(rows.map((r) => r.id)).not.toContain(f.eventOther);
  });

  it("代理店 A のセッションから代理店 B の催事は見えない", async () => {
    const rows = await withTenant(agencyCtx(f.wA, f.userWA), (tx) =>
      tx.event.findMany({ select: { id: true } }),
    );
    expect(rows.map((r) => r.id).sort()).toEqual([f.eventA, f.eventOther].sort());
    expect(rows.map((r) => r.id)).not.toContain(f.eventB);
  });

  it("テナント情報が無いセッションからは何も見えない", async () => {
    const rows = await withTenant(
      { relationshipIds: [], isSaasAdmin: false, actorUserId: "nobody" },
      (tx) => tx.event.findMany({ select: { id: true } }),
    );
    expect(rows).toEqual([]);
  });
});

describe("複数代理店 — EventShift", () => {
  it("自社担当催事のシフトは代理店をまたいで見える（重複判定の根拠）", async () => {
    const rows = await withTenant(alphaCtx(), (tx) =>
      tx.eventShift.findMany({ select: { id: true } }),
    );
    expect(rows.map((r) => r.id).sort()).toEqual([f.shiftA, f.shiftB].sort());
  });

  it("他社催事のシフトは見えない", async () => {
    const otherOnly = partnerCtx(f.dealerOther, [f.relAOther], f.userOther);
    const rows = await withTenant(otherOnly, (tx) =>
      tx.eventShift.findMany({ select: { id: true } }),
    );
    expect(rows).toEqual([]);
  });
});

describe("複数代理店 — Customer / Salesperson", () => {
  it("自社が取り扱う顧客だけが見える", async () => {
    const rows = await withTenant(alphaCtx(), (tx) =>
      tx.customer.findMany({ select: { id: true } }),
    );
    expect(rows.map((r) => r.id)).toEqual([f.customerA]);
  });

  it("自社の取引関係に属するスタッフだけが見える", async () => {
    const rows = await withTenant(alphaCtx(), (tx) =>
      tx.salesperson.findMany({ select: { id: true } }),
    );
    expect(rows.map((r) => r.id)).toEqual([f.spAlpha]);
  });

  it("他社のスタッフ行は更新できない（WITH CHECK / USING）", async () => {
    const updated = await withTenant(alphaCtx(), (tx) =>
      tx.salesperson.updateMany({ where: { id: f.spOther }, data: { name: "乗っ取り" } }),
    );
    expect(updated.count).toBe(0);
  });
});
