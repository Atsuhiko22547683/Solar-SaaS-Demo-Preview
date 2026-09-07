import { resolve } from "node:path";

import { config } from "dotenv";

// E2E データクリーンアップ — wholesaler/preference-status.spec.ts が画面から登録する
// イベント候補（`E2E希望状況店舗<RUN_ID>`）を削除する。
//
// イベント候補は一覧に残るので、cleanup が無いと実行のたびに積み上がる。
//
// 安全性:
//   - 対象は argv[2] の RUN_ID から組み立てた完全一致の店舗名 1 件だけ。
//     部分一致（LIKE / contains）では消さない。
//   - 候補にぶら下がる公開設定・希望提出も先に消す（FK 制約のため）。
//
// RLS を経由しない rawPrisma を使うのは seed/migration と同じ運用例外。

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
config({ path: resolve(REPO_ROOT, ".env.local") });

async function main(): Promise<void> {
  const { rawPrisma } = (await import("@solar/db")) as typeof import("@solar/db");

  const runId = process.argv[2];
  if (!runId || !/^\d+$/.test(runId)) {
    console.error("[cleanup-e2e-preference-status] RUN_ID（数字のみ）を引数で渡してください");
    process.exit(1);
    return;
  }

  // spec 側の STORE_NAME と同じ組み立て方をする。
  const base = `E2E希望状況店舗${runId}`;
  const storeNames = [base];

  const candidates = await rawPrisma.eventCandidate.findMany({
    where: { storeName: { in: storeNames } },
    select: { id: true },
  });
  const ids = candidates.map((c) => c.id);

  if (ids.length > 0) {
    await rawPrisma.dealerPreference.deleteMany({ where: { eventCandidateId: { in: ids } } });
    await rawPrisma.eventCandidateVisibility.deleteMany({
      where: { eventCandidateId: { in: ids } },
    });
  }
  const removed = await rawPrisma.eventCandidate.deleteMany({
    where: { storeName: { in: storeNames } },
  });

  const leftover = await rawPrisma.eventCandidate.count({
    where: { storeName: { in: storeNames } },
  });
  console.info(
    `[cleanup-e2e-preference-status] removed=${removed.count} leftover=${leftover} runId=${runId}`,
  );

  await rawPrisma.$disconnect();
}

main().catch((err) => {
  console.error("[cleanup-e2e-preference-status] failed", err);
  process.exit(1);
});
