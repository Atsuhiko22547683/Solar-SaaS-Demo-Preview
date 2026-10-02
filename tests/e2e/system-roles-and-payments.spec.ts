import { expect, test, type Locator, type Page } from "@playwright/test";

// システムユーザーの 3 ロールと決済管理の最小 E2E。
//
//   A. オーナー         — 設定が見える / 決済管理が見える / /payments 200
//   B. システム管理者    — 設定が見える / 決済管理が見えない / /payments 403
//   C. 一般ユーザー      — 設定が見えない / 決済管理が見える / /payments 200 / /members 403
//   D. システムユーザー編集 — ロール選択肢が 3 つだけ / 保存できる
//   E. 決済管理         — 契約済顧客だけ / 決済情報・履歴 / Stripe リンク（target=_blank）
//
// アカウントは seed が用意する確認用 3 件（パスワードは共通のデモ用）。

const PASSWORD = "Demo1234!";
const OWNER = "owner@solar-saas.demo";
const SYSTEM_ADMIN = "sysadmin@solar-saas.demo";
const GENERAL_USER = "user@solar-saas.demo";
const FORBIDDEN = "この情報にアクセスできません";

test.describe.configure({ timeout: 180_000 });

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "サインイン" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
}

/**
 * システムユーザーの行を開いて、その展開バナーを返す。
 * 既に開いている行は閉じないよう、「詳細を開く」があるときだけ押す。
 */
async function openMemberRow(page: Page, row: Locator): Promise<Locator> {
  const opener = row.getByRole("button", { name: /詳細を開く/ });
  if ((await opener.count()) > 0) await opener.click();
  return page.getByRole("table").locator("tbody tr").filter({ hasText: "2FA" }).first();
}

/** サイドバーのトップレベル項目が出ているか。 */
function navItem(page: Page, label: string) {
  return page.getByRole("navigation").getByText(label, { exact: true });
}

test("A: オーナーは設定も決済管理も使える", async ({ page }) => {
  await signIn(page, OWNER);

  await expect(navItem(page, "設定")).toBeVisible({ timeout: 90_000 });
  await expect(navItem(page, "決済管理")).toBeVisible();

  await page.goto("/payments", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "決済管理", level: 1 })).toBeVisible({
    timeout: 90_000,
  });
});

test("B: システム管理者は設定を使えるが決済管理は 403", async ({ page }) => {
  await signIn(page, SYSTEM_ADMIN);

  await expect(navItem(page, "設定")).toBeVisible({ timeout: 90_000 });
  await expect(navItem(page, "決済管理")).toHaveCount(0);

  await page.goto("/payments", { timeout: 120_000 });
  await expect(page.getByText(FORBIDDEN).first()).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("heading", { name: "決済管理", level: 1 })).toHaveCount(0);
});

test("C: 一般ユーザーは設定も決済管理も 403", async ({ page }) => {
  await signIn(page, GENERAL_USER);

  // 決済管理は BizOrch の利用契約を扱う画面なのでオーナー専用。
  await expect(navItem(page, "決済管理")).toHaveCount(0);
  await expect(navItem(page, "設定")).toHaveCount(0);

  // 設定配下も決済管理も URL 直打ちで 403。
  for (const path of [
    "/payments",
    "/members",
    "/salespeople",
    "/masters",
    "/masters/relationships",
  ]) {
    await page.goto(path, { timeout: 120_000 });
    await expect(page.getByText(FORBIDDEN).first(), `${path} は 403`).toBeVisible({
      timeout: 90_000,
    });
  }
  await expect(page.getByRole("heading", { name: "決済管理", level: 1 })).toHaveCount(0);
});

test("D: システムユーザー編集のロール選択肢は 3 つだけで、保存できる", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/members", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "システムユーザー" })).toBeVisible({
    timeout: 90_000,
  });

  // 確認用の「デモ 一般ユーザー」の行を編集する。
  const row = page
    .getByRole("table")
    .locator("tbody tr")
    .filter({ hasText: "デモ 一般ユーザー" })
    .first();
  // 操作は展開バナー側にあるので、まず行を開く。
  const banner = await openMemberRow(page, row);
  await banner.getByRole("button", { name: "編集" }).click();

  const dialog = page.getByRole("dialog");
  const select = dialog.getByLabel("ロール");
  const options = (await select.locator("option").allInnerTexts()).map((s) => s.trim());
  expect(options).toEqual(["オーナー", "システム管理者", "一般ユーザー"]);

  // 一度システム管理者にして保存 → 戻す。保存が通ることの確認。
  await select.selectOption({ label: "システム管理者" });
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 90_000 });
  await expect(row).toContainText("システム管理者", { timeout: 90_000 });

  const banner2 = await openMemberRow(page, row);
  await banner2.getByRole("button", { name: "編集" }).click();
  await page.getByRole("dialog").getByLabel("ロール").selectOption({ label: "一般ユーザー" });
  await page.getByRole("dialog").getByRole("button", { name: "保存" }).click();
  await expect(row).toContainText("一般ユーザー", { timeout: 90_000 });
});

test("E: 決済管理は BizOrch の利用契約を表示し、顧客データを出さない", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/payments", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "決済管理", level: 1 })).toBeVisible({
    timeout: 90_000,
  });

  // A. 決済情報 — 契約プラン / 利用料金 / 契約期間 / 支払い方法 / 次回請求日 / 支払い状態。
  await expect(page.getByRole("heading", { name: "決済情報" })).toBeVisible();
  for (const field of [
    "契約プラン",
    "利用料金",
    "契約期間",
    "支払い方法",
    "次回請求日",
    "現在の支払い状態",
  ]) {
    await expect(page.getByText(field, { exact: true }), field).toBeVisible();
  }
  // 支払い方法は Stripe から取得したカード。ブランド + 下 4 桁までで、
  // カード番号そのものは決して出さない。未登録なら「未登録」。
  const method = page.getByText(/(•••• \d{4}|^カード$|^未登録$)/).first();
  await expect(method).toBeVisible();
  // 下 4 桁より長い数字の並び（= カード番号らしきもの）が出ていないこと。
  await expect(page.locator("main")).not.toHaveText(/\d{7,}/);

  // B. 決済履歴 — 利用料の請求記録はまだ無いので空状態。架空の履歴を出さない。
  await expect(page.getByRole("heading", { name: "決済履歴" })).toBeVisible();
  await expect(page.getByText("決済履歴はまだありません")).toBeVisible();

  // 顧客側の決済概念は一切出さない（画面の意味が違うため）。
  // サイドバーのメニュー名に当たらないよう、ページ本文（main）だけを見る。
  const body = page.locator("main");
  for (const forbidden of ["顧客", "契約金額", "入金", "施工", "一部決済", "決済済"]) {
    await expect(body.getByText(forbidden), forbidden).toHaveCount(0);
  }

  // 決済管理ページ（Stripe カスタマーポータル）への導線。
  // 以前の「Stripeで管理」= ダッシュボードのトップを開く外部リンクは廃止した。
  // ポータルの URL は 1 回限りの署名付きなので、リンクではなく押したときに作る。
  await expect(page.getByText("Stripeで管理")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /決済管理ページ|決済情報を登録/ })).toBeVisible();
});
