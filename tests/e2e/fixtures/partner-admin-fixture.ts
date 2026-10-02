// 二次店管理者向け画面の E2E 用フィクスチャ（ローカル DB 専用・冪等）。
//
// スタッフ用フィクスチャ（partner-staff-fixture.ts）が「本人担当」のデータを作るのに対し、
// こちらは「本人担当ではないが自社のもの」＝ 管理者だけが見えるデータを作る。
//
//   [E2E admin] 管理者専用顧客 … alpha-admin が登録。販売員の担当を付けないので
//                                 alpha-staff の一覧には出ない。
//   [E2E admin] 削除用顧客     … 契約も添付も無い。削除の検証に使う（毎回作り直す）。
//   確定した営業フィー          … Deal → Contract → Incentive(FINALIZED) を 1 件。
//   [E2E admin] スタッフ提出日報 … alpha-staff が提出した催事日報。管理者サイトから
//                                  「スタッフが登録した報告を同じデータとして確認できる」
//                                  ことを、実行順に依存せず確かめるために用意する。
//
// あわせて alpha-staff の利用区分・利用状況を既定（DEALER_STAFF / ACTIVE）へ戻す。
// アカウント管理の E2E が区分や状態を変えるので、毎回この状態から始められるようにする。
//
// 実行: pnpm -F @solar/db exec tsx ../../tests/e2e/fixtures/partner-admin-fixture.ts

import "../../../packages/db/prisma/seed-env.js";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TAG = "[E2E admin]";
const KEEP_NAME = `${TAG} 管理者専用顧客`;
const DELETE_NAME = `${TAG} 削除用顧客`;

/** アカウント管理の E2E が触る利用者を既定へ戻す（冪等・ローカル専用）。 */
async function resetStaffAccount() {
  const staff = await prisma.user.findUnique({
    where: { email: "alpha-staff@solar-saas.dev" },
    select: { id: true, status: true, roles: { select: { role: true } } },
  });
  if (!staff) throw new Error("fixture: alpha-staff が見つかりません");
  const isStaffRole = staff.roles.length === 1 && staff.roles[0]!.role === "DEALER_STAFF";
  if (!isStaffRole) {
    await prisma.userRole.deleteMany({ where: { userId: staff.id } });
    await prisma.userRole.create({ data: { userId: staff.id, role: "DEALER_STAFF" } });
  }
  if (staff.status !== "ACTIVE") {
    await prisma.user.update({ where: { id: staff.id }, data: { status: "ACTIVE" } });
  }
}

