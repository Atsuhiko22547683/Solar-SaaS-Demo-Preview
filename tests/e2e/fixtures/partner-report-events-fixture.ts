// 催事日報の E2E 用フィクスチャ（ローカル DB 専用・冪等）。
//
// 日報は「どの催事のどの開催日か」を選んでから出す。会場名と実施日は催事側の
// 記録から決まるので、テストが会場名・日付を自由入力することはもうできない。
// そこで実行ごとのタグで専用の催事を 3 件用意し、期間の境界と並べ替えを
// これまでと同じ強さで確かめられるようにする。
//
//   ${tag} 会場1  2026-02-01
//   ${tag} 会場2  2026-02-28   ← 期間の終了日当日
//   ${tag} 会場3  2026-03-01   ← 期間外
//
// 担当会社は既定で alpha（DEALER_STAFF_USER の会社）。第 2 引数で別の会社の
// 利用者を渡せる（他社データに届かないことの確認で beta 側の催事を作るため）。
// 既存の業務データは触らない。
//
// 実行: pnpm -F @solar/db exec tsx ../../tests/e2e/fixtures/partner-report-events-fixture.ts <tag> [email]

import "../../../packages/db/prisma/seed-env.js";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const VENUES: Array<{ suffix: string; date: string }> = [
  { suffix: "会場1", date: "2026-02-01" },
  { suffix: "会場2", date: "2026-02-28" },
  { suffix: "会場3", date: "2026-03-01" },
];

async function main() {
  const tag = process.argv[2];
  if (!tag) throw new Error("fixture: タグを引数で渡してください");

  const email = process.argv[3] ?? "alpha-staff@solar-saas.dev";
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`fixture: ${email} が見つかりません`);
  const relationship = await prisma.relationship.findFirst({
    where: { dealerId: user.tenantId, status: "ACTIVE" },
  });
  if (!relationship) throw new Error(`fixture: ${email} の取引関係が見つかりません`);

  const out: Record<string, string> = {};
  for (const v of VENUES) {
    const storeName = `${tag} ${v.suffix}`;
    const date = new Date(`${v.date}T00:00:00.000Z`);

    let candidate = await prisma.eventCandidate.findFirst({
      where: { wholesalerId: relationship.wholesalerId, storeName },
    });
    candidate ??= await prisma.eventCandidate.create({
      data: {
        wholesalerId: relationship.wholesalerId,
        targetMonth: v.date.slice(0, 7),
        scheduledDate: date,
        storeName,
        address: `埼玉県 ${v.suffix} テスト住所`,
        deadlineAt: date,
        status: "DECIDED",
        createdBy: user.id,
      },
    });

    let event = await prisma.event.findUnique({ where: { eventCandidateId: candidate.id } });
    event ??= await prisma.event.create({
      data: {
        wholesalerId: relationship.wholesalerId,
        eventCandidateId: candidate.id,
        mode: "DEALER",
        decidedBy: user.id,
      },
    });

    // 担当会社の割当が無いと、パートナー側の催事候補に出ない。
    await prisma.eventDealer.upsert({
      where: { eventId_relationshipId: { eventId: event.id, relationshipId: relationship.id } },
      update: {},
      create: { eventId: event.id, relationshipId: relationship.id, assignedBy: user.id },
    });

    // 開催日。開催時間は未設定のまま（架空の時間で埋めない）。
    await prisma.eventDay.upsert({
      where: { eventId_eventDate: { eventId: event.id, eventDate: date } },
      update: {},
      create: { eventId: event.id, eventDate: date },
    });

    out[v.suffix] = event.id;
  }

  console.info(JSON.stringify(out));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
