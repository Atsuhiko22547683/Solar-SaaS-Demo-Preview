import { resolve } from "node:path";

import { config } from "dotenv";

// E2E データクリーンアップ — uc04-05-cancel-monthly.spec.ts が画面から作る
// 顧客 2 件（卸業者側 / ガンマ二次店側）と、そこにぶら下がる商談・契約一式を削除する。
//
// 旧 spec には cleanup が無く、実行のたびに顧客がローカル DB へ積み上がっていた
// （「UC-02 花子 <timestamp>」と同じ問題）。
//
// 月次レポート（MonthlyReport）は集計単位が「卸業者 × 対象月」で、この spec が
// 作った顧客専用の行ではない（seed の既存データとも共有される）ため、ここでは消さない。
//
// 安全性:
//   - 対象は argv[2] の RUN_ID から組み立てた完全一致の氏名 2 件だけ。
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
    console.error("[cleanup-uc0405-customers] RUN_ID（数字のみ）を引数で渡してください");
    process.exit(1);
    return;
  }

  // spec 側の WS_CUSTOMER_TAG / GAMMA_CUSTOMER_NAME と同じ組み立て方をする。
  const names = [`UC04WS顧客${runId}`, `UC05ガンマ顧客${runId}`];

  const customers = await rawPrisma.customer.findMany({
    where: { name: { in: names } },
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

  const removedCustomers = await rawPrisma.customer.deleteMany({ where: { name: { in: names } } });
  const leftover = await rawPrisma.customer.count({ where: { name: { in: names } } });

  console.info(
    `[cleanup-uc0405-customers] customers=${removedCustomers.count} deals=${removedDeals} ` +
      `contracts=${removedContracts} leftover=${leftover} runId=${runId}`,
  );

  await rawPrisma.$disconnect();
}

main().catch((err) => {
  console.error("[cleanup-uc0405-customers] failed", err);
  process.exit(1);
});