async function main() {
  await resetStaffAccount();
  const admin = await prisma.user.findUnique({ where: { email: "alpha-admin@solar-saas.dev" } });
  if (!admin) throw new Error("fixture: alpha-admin が見つかりません");
  const relationship = await prisma.relationship.findFirst({
    where: { dealerId: admin.tenantId, status: "ACTIVE" },
  });
  if (!relationship) throw new Error("fixture: alpha の取引関係が見つかりません");
  const { wholesalerId } = relationship;

  const baseCustomer = {
    wholesalerId,
    ownerRelationshipId: relationship.id,
    registeredByUserId: admin.id,
    registeredByOrgType: "DEALER" as const,
    registeredByRelationshipId: relationship.id,
    channel: "EVENT" as const,
  };

  // 1) 管理者だけが見える顧客（担当販売員を付けない）。
  let keep = await prisma.customer.findFirst({ where: { name: KEEP_NAME, wholesalerId } });
  if (!keep) {
    keep = await prisma.customer.create({
      data: { ...baseCustomer, name: KEEP_NAME, phone: "09000000101", status: "IN_NEGOTIATION" },
    });
  }

  // 2) 削除の検証用。前回の実行で消えている場合に備えて毎回作り直す。
  const existingDelete = await prisma.customer.findFirst({
    where: { name: DELETE_NAME, wholesalerId },
    select: { id: true },
  });
  if (!existingDelete) {
    await prisma.customer.create({
      data: { ...baseCustomer, name: DELETE_NAME, phone: "09000000102" },
    });
  }

  // 3) 確定した営業フィー 1 件（手数料管理の一覧に出す）。
  //    Contract は Deal 1 件につき 1 件（dealId が @unique）なので、既存を探してから作る。
  let deal = await prisma.deal.findFirst({
    where: { customerId: keep.id, ownerUserId: admin.id },
  });
  if (!deal) {
    deal = await prisma.deal.create({
      data: {
        customerId: keep.id,
        ownerType: "DEALER",
        ownerUserId: admin.id,
        ownerRelationshipId: relationship.id,
        status: "CONTRACTED",
        note: `${TAG} 営業フィー検証`,
      },
    });
  }

  let contract = await prisma.contract.findUnique({ where: { dealId: deal.id } });
  if (!contract) {
    contract = await prisma.contract.create({
      data: {
        wholesalerId,
        dealId: deal.id,
        customerId: keep.id,
        ownerRelationshipId: relationship.id,
        contractDate: new Date("2026-05-20T00:00:00.000Z"),
        contractAmount: "3000000",
        cancelDeadline: new Date("2026-05-28T00:00:00.000Z"),
        createdBy: admin.id,
      },
    });
  }

  const existingIncentive = await prisma.incentive.findUnique({
    where: {
      contractId_relationshipId: { contractId: contract.id, relationshipId: relationship.id },
    },
  });
  if (!existingIncentive) {
    await prisma.incentive.create({
      data: {
        contractId: contract.id,
        relationshipId: relationship.id,
        targetProfit: "800000",
        rate: "2.50",
        amount: "20000",
        status: "FINALIZED",
        settledMonth: "2026-05",
        finalizedAt: new Date("2026-06-01T00:00:00.000Z"),
        note: `${TAG} 確定フィー`,
      },
    });
  }

  // 4) スタッフが提出した催事日報（管理者サイトの一覧・提出者列の検証用）。
  const staff = await prisma.user.findUnique({
    where: { email: "alpha-staff@solar-saas.dev" },
    select: { id: true },
  });
  if (!staff) throw new Error("fixture: alpha-staff が見つかりません");
  // 日報は催事の記録なので、受け皿の催事と開催日を用意して必ず紐付ける
  // （催事に紐付かない日報をテストから作らない）。
  const reportDate = new Date("2026-05-10T00:00:00.000Z");
  const reportPlace = `${TAG} スタッフ提出日報`;
  let reportCandidate = await prisma.eventCandidate.findFirst({
    where: { wholesalerId, storeName: reportPlace },
  });
  reportCandidate ??= await prisma.eventCandidate.create({
    data: {
      wholesalerId,
      targetMonth: "2026-05",
      scheduledDate: reportDate,
      storeName: reportPlace,
      deadlineAt: reportDate,
      status: "DECIDED",
      createdBy: staff.id,
    },
  });
  let reportEvent = await prisma.event.findUnique({
    where: { eventCandidateId: reportCandidate.id },
  });
  reportEvent ??= await prisma.event.create({
    data: {
      wholesalerId,
      eventCandidateId: reportCandidate.id,
      mode: "DEALER",
      decidedBy: staff.id,
    },
  });
  await prisma.eventDealer.upsert({
    where: {
      eventId_relationshipId: { eventId: reportEvent.id, relationshipId: relationship.id },
    },
    update: {},
    create: { eventId: reportEvent.id, relationshipId: relationship.id, assignedBy: staff.id },
  });
  const reportDay = await prisma.eventDay.upsert({
    where: { eventId_eventDate: { eventId: reportEvent.id, eventDate: reportDate } },
    update: {},
    create: { eventId: reportEvent.id, eventDate: reportDate },
  });
  const existingReport = await prisma.dealerEventReport.findFirst({
    where: { relationshipId: relationship.id, venuePlace: reportPlace },
    select: { id: true },
  });
  if (!existingReport) {
    await prisma.dealerEventReport.create({
      data: {
        wholesalerId,
        relationshipId: relationship.id,
        createdByUserId: staff.id,
        eventId: reportEvent.id,
        eventDayId: reportDay.id,
        eventDate: reportDate,
        venuePlace: reportPlace,
        category: "HOUSING_EQUIPMENT",
        venueChain: "CAINZ_W",
        areaInFacility: "入口",
        startTime: "10:00",
        endTime: "18:00",
        lotteryBoth: 3,
        lotterySingle: 2,
        seatedBoth: 2,
        seatedSingle: 1,
        apptBoth: 1,
        apptSingle: 1,
        impression: `${TAG} スタッフの所感`,
      },
    });
  }

  console.info(JSON.stringify({ keep: keep.id, contract: contract.id }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
