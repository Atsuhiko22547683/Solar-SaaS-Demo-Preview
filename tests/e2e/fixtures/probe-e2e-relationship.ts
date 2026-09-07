import { resolve } from "node:path";

import { config } from "dotenv";

// E2E プローブ — 取引先の論理削除を DB 側から確認する。
//
//   - この spec が作った Relationship が「行として残っている」こと
//   - その status が TERMINATED であること
//   - デモ卸業者と繋がっている取引先名の一覧（越境検証の期待値）
//
// 読み取り専用。RLS を経由しない rawPrisma を使うのは seed/fixture と同じ運用例外。

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
config({ path: resolve(REPO_ROOT, ".env.local") });

const DEMO_EMAIL = "demo@solar-saas.demo";

async function main(): Promise<void> {
  const { rawPrisma } = (await import("@solar/db")) as typeof import("@solar/db");

  const runId = process.argv[2];
  if (!runId || !/^\d+$/.test(runId)) {
    console.error("[probe-e2e-relationship] RUN_ID（数字のみ）を引数で渡してください");
    process.exit(1);
    return;
  }
  const dealerName = `E2E取引先${runId}`;

  const rel = await rawPrisma.relationship.findFirst({
    where: { dealer: { name: dealerName } },
    select: { id: true, status: true },
  });

  const demo = await rawPrisma.user.findFirst({
    where: { email: DEMO_EMAIL },
    select: { tenantId: true },
  });
  const rels = demo
    ? await rawPrisma.relationship.findMany({
        where: { wholesalerId: demo.tenantId, status: { not: "TERMINATED" } },
        select: { dealer: { select: { name: true } } },
      })
    : [];

  console.info(
    JSON.stringify({
      exists: rel !== null,
      status: rel?.status ?? null,
      dealerNames: rels.map((r) => r.dealer.name),
    }),
  );

  await rawPrisma.$disconnect();
}

main().catch((err) => {
  console.error("[probe-e2e-relationship] failed", err);
  process.exit(1);
});
