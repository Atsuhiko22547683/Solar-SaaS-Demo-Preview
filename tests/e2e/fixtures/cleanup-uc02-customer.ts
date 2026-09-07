import { resolve } from "node:path";

import { config } from "dotenv";

// E2E データクリーンアップ — UC-02 spec が画面から新規登録する顧客
// （`UC02花子<RUN_ID>`）とその配下データを削除する。
//
// この spec は「顧客登録 → アポ登録 → マエカク」を UI 操作で通すため、実データを
// 作って永続化する。cleanup が無いと実行のたびに顧客が 1 件ずつ増え、顧客一覧・
// コール一覧などに毎回テスト用の名前が並んでしまう（実際にローカルで発生した）。
//
// 安全性:
//   - 対象は argv[2] で渡された RUN_ID から組み立てた「完全一致の顧客名」1 件だけ。
//     RUN_ID は Date.now() 由来なので、その実行が作った顧客だけを一意に指せる。
//     （氏名そのものを引数にすると空白を含み、Windows の shell 経由で分割されるため
//       数字だけを渡してこちら側で組み立てる。）
//   - 部分一致（LIKE / contains）では消さない。prefix だけで一括削除すると別 spec や
//     手動確認で作った顧客まで巻き込むため。
//   - Deal / Contract が紐づいていたら削除せずエラーにする（この spec は契約を作らない。
//     想定外の関連データを黙って消さない）。
//
// RLS を経由しない rawPrisma を使うのは seed/migration と同じ運用例外
// （既存の cleanup-demo-*.ts と同じ方針）。

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
config({ path: resolve(REPO_ROOT, ".env.local") });

async function main(): Promise<void> {
  // 動的 import: dotenv の DATABASE_URL 注入後に @solar/db を読み込む。
  const { rawPrisma } = (await import("@solar/db")) as typeof import("@solar/db");

  const runId = process.argv[2];
  if (!runId || !/^\d+$/.test(runId)) {
    console.error("[cleanup-uc02-customer] RUN_ID（数字のみ）を引数で渡してください");
    process.exit(1);
    return;
  }
  // uc02-precall.spec.ts の CUSTOMER_NAME と同じ組み立て方をする。
  const customerName = `UC02花子${runId}`;

  const customers = await rawPrisma.customer.findMany({
    where: { name: customerName },
    select: { id: true, name: true },
  });
  if (customers.length === 0) {
    console.info(`[cleanup-uc02-customer] "${customerName}" は存在しない — 何もしない`);
    await rawPrisma.$disconnect();
    return;
  }

  const customerIds = customers.map((c) => c.id);

  // この spec は商談・契約を作らない。もし紐づいていたら想定外なので中断する。
  const [dealCount, contractCount] = await Promise.all([
    rawPrisma.deal.count({ where: { customerId: { in: customerIds } } }),
    rawPrisma.contract.count({ where: { customerId: { in: customerIds } } }),
  ]);
  if (dealCount > 0 || contractCount > 0) {
    throw new Error(
      `[cleanup-uc02-customer] 想定外の関連データ（deal=${dealCount} contract=${contractCount}）` +
        ` — 手動で確認してください: ${customerName}`,
    );
  }

  // FK の順に子から削除する。
  const appointments = await rawPrisma.appointment.findMany({
    where: { customerId: { in: customerIds } },
    select: { id: true },
  });
  const appointmentIds = appointments.map((a) => a.id);

  const reviews = await rawPrisma.loanReview.findMany({
    where: { customerId: { in: customerIds } },
    select: { id: true },
  });
  const reviewIds = reviews.map((r) => r.id);

  if (reviewIds.length > 0) {
    await rawPrisma.loanReviewLog.deleteMany({ where: { loanReviewId: { in: reviewIds } } });
    await rawPrisma.loanReview.deleteMany({ where: { id: { in: reviewIds } } });
  }
  if (appointmentIds.length > 0) {
    await rawPrisma.preCall.deleteMany({ where: { appointmentId: { in: appointmentIds } } });
    await rawPrisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
  }

  const byCustomer = { where: { customerId: { in: customerIds } } };
  await rawPrisma.customerCallLog.deleteMany(byCustomer);
  await rawPrisma.customerExistingEquipment.deleteMany(byCustomer);
  await rawPrisma.customerActivity.deleteMany(byCustomer);
  await rawPrisma.customerFile.deleteMany(byCustomer);
  await rawPrisma.customerMessage.deleteMany(byCustomer);
  await rawPrisma.customerTask.deleteMany(byCustomer);

  const removed = await rawPrisma.customer.deleteMany({ where: { id: { in: customerIds } } });

  console.info(`[cleanup-uc02-customer] removed customers=${removed.count} name="${customerName}"`);

  await rawPrisma.$disconnect();
}

main().catch((err) => {
  console.error("[cleanup-uc02-customer] failed", err);
  process.exit(1);
});
