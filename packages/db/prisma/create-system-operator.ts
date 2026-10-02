// 運営者（BizOrch 運営管理サイトを使える人）をローカルで作る。
//
// 公開の登録画面や、通常利用者が自分で運営者になる経路は用意しない。
// 運営者を増やすのは「既にいる運営者が運営者管理から招待する」か、この手順だけ。
//
// 実行（ローカル確認用 DB のみ）:
//   pnpm ops:create-operator -- --email ops@example.com --name "運営 太郎" --password 'Pilot!2026'
//
//   --email    必須。既にある利用者ならその人に運営権限を足す。
//   --name     新規作成のときの表示名。
//   --password 新規作成のときの初期パスワード。省略すると招待状態（サインイン不可）で作る。
//   --tenant   所属させる会社の id。省略すると既存の運営会社（SaaS 運営）を使う。

import "./seed-env.js";

import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function assertLocalDb(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    throw new Error(
      "運営者の作成はローカルの確認用 DB でのみ実行します（本番での実行は想定していません）。",
    );
  }
  return url;
}

async function main(): Promise<void> {
  const url = assertLocalDb();
  const email = arg("email")?.trim().toLowerCase();
  if (!email) throw new Error("--email は必須です");
  const name = arg("name") ?? email;
  const password = arg("password");
  const tenantArg = arg("tenant");

  console.info(`[ops] 接続先 ${url.replace(/:\/\/([^:]*):[^@]*@/, "://$1:***@")}`);

  // 所属先。指定が無ければ既存の運営会社（SaaS 運営）を使い、無ければ作らずに止める。
  const tenant = tenantArg
    ? await prisma.tenant.findUnique({ where: { id: tenantArg }, select: { id: true, name: true } })
    : await prisma.tenant.findFirst({
        where: { type: "WHOLESALER", name: { contains: "運営" } },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true },
      });
  if (!tenant) {
    throw new Error(
      "所属させる会社が見つかりません。--tenant <id> で指定するか、先に pnpm db:seed を実行してください。",
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, status: true, roles: { select: { role: true } } },
  });

  let userId: string;
  if (existing) {
    userId = existing.id;
    if (existing.roles.some((r) => r.role === "SAAS_ADMIN")) {
      console.info(`[ops] ${email} は既に運営者です（変更なし）`);
    } else {
      await prisma.userRole.create({ data: { userId, role: "SAAS_ADMIN" } });
      console.info(`[ops] ${email} に運営権限を付与しました`);
    }
  } else {
    const passwordHash = password ? await argon2.hash(password, { type: argon2.argon2id }) : null;
    const created = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email,
        name,
        passwordHash,
        // パスワードを渡さなければ招待状態のまま（サインインできない）。
        status: passwordHash ? "ACTIVE" : "INVITED",
        // 本番公開時は運営者の多要素認証を必須にする。既定で必須の印を付けておく。
        twoFactorRequired: true,
        roles: { create: [{ role: "SAAS_ADMIN" }] },
      },
      select: { id: true },
    });
    userId = created.id;
    console.info(
      `[ops] 運営者を作成しました: ${email}（所属: ${tenant.name} / 状態: ${passwordHash ? "ACTIVE" : "INVITED"}）`,
    );
  }

  const operators = await prisma.user.count({
    where: { roles: { some: { role: "SAAS_ADMIN" } }, status: "ACTIVE" },
  });
  console.info(`[ops] 有効な運営者: ${operators} 人 / userId=${userId}`);
  console.info("[ops] 運営管理サイト: http://localhost:3400/s-dashboard");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
