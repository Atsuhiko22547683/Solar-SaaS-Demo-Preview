import { resolve } from "node:path";

import { config } from "dotenv";

// UC-01 の E2E データ削除。
//
// setup-uc01-candidate.ts が作った候補と、その候補から spec が作り進めたもの
// （希望提出 / イベント / シフト / 報告 / 顧客 / アポ）をまとめて消す。
// spec 側が作る場所提供元対応（VenueNegotiation）と顧客も RUN_ID で消す。
//
// 安全性:
//   - 対象は argv[2] の RUN_ID から組み立てた完全一致の名前だけ。
//     部分一致（LIKE / contains）では消さない。
//   - 参照の子側から順に消す（Appointment → Customer → Report/Shift → Event →
//     Preference/Visibility → EventCandidate）。
//
// 過去に「UC-02 花子 <timestamp>」がローカルへ残り続けた経緯があるため、
// 実行のたびに必ず 0 件へ戻ることを最後に出力して確認できるようにしている。
//
// RLS を経由しない rawPrisma を使うのは seed/migration と同じ運用例外。

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
config({ path: resolve(REPO_ROOT, ".env.local") });

async function main(): Promise<void> {
  const { rawPrisma } = (await import("@solar/db")) as typeof import("@solar/db");

  const runId = process.argv[2];
  if (!runId || !/^\d+$/.test(runId)) {
    console.error("[cleanup-uc01-candidate] RUN_ID（数字のみ）を引数で渡してください");
    process.exit(1);
    return;
  }

  // setup / spec 側と同じ組み立て方をする。
  const storeName = `UC01候補${runId}`;
  const customerName = `UC01顧客${runId}`;
  const negotiationNote = `UC-01 E2E ${runId}`;

  const candidates = await rawPrisma.eventCandidate.findMany({
    where: { storeName },
    select: { id: true },
  });
  const candidateIds = candidates.map((c) => c.id);

  const events =
    candidateIds.length > 0
      ? await rawPrisma.event.findMany({
          where: { eventCandidateId: { in: candidateIds } },
          select: { id: true },
        })
      : [];
  const eventIds = events.map((e) => e.id);

  // 顧客は名前完全一致で。アポ → 顧客の順に消す（Appointment が顧客を参照する）。
  const customers = await rawPrisma.customer.findMany({
    where: { name: customerName },
    select: { id: true },
  });
  const customerIds = customers.map((c) => c.id);
  if (customerIds.length > 0) {
    await rawPrisma.appointment.deleteMany({ where: { customerId: { in: customerIds } } });
  }
  if (eventIds.length > 0) {
    await rawPrisma.appointment.deleteMany({ where: { eventId: { in: eventIds } } });
  }
  const removedCustomers = await rawPrisma.customer.deleteMany({ where: { name: customerName } });

  let removedEvents = 0;
  if (eventIds.length > 0) {
    await rawPrisma.eventReport.deleteMany({ where: { eventId: { in: eventIds } } });
    await rawPrisma.eventShift.deleteMany({ where: { eventId: { in: eventIds } } });
    await rawPrisma.eventDealer.deleteMany({ where: { eventId: { in: eventIds } } });
    await rawPrisma.eventSalesperson.deleteMany({ where: { eventId: { in: eventIds } } });
    await rawPrisma.eventChange.deleteMany({ where: { eventId: { in: eventIds } } });
    removedEvents = (await rawPrisma.event.deleteMany({ where: { id: { in: eventIds } } })).count;
  }

  let removedCandidates = 0;
  if (candidateIds.length > 0) {
    await rawPrisma.dealerPreference.deleteMany({
      where: { eventCandidateId: { in: candidateIds } },
    });
    await rawPrisma.eventCandidateVisibility.deleteMany({
      where: { eventCandidateId: { in: candidateIds } },
    });
    removedCandidates = (
      await rawPrisma.eventCandidate.deleteMany({ where: { id: { in: candidateIds } } })
    ).count;
  }

  // spec が画面から起票する場所提供元対応（備考に RUN_ID を入れている）。
  const removedNegotiations = await rawPrisma.venueNegotiation.deleteMany({
    where: { note: negotiationNote },
  });

  console.info(
    `[cleanup-uc01-candidate] candidates=${removedCandidates} events=${removedEvents} ` +
      `customers=${removedCustomers.count} negotiations=${removedNegotiations.count} runId=${runId}`,
  );

  // 残量チェック（0 でなければ cleanup 漏れ）。
  const leftover = {
    candidates: await rawPrisma.eventCandidate.count({ where: { storeName } }),
    customers: await rawPrisma.customer.count({ where: { name: customerName } }),
    negotiations: await rawPrisma.venueNegotiation.count({ where: { note: negotiationNote } }),
  };
  console.info(`[cleanup-uc01-candidate] leftover=${JSON.stringify(leftover)}`);

  await rawPrisma.$disconnect();
}

main().catch((err) => {
  console.error("[cleanup-uc01-candidate] failed", err);
  process.exit(1);
});
