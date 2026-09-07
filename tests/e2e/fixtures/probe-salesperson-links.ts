import { resolve } from "node:path";

import { config } from "dotenv";

// E2E プローブ — 1 人の Salesperson が
//   顧客のトスアップ担当 / クロージング担当 / イベント配置
// で同じ id として参照されていることを DB 側から確認する。
//
// 引数: argv[2] = Salesperson.id
// 読み取り専用。RLS を経由しない rawPrisma を使うのは fixture の運用例外。

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
config({ path: resolve(REPO_ROOT, ".env.local") });

async function main(): Promise<void> {
  const { rawPrisma } = (await import("@solar/db")) as typeof import("@solar/db");

  const salespersonId = process.argv[2];
  if (!salespersonId) {
    console.error("[probe-salesperson-links] Salesperson.id を引数で渡してください");
    process.exit(1);
    return;
  }

  const [staff, tossUp, closing, events, tossUpUserLeak, closingUserLeak] = await Promise.all([
    rawPrisma.salesperson.findUnique({
      where: { id: salespersonId },
      select: { id: true, name: true, isActive: true, relationshipId: true },
    }),
    rawPrisma.customer.count({ where: { tossUpSalespersonId: salespersonId } }),
    rawPrisma.customer.count({ where: { closingSalespersonId: salespersonId } }),
    rawPrisma.eventSalesperson.count({ where: { salespersonId } }),
    // 新規保存で *UserId が書かれていないこと（User をスタッフマスタにしない）。
    rawPrisma.customer.count({
      where: { tossUpSalespersonId: salespersonId, NOT: { tossUpUserId: null } },
    }),
    rawPrisma.customer.count({
      where: { closingSalespersonId: salespersonId, NOT: { closingUserId: null } },
    }),
  ]);

  console.info(
    JSON.stringify({
      exists: staff !== null,
      name: staff?.name ?? null,
      isActive: staff?.isActive ?? null,
      relationshipId: staff?.relationshipId ?? null,
      tossUpCustomerCount: tossUp,
      closingCustomerCount: closing,
      eventAssignmentCount: events,
      tossUpUserIdLeak: tossUpUserLeak,
      closingUserIdLeak: closingUserLeak,
    }),
  );

  await rawPrisma.$disconnect();
}

main().catch((err) => {
  console.error("[probe-salesperson-links] failed", err);
  process.exit(1);
});
