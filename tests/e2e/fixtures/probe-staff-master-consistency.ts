import { resolve } from "node:path";

import { config } from "dotenv";

// E2E プローブ — 論理削除したスタッフの DB 行が残っていることを確認する。
//
// 引数: argv[2] = RUN_ID
// 読み取り専用。rawPrisma を使うのは fixture の運用例外。

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
config({ path: resolve(REPO_ROOT, ".env.local") });

async function main(): Promise<void> {
  const { rawPrisma } = (await import("@solar/db")) as typeof import("@solar/db");

  const runId = process.argv[2];
  if (!runId) {
    console.error("[probe-staff-master-consistency] RUN_ID を渡してください");
    process.exit(1);
    return;
  }

  const staff = await rawPrisma.salesperson.findFirst({
    where: { name: `E2E集合スタッフ${runId}` },
    select: { id: true, isActive: true },
  });

  console.info(
    JSON.stringify({ staffExists: staff !== null, staffIsActive: staff?.isActive ?? null }),
  );
  await rawPrisma.$disconnect();
}

void main();
