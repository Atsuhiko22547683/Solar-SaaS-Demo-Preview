import { expect, test, type Page } from "@playwright/test";

// 代理店側で、二次店が提出した催事日報を確認できること（閲覧専用）。
//
// 二次店ポータル側の登録は partner-portal.spec.ts が担当する。ここは
// 「二次店が登録した内容が代理店側から見えるか」「編集導線が無いか」だけを見る。
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
  await expect(page.getByRole("heading", { name: "二次店 催事日報" })).toBeVisible({
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

test("サイドバーから二次店 催事日報へ到達できる", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard", { timeout: 120_000 });
  const nav = page.getByRole("navigation").first();
  await nav.getByRole("button", { name: "二次店報告" }).click();
  await nav.getByRole("link", { name: "二次店 催事日報" }).click();
  await expect(page).toHaveURL(/\/dealer-reports/, { timeout: 90_000 });
});
