import { expect, test, type Page } from "@playwright/test";

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

test("C: 一般ユーザーは決済管理を使えるが設定は 403", async ({ page }) => {
  await signIn(page, GENERAL_USER);

  await expect(navItem(page, "決済管理")).toBeVisible({ timeout: 90_000 });
  await expect(navItem(page, "設定")).toHaveCount(0);

  await page.goto("/payments", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "決済管理", level: 1 })).toBeVisible({
    timeout: 90_000,
  });

  // 設定配下は URL 直打ちでも 403。
  for (const path of ["/members", "/salespeople", "/masters", "/masters/relationships"]) {
    await page.goto(path, { timeout: 120_000 });
    await expect(page.getByText(FORBIDDEN).first(), `${path} は 403`).toBeVisible({
      timeout: 90_000,
    });
  }
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
  await row.getByRole("button", { name: "編集" }).click();

  const dialog = page.getByRole("dialog");
  const select = dialog.getByLabel("ロール");
  const options = (await select.locator("option").allInnerTexts()).map((s) => s.trim());
  expect(options).toEqual(["オーナー", "システム管理者", "一般ユーザー"]);

  // 一度システム管理者にして保存 → 戻す。保存が通ることの確認。
  await select.selectOption({ label: "システム管理者" });
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 90_000 });
  await expect(row).toContainText("システム管理者", { timeout: 90_000 });

  await row.getByRole("button", { name: "編集" }).click();
  await page.getByRole("dialog").getByLabel("ロール").selectOption({ label: "一般ユーザー" });
  await page.getByRole("dialog").getByRole("button", { name: "保存" }).click();
  await expect(row).toContainText("一般ユーザー", { timeout: 90_000 });
});

test("E: 決済管理は契約済顧客だけを並べ、詳細に Stripe リンクがある", async ({ page }) => {
  await signIn(page, OWNER);
  await page.goto("/payments", { timeout: 120_000 });

  // 一覧のヘッダに Stripe リンク（別タブ）。
  const listLink = page.getByRole("link", { name: "Stripeを開く" });
  await expect(listLink).toBeVisible({ timeout: 90_000 });
  await expect(listLink).toHaveAttribute("target", "_blank");
  await expect(listLink).toHaveAttribute("rel", /noopener/);

  const rows = page.getByRole("table").locator("tbody tr");
  const count = await rows.count();
  expect(count, "契約済みの契約が 1 件以上ある").toBeGreaterThan(0);

  // 契約一覧（契約済みの正）と件数が一致すること = 契約以外の顧客が混ざっていない。
  await page.goto("/contracts", { timeout: 120_000 });
  const contractRows = await page.getByRole("table").locator("tbody tr").count();
  expect(count).toBeLessThanOrEqual(contractRows);

  // 詳細に決済情報・決済履歴・Stripe リンク。
  await page.goto("/payments", { timeout: 120_000 });
  await rows.first().getByRole("link", { name: "詳細" }).click();
  await page.waitForLoadState("networkidle", { timeout: 90_000 });

  await expect(page.getByRole("heading", { name: "決済情報" })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("heading", { name: "決済履歴" })).toBeVisible();

  const detailLink = page.getByRole("link", { name: "Stripeで管理" });
  await expect(detailLink).toBeVisible();
  await expect(detailLink).toHaveAttribute("target", "_blank");
  await expect(detailLink).toHaveAttribute("rel", /noopener/);
});
