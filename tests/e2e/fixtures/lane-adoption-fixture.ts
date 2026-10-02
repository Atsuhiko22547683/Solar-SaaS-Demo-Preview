// ② 出店希望連携の検証用フィクスチャ。
//
// 採用（LanePreferenceAdoption）は「確定イベントへの関連付け」なので、対象月に
// 確定した Event が 1 件必要になる。開催体制決定のフロー自体は既存機能なので、
// ここでは同等のデータ（EventCandidate DECIDED + Event + EventDay + EventDealer）を
// 直接用意する。
//
// 冪等: 固定 id（s1_*）で upsert するので、何度流しても増えない。
// 店舗は既存マスタから 1 件借りる（新しい店舗を作らない）。

import "../../../packages/db/prisma/seed-env";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const P = "s1_";

function monthAfter(n: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 暦日は UTC 正午で持つ（他のシードと同じ扱い）。 */
function calDay(month: string, day: number): Date {
  return new Date(`${month}-${String(day).padStart(2, "0")}T00:00:00.000Z`);
}

async function main(): Promise<void> {
  // 検証は「翌々月」を使う。基本シードの当月・翌月とぶつけない。
  const month = process.env.S1_MONTH ?? monthAfter(2);

  const agency = await prisma.tenant.findFirst({ where: { name: "株式会社サンライズソーラー" } });
  const partner = await prisma.tenant.findFirst({ where: { name: "株式会社グリーンフィールド" } });
  if (!agency || !partner) throw new Error("基本シードが未投入です");

  const rel = await prisma.relationship.findFirst({
    where: { wholesalerId: agency.id, dealerId: partner.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!rel) throw new Error("代理店 × パートナーの取引関係がありません");

  // 店舗は既存マスタから借りる（親チェーンつきの有効な店舗）。
  const store = await prisma.store.findFirst({
    where: { wholesalerId: agency.id, isActive: true, venueProviderId: { not: null } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      address: true,
      venueProviderId: true,
      area: { select: { name: true } },
    },
  });
  if (!store) throw new Error("親チェーンを持つ有効な店舗がありません");

  const candId = `${P}cand_${month}`;
  const eventId = `${P}event_${month}`;
  const dayId = `${P}day_${month}`;
  const scheduled = calDay(month, 12);

  await prisma.eventCandidate.upsert({
    where: { id: candId },
    create: {
      id: candId,
      wholesalerId: agency.id,
      venueProviderId: store.venueProviderId,
      targetMonth: month,
      scheduledDate: scheduled,
      storeId: store.id,
      storeName: store.name,
      address: store.address,
      area: store.area?.name ?? null,
      deadlineAt: calDay(month, 1),
      status: "DECIDED",
      createdBy: `${P}fixture`,
    },
    update: { scheduledDate: scheduled, targetMonth: month, status: "DECIDED" },
  });

  await prisma.event.upsert({
    where: { id: eventId },
    create: {
      id: eventId,
      wholesalerId: agency.id,
      eventCandidateId: candId,
      mode: "DEALER",
      decidedBy: `${P}fixture`,
      status: "PLANNED",
    },
    update: {},
  });

  // 開催日は作り直しで日付を合わせる（EventDay は (eventId, eventDate) が一意）。
  await prisma.eventShift.deleteMany({ where: { eventDayId: dayId } });
  await prisma.eventDay.deleteMany({ where: { id: dayId } });
  await prisma.eventDay.create({
    data: {
      id: dayId,
      eventId,
      eventDate: scheduled,
      startAt: new Date(`${month}-12T01:00:00.000Z`),
      endAt: new Date(`${month}-12T09:00:00.000Z`),
    },
  });

  await prisma.eventDealer.upsert({
    where: { eventId_relationshipId: { eventId, relationshipId: rel.id } },
    create: { eventId, relationshipId: rel.id, assignedBy: `${P}fixture` },
    update: {},
  });

  console.info(
    JSON.stringify({
      month,
      eventId,
      eventCandidateId: candId,
      eventDayId: dayId,
      storeName: store.name,
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
