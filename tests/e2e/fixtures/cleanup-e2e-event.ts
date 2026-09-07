import { resolve } from "node:path";

import { config } from "dotenv";

// E2E データクリーンアップ — setup-e2e-event.ts が作った Event / EventCandidate /
// Salesperson を削除する。
//
// 安全性:
//   - 対象は argv[2] の RUN_ID から組み立てた完全一致の名前だけ。
//     部分一致（LIKE / contains）では消さない。
//   - EventSalesperson は Event / Salesperson の FK CASCADE で一緒に消える。
//   - Event → EventCandidate の順で消す（Event が候補を参照しているため）。
//
// RLS を経由しない rawPrisma を使うのは seed/migration と同じ運用例外
// （既存の cleanup-*.ts と同じ方針）。

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
config({ path: resolve(REPO_ROOT, ".env.local") });

async function main(): Promise<void> {
  const { rawPrisma } = (await import("@solar/db")) as typeof import("@solar/db");

  const runId = process.argv[2];
  if (!runId || !/^\d+$/.test(runId)) {
    console.error("[cleanup-e2e-event] RUN_ID（数字のみ）を引数で渡してください");
    process.exit(1);
    return;
  }

  // setup-e2e-event.ts と同じ組み立て方をする。
  const storeName = `E2E催事${runId}`;
  const salespersonName = `E2Eアサイン販売員${runId}`;

  const candidates = await rawPrisma.eventCandidate.findMany({
    where: { storeName },
    select: { id: true },
  });
  const candidateIds = candidates.map((c) => c.id);

  const removedEvents =
    candidateIds.length > 0
      ? await rawPrisma.event.deleteMany({ where: { eventCandidateId: { in: candidateIds } } })
      : { count: 0 };
  const removedCandidates =
    candidateIds.length > 0
      ? await rawPrisma.eventCandidate.deleteMany({ where: { id: { in: candidateIds } } })
      : { count: 0 };
  const removedSalespeople = await rawPrisma.salesperson.deleteMany({
    where: { name: salespersonName },
  });

  console.info(
    `[cleanup-e2e-event] events=${removedEvents.count} candidates=${removedCandidates.count} salespeople=${removedSalespeople.count} runId=${runId}`,
  );

  await rawPrisma.$disconnect();
}

main().catch((err) => {
  console.error("[cleanup-e2e-event] failed", err);
  process.exit(1);
});
