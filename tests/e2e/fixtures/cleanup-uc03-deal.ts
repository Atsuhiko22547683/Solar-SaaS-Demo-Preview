import { resolve } from "node:path";

import { config } from "dotenv";

// E2E データクリーンアップ — uc02-03-deals-contracts.spec.ts が画面から作る
// 顧客・商品と、そこにぶら下がる商談 / 契約 / 明細 / 施工 / 申請を削除する。
//
// 旧 spec には cleanup が無く、実行のたびに顧客と商品がローカル DB へ積み上がって
// いた（「UC-02 花子 <timestamp>」と同じ問題）。
//
// 安全性:
//   - 対象は argv[2] の RUN_ID から組み立てた完全一致の名前だけ。
//     部分一致（LIKE / contains）では消さない。
//   - 参照の子側から順に消す。
//
// RLS を経由しない rawPrisma を使うのは seed/migration と同じ運用例外。

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
config({ path: resolve(REPO_ROOT, ".env.local") });

async function main(): Promise<void> {
  const { rawPrisma } = (await import("@solar/db")) as typeof import("@solar/db");

  const runId = process.argv[2];
  if (!runId || !/^\d+$/.test(runId)) {
    console.error("[cleanup-uc03-deal] RUN_ID（数字のみ）を引数で渡してください");
    process.exit(1);
    return;
  }

  // spec 側の CUSTOMER_NAME / PRODUCT_NAME と同じ組み立て方をする。
  const customerName = `UC03顧客${runId}`;
  const productName = `UC03商品${runId}`;

  const customers = await rawPrisma.customer.findMany({
    where: { name: customerName },
    select: { id: true },
  });
  const customerIds = customers.map((c) => c.id);

  let removedContracts = 0;
  let removedDeals = 0;
  if (customerIds.length > 0) {
    const contracts = await rawPrisma.contract.findMany({
      where: { customerId: { in: customerIds } },
      select: { id: true },
    });
    const contractIds = contracts.map((c) => c.id);
    if (contractIds.length > 0) {
      await rawPrisma.contractItem.deleteMany({ where: { contractId: { in: contractIds } } });
      await rawPrisma.contractPayment.deleteMany({ where: { contractId: { in: contractIds } } });
      await rawPrisma.construction.deleteMany({ where: { contractId: { in: contractIds } } });
      await rawPrisma.application.deleteMany({ where: { contractId: { in: contractIds } } });
      await rawPrisma.incentive.deleteMany({ where: { contractId: { in: contractIds } } });
      removedContracts = (
        await rawPrisma.contract.deleteMany({ where: { id: { in: contractIds } } })
      ).count;
    }
    removedDeals = (await rawPrisma.deal.deleteMany({ where: { customerId: { in: customerIds } } }))
      .count;
    await rawPrisma.appointment.deleteMany({ where: { customerId: { in: customerIds } } });
  }

  const removedCustomers = await rawPrisma.customer.deleteMany({ where: { name: customerName } });
  const removedProducts = await rawPrisma.product.deleteMany({ where: { name: productName } });

  console.info(
    `[cleanup-uc03-deal] customers=${removedCustomers.count} products=${removedProducts.count} ` +
      `deals=${removedDeals} contracts=${removedContracts} runId=${runId}`,
  );

  // 残量チェック（0 でなければ cleanup 漏れ）。
  const leftover = {
    customers: await rawPrisma.customer.count({ where: { name: customerName } }),
    products: await rawPrisma.product.count({ where: { name: productName } }),
  };
  console.info(`[cleanup-uc03-deal] leftover=${JSON.stringify(leftover)}`);

  await rawPrisma.$disconnect();
}

main().catch((err) => {
  console.error("[cleanup-uc03-deal] failed", err);
  process.exit(1);
});
