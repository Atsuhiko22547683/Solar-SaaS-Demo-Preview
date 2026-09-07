import { resolve } from "node:path";

import { config } from "dotenv";

// E2E データクリーンアップ — event-candidate-basics.spec.ts が画面から登録する
// イベント候補（`E2E催事基本情報<RUN_ID>` と `…未設定`）を削除する。
//
// イベント候補は一覧に残るので、cleanup が無いと実行のたびに積み上がる。
//
// 安全性:
//   - 対象は argv[2] の RUN_ID から組み立てた完全一致の店舗名 2 件だけ。
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
    console.error("[cleanup-e2e-event-candidate] RUN_ID（数字のみ）を引数で渡してください");
    process.exit(1);
    return;
  }

  // spec 側の STORE_NAME と同じ組み立て方をする。
  const base = `E2E催事基本情報${runId}`;
  const storeNames = [base, `${base}未設定`];

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
    `[cleanup-e2e-event-candidate] removed=${removed.count} leftover=${leftover} runId=${runId}`,
  );

  await rawPrisma.$disconnect();
}

main().catch((err) => {
  console.error("[cleanup-e2e-event-candidate] failed", err);
  process.exit(1);
});
