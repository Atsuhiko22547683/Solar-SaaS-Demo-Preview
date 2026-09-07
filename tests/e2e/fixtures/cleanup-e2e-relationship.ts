import { resolve } from "node:path";

import { config } from "dotenv";

// E2E データクリーンアップ — relationships-and-members.spec.ts が作った
// 取引先 Tenant と Relationship を削除する。
//
// 安全性:
//   - 対象は argv[2] の RUN_ID から組み立てた完全一致の名前だけ。
//     部分一致では消さない。
//   - seed 由来の取引先は対象外（この spec が新規作成した行のみ）。
//   - Relationship → Tenant の順に消す（FK のため）。
//
// RLS を経由しない rawPrisma を使うのは seed/fixture と同じ運用例外。

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
config({ path: resolve(REPO_ROOT, ".env.local") });

async function main(): Promise<void> {
  const { rawPrisma } = (await import("@solar/db")) as typeof import("@solar/db");

  const runId = process.argv[2];
  if (!runId || !/^\d+$/.test(runId)) {
    console.error("[cleanup-e2e-relationship] RUN_ID（数字のみ）を引数で渡してください");
    process.exit(1);
    return;
  }
  const dealerName = `E2E取引先${runId}`;

  const tenant = await rawPrisma.tenant.findFirst({
    where: { name: dealerName, type: "DEALER" },
    select: { id: true },
  });

  let rels = 0;
  let tenants = 0;
  if (tenant) {
    rels = (await rawPrisma.relationship.deleteMany({ where: { dealerId: tenant.id } })).count;
    tenants = (await rawPrisma.tenant.deleteMany({ where: { id: tenant.id } })).count;
  }

  const leftover = await rawPrisma.tenant.count({ where: { name: dealerName } });
  console.info(
    `[cleanup-e2e-relationship] relationships=${rels} tenants=${tenants} leftover=${leftover} runId=${runId}`,
  );

  await rawPrisma.$disconnect();
}

main().catch((err) => {
  console.error("[cleanup-e2e-relationship] failed", err);
  process.exit(1);
});
