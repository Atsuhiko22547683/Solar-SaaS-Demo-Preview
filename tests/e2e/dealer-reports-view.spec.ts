import { expect, test, type Page } from "@playwright/test";

// 代理店側で、二次店が提出した内容（催事日報 / 訪問アポ / 成約）を確認できること（閲覧専用）。
//
// 二次店ポータル側の登録は partner-portal.spec.ts が担当する。ここは
// 「二次店が登録した内容が代理店側から見えるか」「編集導線が無いか」だけを見る。
//
// 旧「パートナー報告」メニューは撤去し、日報は催事詳細、訪問アポ・成約は顧客詳細で
// 見る導線に変わった。旧 URL は残してあり、開くと統合先を案内する。
//
// dev server は agency（APP_VARIANT 未設定）で起動している前提。

const OWNER = "owner@solar-saas.demo";
const PASSWORD = "Demo1234!";

test.describe.configure({ timeout: 180_000 });

test.skip(process.env.APP_VARIANT === "partner", "代理店環境（APP_VARIANT 未設定）で実行する");

async function signIn(page: Page): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(OWNER);
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "サインイン" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
}

test("代理店は二次店の催事日報を閲覧できる（編集導線は無い）", async ({ page }) => {
  await signIn(page);
  await page.goto("/dealer-reports", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "パートナー 催事日報" })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText("この画面は閲覧専用です")).toBeVisible();

  const rows = page.getByRole("table").locator("tbody tr");
  const count = await rows.count();
  test.skip(count === 0, "二次店の日報がまだ無い環境ではスキップ");

  // 二次店名が出る（どの会社の報告か分かる）。
  await expect(rows.first()).not.toBeEmpty();

  // 詳細へ。実績は両面 / 片面 / 合計で並ぶ。
  await rows.first().getByRole("link").first().click();
  await expect(page.getByRole("heading", { name: "催事日報詳細" })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByRole("rowheader", { name: "抽選数" })).toBeVisible();
  await expect(page.getByText("両面")).toBeVisible();
  await expect(page.getByText("片面")).toBeVisible();

  // 閲覧専用。登録・編集・削除の導線を置かない。
  await expect(page.getByRole("button", { name: /編集|削除|登録/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /編集|削除|登録/ })).toHaveCount(0);
});

test("旧「パートナー報告」メニューは無く、旧 URL は統合先を案内する", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard", { timeout: 120_000 });
  const nav = page.getByRole("navigation").first();
  await expect(nav.getByRole("button", { name: "パートナー報告" })).toHaveCount(0);
  // 撤去した「未紐付けのパートナー日報」への導線も無い。
  await expect(nav.getByRole("link", { name: "未紐付けのパートナー日報" })).toHaveCount(0);

  // 旧 URL は行き止まりにせず、統合先を示す。
  await page.goto("/dealer-reports", { timeout: 120_000 });
  await expect(page.getByText("イベント詳細の「日報・実績（パートナー会社）」")).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText("未紐付けのパートナー日報")).toHaveCount(0);
});

test("日報は催事詳細の「日報・実績（パートナー会社）」から見る", async ({ page }) => {
  await signIn(page);
  await page.goto("/events?from=2020-01-01&to=2030-12-31", { timeout: 120_000 });
  const rows = page.getByRole("table").locator("tbody tr");
  const count = await rows.count();
  test.skip(count === 0, "催事がまだ無い環境ではスキップ");
  await rows.first().click();
  await expect(page).toHaveURL(/\/event-detail\//, { timeout: 90_000 });
  await expect(page.getByText("日報・実績（パートナー会社）")).toBeVisible({ timeout: 90_000 });
});

test("代理店は二次店の訪問アポを閲覧できる（編集導線は無い）", async ({ page }) => {
  await signIn(page);
  await page.goto("/dealer-submissions/visit-appointments", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "パートナー 訪問アポ" })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText("この画面は閲覧専用です")).toBeVisible();

  const rows = page.getByRole("table").locator("tbody tr");
  const count = await rows.count();
  test.skip(count === 0, "二次店の訪問アポがまだ無い環境ではスキップ");

  await rows.first().getByRole("link").first().click();
  await expect(page.getByRole("heading", { name: "訪問アポ詳細" })).toBeVisible({
    timeout: 90_000,
  });
  // 訪問アポフォームの 5 項目が並ぶ。
  await expect(page.getByText("クローズ部署")).toBeVisible();
  await expect(page.getByText("マエカク実施者")).toBeVisible();

  // 閲覧専用。登録・編集・削除の導線を置かない。
  await expect(page.getByRole("button", { name: /編集|削除|登録/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /編集|削除|登録/ })).toHaveCount(0);
});

test("代理店は二次店の成約を閲覧できる（編集導線は無い）", async ({ page }) => {
  await signIn(page);
  await page.goto("/dealer-submissions/contracts", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "パートナー 成約" })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText("この画面は閲覧専用です")).toBeVisible();

  const rows = page.getByRole("table").locator("tbody tr");
  const count = await rows.count();
  test.skip(count === 0, "二次店の成約がまだ無い環境ではスキップ");

  await rows.first().getByRole("link").first().click();
  await expect(page.getByRole("heading", { name: "成約詳細" })).toBeVisible({ timeout: 90_000 });
  // 成約フォームの 9 項目が並ぶ。
  await expect(page.getByText("取次拠点")).toBeVisible();
  await expect(page.getByText("アポ獲得時チャネル")).toBeVisible();

  await expect(page.getByRole("button", { name: /編集|削除|登録/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /編集|削除|登録/ })).toHaveCount(0);
});

test("訪問アポ・成約は顧客詳細の「パートナー会社からの提出」から見る", async ({ page }) => {
  await signIn(page);
  await page.goto("/customers", { timeout: 120_000 });
  const rows = page.locator("tbody tr");
  const count = await rows.count();
  test.skip(count === 0, "顧客がまだ無い環境ではスキップ");
  await rows.first().click();
  await expect(page).toHaveURL(/\/customers\//, { timeout: 90_000 });
  const base = page.url().split("?")[0];
  await page.goto(`${base}?tab=history`, { timeout: 120_000 });
  await expect(page.getByText("パートナー会社からの提出")).toBeVisible({ timeout: 90_000 });
});
