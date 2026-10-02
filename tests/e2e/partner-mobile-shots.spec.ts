// スマートフォン幅（390px）の代表画面を記録する。検証ではなく記録が目的。
//
// 撮るのは今回追加・作り直した画面:
//   スタッフ … トップ（今週の催事シフト）/ 催事シフト（一覧・カレンダー）/ 顧客の商談履歴
//   管理者   … 出店希望の詳細 / スタッフの配置 / 場所確保の相談
//
// 出力先は tests/e2e/screenshots/。ページ全体ではなくビューポートを撮る
// （実際に見える範囲で崩れていないかを見るため）。

import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 300_000 });

const PASSWORD = "Pilot!2026";
const ADMIN = "alpha-admin@solar-saas.dev";
const STAFF = "alpha-staff@solar-saas.dev";
const DIR = "screenshots";
const PHONE = { width: 390, height: 844 };

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "サインイン" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
}

async function shoot(page: Page, path: string, name: string): Promise<void> {
  await page.goto(path, { timeout: 120_000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/${name}.png` });
}

function prefMonth(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

test("スタッフサイトの代表画面（390px）", async ({ page }) => {
  test.skip(
    !page.url().includes("3200") && !(test.info().project.name === "staff"),
    "スタッフ専用",
  );
  await page.setViewportSize(PHONE);
  await signIn(page, STAFF);

  await shoot(page, "/p-home", "m-staff-home-week");
  await shoot(page, "/p-shifts", "m-staff-shifts-list");
  await shoot(page, "/p-shifts?view=calendar", "m-staff-shifts-calendar");

  // 顧客の商談履歴。テストデータの顧客を開く。
  await page.goto("/p-customers", { timeout: 120_000 });
  const link = page.getByRole("link", { name: /\[DEMO\]/ }).first();
  if (await link.count()) {
    await link.click();
    await page.waitForURL(/\/p-customers\/[^/]+$/, { timeout: 120_000 });
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${DIR}/m-staff-customer-negotiation.png` });
  }
  expect(true).toBe(true);
});

test("管理者サイトの代表画面（390px）", async ({ page }) => {
  test.skip(test.info().project.name !== "admin", "管理者専用");
  await page.setViewportSize(PHONE);
  await signIn(page, ADMIN);

  await shoot(page, "/p-home", "m-admin-home");
  await shoot(
    page,
    `/p-shifts/assign?month=${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    "m-admin-shift-assign",
  );
  await shoot(page, "/p-consultations", "m-admin-consultations");

  await page.goto("/p-lane-preferences", { timeout: 120_000 });
  const pref = page.getByRole("link", { name: prefMonth() }).first();
  if (await pref.count()) {
    await pref.click();
    await page.waitForURL(/\/p-lane-preferences\/[^/]+$/, { timeout: 120_000 });
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${DIR}/m-admin-lane-preference-detail.png` });
  }
  expect(true).toBe(true);
});
