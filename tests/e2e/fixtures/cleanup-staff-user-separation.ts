import { resolve } from "node:path";

import { config } from "dotenv";

// E2E データクリーンアップ — staff-user-separation.spec.ts が作った
// Salesperson を削除する（完全一致の名前のみ）。
//
// この spec は User を作らない（分離の検証が目的）ので、User は対象外。
// RLS を経由しない rawPrisma を使うのは fixture の運用例外。

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
config({ path: resolve(REPO_ROOT, ".env.local") });

async function main(): Promise<void> {
  const { rawPrisma } = (await import("@solar/db")) as typeof import("@solar/db");

  const runId = process.argv[2];
  if (!runId || !/^\d+$/.test(runId)) {
    console.error("[cleanup-staff-user-separation] RUN_ID（数字のみ）を引数で渡してください");
    process.exit(1);
    return;
  }
  const staffName = `E2E分離スタッフ${runId}`;

  const removed = await rawPrisma.salesperson.deleteMany({ where: { name: staffName } });
  const leftover = await rawPrisma.salesperson.count({ where: { name: staffName } });

  console.info(
    `[cleanup-staff-user-separation] staff=${removed.count} leftover=${leftover} runId=${runId}`,
  );

  await rawPrisma.$disconnect();
}

main().catch((err) => {
  console.error("[cleanup-staff-user-separation] failed", err);
  process.exit(1);
});
