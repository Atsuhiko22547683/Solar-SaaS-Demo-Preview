import { resolve } from "node:path";

import { config } from "dotenv";

// E2E データクリーンアップ — setup-e2e-report-metric.ts が作ったイベント候補 /
// イベント / 成果報告と、画面から追加された EventReportMetric を削除する。
//
// 安全性:
//   - 対象は argv[2] の RUN_ID から組み立てた完全一致の店舗名だけ。
//     部分一致（LIKE / contains）では消さない。
//   - EventReportMetric は EventReport の FK CASCADE で一緒に消える。
//
// RLS を経由しない rawPrisma を使うのは seed/migration と同じ運用例外。

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
config({ path: resolve(REPO_ROOT, ".env.local") });

async function main(): Promise<void> {
  const { rawPrisma } = (await import("@solar/db")) as typeof import("@solar/db");

  const runId = process.argv[2];
  if (!runId || !/^\d+$/.test(runId)) {
    console.error("[cleanup-e2e-report-metric] RUN_ID（数字のみ）を引数で渡してください");
    process.exit(1);
    return;
  }

  const storeName = `E2E集計催事${runId}`;
  const candidates = await rawPrisma.eventCandidate.findMany({
    where: { storeName },
    select: { id: true },
  });
  const candidateIds = candidates.map((c) => c.id);

  let removedEvents = 0;
  if (candidateIds.length > 0) {
    const events = await rawPrisma.event.findMany({
      where: { eventCandidateId: { in: candidateIds } },
      select: { id: true },
    });
    const eventIds = events.map((e) => e.id);
    if (eventIds.length > 0) {
      // metric は EventReport の CASCADE で落ちる。
      await rawPrisma.eventReport.deleteMany({ where: { eventId: { in: eventIds } } });
      removedEvents = (await rawPrisma.event.deleteMany({ where: { id: { in: eventIds } } })).count;
    }
  }
  const removedCandidates = await rawPrisma.eventCandidate.deleteMany({ where: { storeName } });
  const leftover = await rawPrisma.eventCandidate.count({ where: { storeName } });

  console.info(
    `[cleanup-e2e-report-metric] events=${removedEvents} candidates=${removedCandidates.count} leftover=${leftover} runId=${runId}`,
  );

  await rawPrisma.$disconnect();
}

main().catch((err) => {
  console.error("[cleanup-e2e-report-metric] failed", err);
  process.exit(1);
});
