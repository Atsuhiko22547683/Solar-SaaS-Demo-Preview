import { resolve } from "node:path";

import { config } from "dotenv";

// E2E セットアップ — Salesperson を作らずに User だけを 1 件足す。
//
// 「システムユーザーを増やしてもスタッフ集合は変わらない」ことを確かめるための
// 前提データ。User と Salesperson は別管理なので、ここでは Salesperson を作らない。
//
// 引数: argv[2] = RUN_ID / argv[3] = 氏名 / argv[4] = メールアドレス
// rawPrisma を使うのは fixture の運用例外。

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
config({ path: resolve(REPO_ROOT, ".env.local") });

async function main(): Promise<void> {
  const { rawPrisma } = (await import("@solar/db")) as typeof import("@solar/db");

  const [, , runId, name, email] = process.argv;
  if (!runId || !name || !email) {
    console.error("[setup-staff-master-consistency] RUN_ID / 氏名 / メール を渡してください");
    process.exit(1);
    return;
  }

  const wholesaler = await rawPrisma.tenant.findFirst({
    where: { name: "株式会社サンライズソーラー", type: "WHOLESALER" },
    select: { id: true },
  });
  if (!wholesaler) {
    console.error("[setup-staff-master-consistency] 卸業者テナントが見つかりません");
    process.exit(1);
    return;
  }

  const existing = await rawPrisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!existing) {
    await rawPrisma.user.create({
      data: {
        tenantId: wholesaler.id,
        email,
        name,
        // ログインさせないので argon2 ハッシュではなく無効値を入れる。
        passwordHash: "x",
        status: "ACTIVE",
        roles: { create: [{ role: "WHOLESALER_FIELD_STAFF" }] },
      },
    });
  }

  console.info(`[setup-staff-master-consistency] User を用意しました: ${name}`);
  await rawPrisma.$disconnect();
}

void main();
