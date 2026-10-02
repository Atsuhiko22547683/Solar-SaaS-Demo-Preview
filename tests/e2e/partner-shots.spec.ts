import { expect, test, type Page } from "@playwright/test";

// スクリーンショット採取用（報告添付）。検証ではなく記録が目的。
// 実行: pnpm exec playwright test --config=playwright.partner.config.ts fixtures/_shots.spec.ts

const PASSWORD = "Pilot!2026";
const OUT = "screenshots";

test.describe.configure({ timeout: 300_000 });

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "サインイン" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
}

async function shot(page: Page, name: string, path: string): Promise<void> {
  await page.goto(path, { timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

test("staff: 390px の主要画面", async ({ page, baseURL }) => {
  test.skip(!(baseURL ?? "").includes("3200"), "スタッフサイト用");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login", { timeout: 120_000 });
  await page.screenshot({ path: `${OUT}/staff-390-login.png`, fullPage: true });
  await signIn(page, "alpha-staff@solar-saas.dev");
  await shot(page, "staff-390-home", "/p-home");
  await shot(page, "staff-390-appointments", "/p-appointments");
  await shot(page, "staff-390-catalog", "/p-catalog");
  await shot(page, "staff-390-form", "/p-appointments/new?type=first-visit");
  // メニューを開いた状態。
  await page.goto("/p-reports", { timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /メニューを開く/ }).click();
  await expect(page.getByRole("button", { name: /メニューを閉じる/ })).toBeVisible();
  await page.screenshot({ path: `${OUT}/staff-390-menu-open.png`, fullPage: true });
});

test("admin: 390px の主要画面", async ({ page, baseURL }) => {
  test.skip(!(baseURL ?? "").includes("3300"), "管理者サイト用");
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "alpha-admin@solar-saas.dev");
  await shot(page, "admin-390-home", "/p-home");
  await shot(page, "admin-390-reports", "/p-reports");
  await shot(page, "admin-390-accounts", "/p-accounts");
  await shot(page, "admin-390-commissions", "/p-commissions");
  await shot(page, "admin-390-lane", "/p-lane-preferences");
  // メニューを開いた状態（9 業務 + トップ）。
  await page.goto("/p-customers", { timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /メニューを開く/ }).click();
  await expect(page.getByRole("button", { name: /メニューを閉じる/ })).toBeVisible();
  await page.screenshot({ path: `${OUT}/admin-390-menu-open.png`, fullPage: true });
  // 320px の最小幅も 1 枚。
  await page.setViewportSize({ width: 320, height: 844 });
  await shot(page, "admin-320-reports", "/p-reports");
});

/** 追従ヘッダの記録（スクロール後・メニューを開いた状態）。viewport だけを写す。 */
async function stickyShots(page: Page, prefix: string): Promise<void> {
  await page.goto("/p-reports", { timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
  await page.waitForTimeout(1000);
  // 下までスクロールした状態。
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${prefix}-sticky-scrolled.png` });
  // スクロール途中でメニューを開いた状態。
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /メニューを開く/ }).click();
  await expect(page.getByRole("button", { name: /メニューを閉じる/ })).toBeVisible();
  await page.screenshot({ path: `${OUT}/${prefix}-sticky-menu.png` });
}

test("staff: 追従ヘッダ（390px）", async ({ page, baseURL }) => {
  test.skip(!(baseURL ?? "").includes("3200"), "スタッフサイト用");
  await page.setViewportSize({ width: 390, height: 700 });
  await signIn(page, "alpha-staff@solar-saas.dev");
  await stickyShots(page, "staff-390");
});

test("admin: 追従ヘッダ（390px / 320px / 横向き）", async ({ page, baseURL }) => {
  test.skip(!(baseURL ?? "").includes("3300"), "管理者サイト用");
  await signIn(page, "alpha-admin@solar-saas.dev");
  await page.setViewportSize({ width: 390, height: 700 });
  await stickyShots(page, "admin-390");
  await page.setViewportSize({ width: 320, height: 700 });
  await stickyShots(page, "admin-320");
  // 横向き（高さが狭い）。メニュー内が縦スクロールになる。
  await page.setViewportSize({ width: 430, height: 320 });
  await stickyShots(page, "admin-landscape");
  // PC 幅。ナビは横並びタブのまま追従する。
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/p-reports", { timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/admin-1280-sticky-scrolled.png` });
});
