import { resolve } from "node:path";

import { config } from "dotenv";

// E2E データクリーンアップ — salespeople.spec.ts が画面から登録する販売員
// （`E2E販売員<RUN_ID>`）を削除する。
//
// 販売員はマスタなので、cleanup が無いと実行のたびに一覧へ積み上がる
// （uc02-precall で実際に起きた顧客の積み上がりと同じ問題）。
//
// 安全性:
//   - 対象は argv[2] の RUN_ID から組み立てた「完全一致の氏名」1 件だけ。
//     部分一致（LIKE / contains）では消さない。
//   - イベントへのアサイン（EventSalesperson）は FK CASCADE で一緒に消える。
//
// RLS を経由しない rawPrisma を使うのは seed/migration と同じ運用例外
// （既存の cleanup-*.ts と同じ方針）。

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
config({ path: resolve(REPO_ROOT, ".env.local") });

async function main(): Promise<void> {
  const { rawPrisma } = (await import("@solar/db")) as typeof import("@solar/db");

  const runId = process.argv[2];
  if (!runId || !/^\d+$/.test(runId)) {
    console.error("[cleanup-e2e-salesperson] RUN_ID（数字のみ）を引数で渡してください");
    process.exit(1);
    return;
  }
  // salespeople.spec.ts の SP_NAME / DEALER_SP_NAME と同じ組み立て方をする。
  const names = [`E2E販売員${runId}`, `E2E二次店スタッフ${runId}`];

  const removed = await rawPrisma.salesperson.deleteMany({ where: { name: { in: names } } });
  const leftover = await rawPrisma.salesperson.count({ where: { name: { in: names } } });
  console.info(
    `[cleanup-e2e-salesperson] removed=${removed.count} leftover=${leftover} runId=${runId}`,
  );

  await rawPrisma.$disconnect();
}

main().catch((err) => {
  console.error("[cleanup-e2e-salesperson] failed", err);
  process.exit(1);
});
