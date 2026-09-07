import { resolve } from "node:path";

import { config } from "dotenv";

// E2E 後始末 — このスペックが作った Salesperson / User を消す。
//
// テスト専用データなので物理削除でよい（業務データの物理削除はしない方針だが、
// fixture が自分で作ったものを片付けるのは対象外）。
//
// 引数: argv[2] = RUN_ID

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
config({ path: resolve(REPO_ROOT, ".env.local") });

async function main(): Promise<void> {
  const { rawPrisma } = (await import("@solar/db")) as typeof import("@solar/db");

  const runId = process.argv[2];
  if (!runId) {
    console.error("[cleanup-staff-master-consistency] RUN_ID を渡してください");
    process.exit(1);
    return;
  }

  await rawPrisma.salesperson.deleteMany({ where: { name: `E2E集合スタッフ${runId}` } });
  const users = await rawPrisma.user.findMany({
    where: { name: `E2E集合ユーザー${runId}` },
    select: { id: true },
  });
  if (users.length > 0) {
    const ids = users.map((u) => u.id);
    await rawPrisma.userRole.deleteMany({ where: { userId: { in: ids } } });
    await rawPrisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  console.info("[cleanup-staff-master-consistency] 後始末しました");
  await rawPrisma.$disconnect();
}

void main();
