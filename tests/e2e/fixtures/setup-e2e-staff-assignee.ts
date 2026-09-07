import { resolve } from "node:path";

import { config } from "dotenv";

// E2E フィクスチャ — 顧客担当者の「個人スタッフ」連携を検証するための土台。
//
// 生成物（すべて RUN_ID 付きの名前で一意化）:
//   1. 自社スタッフ（Salesperson.userId = デモユーザー）
//      → 既存の Customer.tossUpUserId / closingUserId 経由の担当実績が
//        スタッフ側で数えられることを確かめるため。
//   2. 二次店スタッフ 2 名（同じ Relationship 配下）
//      → 顧客担当者選択で 二次店 → スタッフ まで選べることを確かめるため。
//   3. 顧客 3 件
//      - 自社担当（tossUpUserId / closingUserId = デモユーザー、*SalespersonId は null）
//        既存データ相当。userId 経由で担当実績に数えられる。
//      - 二次店担当（tossUpRelationshipId のみ = 会社までしか記録が無い既存データ）
//      - 担当者未設定（新規に個人スタッフを割り当てる操作用）
//
// 本番シード (packages/db/prisma/seed.ts) は拡張しない。
// 標準出力の最終行に JSON を返す。後片付けは cleanup-e2e-staff-assignee.ts。
//
// RLS を経由しない rawPrisma を使うのは seed/migration と同じ運用例外。

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
config({ path: resolve(REPO_ROOT, ".env.local") });

const DEMO_EMAIL = "demo@solar-saas.demo";

async function main(): Promise<void> {
  const { rawPrisma } = (await import("@solar/db")) as typeof import("@solar/db");

  const runId = process.argv[2];
  if (!runId || !/^\d+$/.test(runId)) {
    console.error("[setup-e2e-staff-assignee] RUN_ID（数字のみ）を引数で渡してください");
    process.exit(1);
    return;
  }

  const demo = await rawPrisma.user.findFirst({
    where: { email: DEMO_EMAIL },
    select: { id: true, tenantId: true },
  });
  if (!demo) {
    console.error(`[setup-e2e-staff-assignee] デモユーザーが見つかりません: ${DEMO_EMAIL}`);
    process.exit(1);
    return;
  }
  const wholesalerId = demo.tenantId;

  const relationship = await rawPrisma.relationship.findFirst({
    where: { wholesalerId, status: "ACTIVE" },
    select: { id: true, dealer: { select: { name: true } } },
  });
  if (!relationship) {
    console.error("[setup-e2e-staff-assignee] ACTIVE な Relationship がありません");
    process.exit(1);
    return;
  }

  // 1. 自社スタッフ（デモユーザーと同一人物としてリンク）。
  //    userId は @unique なので、既に別スタッフが掴んでいたら外してから張る。
  await rawPrisma.salesperson.updateMany({
    where: { userId: demo.id },
    data: { userId: null },
  });
  const selfStaff = await rawPrisma.salesperson.create({
    data: {
      wholesalerId,
      name: `E2E自社担当${runId}`,
      userId: demo.id,
      isActive: true,
    },
    select: { id: true },
  });

  // 2. 二次店スタッフ 2 名（同じ二次店に所属）。
  await rawPrisma.salesperson.create({
    data: {
      wholesalerId,
      name: `E2E二次店担当A${runId}`,
      relationshipId: relationship.id,
      isActive: true,
    },
    select: { id: true },
  });
  const dealerStaffB = await rawPrisma.salesperson.create({
    data: {
      wholesalerId,
      name: `E2E二次店担当B${runId}`,
      relationshipId: relationship.id,
      isActive: true,
    },
    select: { id: true },
  });

  // 3-a. 自社担当の既存顧客（*SalespersonId は張らない = 既存データ相当）。
  const selfCustomer = await rawPrisma.customer.create({
    data: {
      wholesalerId,
      name: `E2E自社担当顧客${runId}`,
      phone: `070${String(runId).slice(-8)}`,
      channel: "WALK_IN",
      registeredByUserId: demo.id,
      registeredByOrgType: "WHOLESALER",
      tossUpUserId: demo.id,
      closingUserId: demo.id,
    },
    select: { id: true },
  });

  // 3-b. 二次店担当の既存顧客（会社までしか記録が無い）。
  const legacyDealerCustomer = await rawPrisma.customer.create({
    data: {
      wholesalerId,
      name: `E2E二次店既存顧客${runId}`,
      phone: `071${String(runId).slice(-8)}`,
      channel: "WALK_IN",
      registeredByUserId: demo.id,
      registeredByOrgType: "WHOLESALER",
      tossUpRelationshipId: relationship.id,
    },
    select: { id: true },
  });

  // 3-c. 担当者未設定の顧客（画面から個人スタッフを割り当てる操作用）。
  const unassignedCustomer = await rawPrisma.customer.create({
    data: {
      wholesalerId,
      name: `E2E未割当顧客${runId}`,
      phone: `072${String(runId).slice(-8)}`,
      channel: "WALK_IN",
      registeredByUserId: demo.id,
      registeredByOrgType: "WHOLESALER",
    },
    select: { id: true },
  });

  console.info(
    JSON.stringify({
      selfStaffId: selfStaff.id,
      selfStaffName: `E2E自社担当${runId}`,
      dealerStaffAName: `E2E二次店担当A${runId}`,
      dealerStaffBId: dealerStaffB.id,
      dealerStaffBName: `E2E二次店担当B${runId}`,
      dealerName: relationship.dealer.name,
      relationshipId: relationship.id,
      selfCustomerId: selfCustomer.id,
      legacyDealerCustomerId: legacyDealerCustomer.id,
      unassignedCustomerId: unassignedCustomer.id,
    }),
  );

  await rawPrisma.$disconnect();
}

main().catch((err) => {
  console.error("[setup-e2e-staff-assignee] failed", err);
  process.exit(1);
});
