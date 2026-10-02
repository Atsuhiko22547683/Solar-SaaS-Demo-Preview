// シフト一覧の E2E 用フィクスチャ（ローカル DB 専用・冪等）。
//
// 「本人への割当だけが見える」「日付の絞り込み・並び順」を確かめるため、
// テスト専用のイベントと割当を用意する。既存の業務データは触らない。
//
//   イベント（すべて店舗名に [E2E shift] を含む）:
//     E1 2026-06-05  E2 2026-06-20  E3 2026-07-03  E4 2026-06-12（別二次店用）
//   割当:
//     alpha-staff（本人）           … E1, E2, E3 の催事割当 + E2 に勤務シフト（10:00-18:00）
//     alpha-admin（同じ二次店の別人） … E1 の催事割当（本人の一覧には出ない）
//     beta-admin（別二次店）         … E4 の催事割当（本人の一覧には出ない）
//
// 実行: pnpm -F @solar/db exec tsx ../../tests/e2e/fixtures/partner-shift-fixture.ts

import "../../../packages/db/prisma/seed-env.js";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TAG = "[E2E shift]";

async function ensureSalesperson(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`fixture: ${email} が見つかりません`);
  const relationship = await prisma.relationship.findFirst({
    where: { dealerId: user.tenantId, status: "ACTIVE" },
  });
  if (!relationship) throw new Error(`fixture: ${email} の取引関係が見つかりません`);
  let sp = await prisma.salesperson.findUnique({ where: { userId: user.id } });
  if (!sp) {
    sp = await prisma.salesperson.create({
      data: {
        wholesalerId: relationship.wholesalerId,
        relationshipId: relationship.id,
        userId: user.id,
        name: user.name,
        franchiseNo: relationship.franchiseNo,
        isActive: true,
      },
    });
  }
  return { user, relationship, salesperson: sp };
}

async function ensureEvent(
  wholesalerId: string,
  decidedBy: string,
  key: string,
  date: string,
  /** 担当会社（パートナー会社）の取引関係。催事の閲覧範囲はここで決まる。 */
  relationshipId: string,
) {
  const storeName = `${TAG} ${key}`;
  let candidate = await prisma.eventCandidate.findFirst({ where: { wholesalerId, storeName } });
  if (!candidate) {
    candidate = await prisma.eventCandidate.create({
      data: {
        wholesalerId,
        targetMonth: date.slice(0, 7),
        scheduledDate: new Date(`${date}T00:00:00.000Z`),
        storeName,
        address: `埼玉県 ${key} テスト住所`,
        deadlineAt: new Date(`${date}T00:00:00.000Z`),
        status: "DECIDED",
        createdBy: decidedBy,
      },
    });
  }
  let event = await prisma.event.findUnique({ where: { eventCandidateId: candidate.id } });
  if (!event) {
    event = await prisma.event.create({
      data: { wholesalerId, eventCandidateId: candidate.id, mode: "DEALER", decidedBy },
    });
  }
  // 担当会社の割当。パートナー側の閲覧範囲（eventScope）はこれを見る。
  await prisma.eventDealer.upsert({
    where: { eventId_relationshipId: { eventId: event.id, relationshipId } },
    update: {},
    create: { eventId: event.id, relationshipId, assignedBy: decidedBy },
  });
  // 開催日（開催時間は未設定のまま。架空の時間で埋めない）。
  const eventDate = new Date(`${date}T00:00:00.000Z`);
  await prisma.eventDay.upsert({
    where: { eventId_eventDate: { eventId: event.id, eventDate } },
    update: {},
    create: { eventId: event.id, eventDate },
  });
  return event;
}

async function assign(eventId: string, salespersonId: string, note: string) {
  await prisma.eventSalesperson.upsert({
    where: { eventId_salespersonId: { eventId, salespersonId } },
    update: {},
    create: { eventId, salespersonId, note },
  });
}

async function main() {
  const me = await ensureSalesperson("alpha-staff@solar-saas.dev");
  const sameDealerOther = await ensureSalesperson("alpha-admin@solar-saas.dev");
  const otherDealer = await ensureSalesperson("beta-admin@solar-saas.dev");
  const w = me.relationship.wholesalerId;

  // E1〜E3 は自社（アルファ）担当、E4 は別のパートナー会社（ベータ）担当。
  const e1 = await ensureEvent(w, me.user.id, "E1 カインズ大宮", "2026-06-05", me.relationship.id);
  const e2 = await ensureEvent(w, me.user.id, "E2 島忠川越", "2026-06-20", me.relationship.id);
  const e3 = await ensureEvent(w, me.user.id, "E3 コメリ熊谷", "2026-07-03", me.relationship.id);
  const e4 = await ensureEvent(
    w,
    me.user.id,
    "E4 別店舗",
    "2026-06-12",
    otherDealer.relationship.id,
  );

  await assign(e1.id, me.salesperson.id, `${TAG} 本人`);
  await assign(e2.id, me.salesperson.id, `${TAG} 本人`);
  await assign(e3.id, me.salesperson.id, `${TAG} 本人`);
  await assign(e1.id, sameDealerOther.salesperson.id, `${TAG} 同じ二次店の別スタッフ`);
  await assign(e4.id, otherDealer.salesperson.id, `${TAG} 別二次店`);

  // 本人の勤務シフト（時刻あり）。E2 の 10:00〜18:00（JST）。
  const start = new Date("2026-06-20T01:00:00.000Z");
  // 旧 (userId, startPlanned) の UNIQUE は、予定時間帯の EXCLUDE 制約
  // （EventShift_user_no_overlap）へ置き換えたので findUnique では引けない。
  // 同じ人の重なる区間が既にあるかを findFirst で見る。
  const existing = await prisma.eventShift.findFirst({
    where: {
      userId: me.user.id,
      startPlanned: { lt: new Date("2026-06-20T09:00:00.000Z") },
      endPlanned: { gt: start },
    },
  });
  if (!existing) {
    await prisma.eventShift.create({
      data: {
        eventId: e2.id,
        userId: me.user.id,
        role: "PITCH",
        startPlanned: start,
        endPlanned: new Date("2026-06-20T09:00:00.000Z"),
        note: `${TAG} 勤務シフト`,
      },
    });
  }

  console.info(JSON.stringify({ e1: e1.id, e2: e2.id, e3: e3.id, e4: e4.id }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
