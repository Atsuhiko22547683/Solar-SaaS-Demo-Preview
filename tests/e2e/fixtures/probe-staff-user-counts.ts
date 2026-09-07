import { resolve } from "node:path";

import { config } from "dotenv";

// E2E プローブ — スタッフ（Salesperson）とシステムユーザー（User）が
// 完全に分離されていることを DB 側から確認する。
//
// 出力: デモ卸業者テナントの Salesperson / User の件数と、
//       指定名のスタッフ・ユーザーの残存状態（論理削除の確認用）。
//
// 読み取り専用。RLS を経由しない rawPrisma を使うのは fixture の運用例外。

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
config({ path: resolve(REPO_ROOT, ".env.local") });

const DEMO_EMAIL = "demo@solar-saas.demo";

async function main(): Promise<void> {
  const { rawPrisma } = (await import("@solar/db")) as typeof import("@solar/db");

  const runId = process.argv[2];
  if (!runId || !/^\d+$/.test(runId)) {
    console.error("[probe-staff-user-counts] RUN_ID（数字のみ）を引数で渡してください");
    process.exit(1);
    return;
  }

  const demo = await rawPrisma.user.findFirst({
    where: { email: DEMO_EMAIL },
    select: { tenantId: true },
  });
  if (!demo) {
    console.error("[probe-staff-user-counts] デモユーザーが見つかりません");
    process.exit(1);
    return;
  }

  const staffName = `E2E分離スタッフ${runId}`;

  const [salespersonCount, userCount, staff] = await Promise.all([
    rawPrisma.salesperson.count({ where: { wholesalerId: demo.tenantId } }),
    rawPrisma.user.count({ where: { tenantId: demo.tenantId } }),
    rawPrisma.salesperson.findFirst({
      where: { wholesalerId: demo.tenantId, name: staffName },
      select: { id: true, isActive: true, userId: true },
    }),
  ]);

  console.info(
    JSON.stringify({
      salespersonCount,
      userCount,
      staffExists: staff !== null,
      staffIsActive: staff?.isActive ?? null,
      // スタッフ登録で User と紐付いていないこと（分離の確認）。
      staffUserId: staff?.userId ?? null,
    }),
  );

  await rawPrisma.$disconnect();
}

main().catch((err) => {
  console.error("[probe-staff-user-counts] failed", err);
  process.exit(1);
});
