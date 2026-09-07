import { resolve } from "node:path";

import { config } from "dotenv";

// E2E データクリーンアップ — settings-access.spec.ts が二次店管理の
// インライン編集で書き込む備考（`E2E権限確認<timestamp>`）を元に戻す。
//
// Relationship は seed 由来の既存行なので、行そのものは削除せず備考だけ null に戻す。
// 対象は接頭辞が完全一致する備考だけで、他の備考には触れない。
//
// RLS を経由しない rawPrisma を使うのは seed/migration と同じ運用例外。

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
config({ path: resolve(REPO_ROOT, ".env.local") });

const NOTE_PREFIX = "E2E権限確認";

async function main(): Promise<void> {
  const { rawPrisma } = (await import("@solar/db")) as typeof import("@solar/db");

  const restored = await rawPrisma.relationship.updateMany({
    where: { note: { startsWith: NOTE_PREFIX } },
    data: { note: null },
  });
  const leftover = await rawPrisma.relationship.count({
    where: { note: { startsWith: NOTE_PREFIX } },
  });

  console.info(`[cleanup-e2e-settings] restored=${restored.count} leftover=${leftover}`);

  await rawPrisma.$disconnect();
}

main().catch((err) => {
  console.error("[cleanup-e2e-settings] failed", err);
  process.exit(1);
});
