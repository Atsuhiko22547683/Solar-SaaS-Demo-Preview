import { resolve } from "node:path";

import { config } from "dotenv";

// E2E データクリーンアップ — setup-e2e-staff-assignee.ts が作った
// スタッフ 3 名と顧客 3 件を削除する。
//
// 安全性:
//   - 対象は argv[2] の RUN_ID から組み立てた完全一致の名前だけ。
//     部分一致（LIKE / contains）では消さない。
//   - 顧客を先に消してから（Customer.*SalespersonId が Salesperson を参照するため）
//     スタッフを消す。FK は ON DELETE SET NULL なので順序は保険。
//   - Relationship / User（デモユーザー）は既存データなので削除しない。
//     スタッフ側の userId リンクはスタッフ行ごと消えるので後始末は不要。
//
// RLS を経由しない rawPrisma を使うのは seed/migration と同じ運用例外。

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
config({ path: resolve(REPO_ROOT, ".env.local") });

async function main(): Promise<void> {
  const { rawPrisma } = (await import("@solar/db")) as typeof import("@solar/db");

  const runId = process.argv[2];
  if (!runId || !/^\d+$/.test(runId)) {
    console.error("[cleanup-e2e-staff-assignee] RUN_ID（数字のみ）を引数で渡してください");
    process.exit(1);
    return;
  }

  // setup 側と同じ組み立て方をする。
  const customerNames = [
    `E2E自社担当顧客${runId}`,
    `E2E二次店既存顧客${runId}`,
    `E2E未割当顧客${runId}`,
  ];
  const staffNames = [`E2E自社担当${runId}`, `E2E二次店担当A${runId}`, `E2E二次店担当B${runId}`];

  const customers = await rawPrisma.customer.findMany({
    where: { name: { in: customerNames } },
    select: { id: true },
  });
  const customerIds = customers.map((c) => c.id);
  if (customerIds.length > 0) {
    await rawPrisma.appointment.deleteMany({ where: { customerId: { in: customerIds } } });
    await rawPrisma.deal.deleteMany({ where: { customerId: { in: customerIds } } });
  }
  const removedCustomers = await rawPrisma.customer.deleteMany({
    where: { name: { in: customerNames } },
  });
  const removedStaff = await rawPrisma.salesperson.deleteMany({
    where: { name: { in: staffNames } },
  });

  const leftover = {
    customers: await rawPrisma.customer.count({ where: { name: { in: customerNames } } }),
    staff: await rawPrisma.salesperson.count({ where: { name: { in: staffNames } } }),
  };
  console.info(
    `[cleanup-e2e-staff-assignee] customers=${removedCustomers.count} staff=${removedStaff.count} ` +
      `leftover=${JSON.stringify(leftover)} runId=${runId}`,
  );

  await rawPrisma.$disconnect();
}

main().catch((err) => {
  console.error("[cleanup-e2e-staff-assignee] failed", err);
  process.exit(1);
});
