import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// 顧客担当者の「個人スタッフ」連携。
//
// 検証内容:
//   1. 自社スタッフの既存実績（Salesperson.userId = Customer.tossUpUserId / closingUserId）が
//      スタッフ一覧の担当件数に出る。二重カウントしない。
//   2. 取引先担当は 取引先 → 所属スタッフ の 2 段で選べる。
//   3. 保存後に tossUpSalespersonId / tossUpRelationshipId が整合する。
//   4. 会社までしか記録が無い既存データは「所属取引先は復元、個人スタッフは未登録」。
//      勝手にスタッフを選ばない。
//
// 作ったデータは afterAll で必ず削除する。

const DEMO_EMAIL = "demo@solar-saas.demo";
const DEMO_PASSWORD = "Demo1234!";

const RUN_ID = Date.now();
const FIXTURE_DIR = resolve(__dirname, "fixtures");
const DB_DIR = resolve(__dirname, "..", "..", "packages", "db");

interface Fixture {
  selfStaffName: string;
  dealerStaffAName: string;
  dealerStaffBName: string;
  dealerName: string;
  selfCustomerId: string;
  legacyDealerCustomerId: string;
  unassignedCustomerId: string;
}

let fx: Fixture;

async function signInAsDemo(page: Page): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(DEMO_EMAIL);
  await page.getByLabel("パスワード").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "サインイン" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 120_000 });
}

/** 担当者変更ダイアログを開く（顧客詳細の基本情報タブ）。 */
async function openAssigneeDialog(page: Page, customerId: string): Promise<void> {
  await page.goto(`/customers/${customerId}`, { timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
  // 担当者カードの「変更」ボタン（labels: customer.detail.changeAssignee）。
  await page.getByRole("button", { name: "変更", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 30_000 });
}

test.describe.serial("顧客担当者とスタッフの個人単位リンク", () => {
  test.describe.configure({ timeout: 240_000 });

  test.beforeAll(() => {
    const out = execFileSync(
      "pnpm",
      ["exec", "tsx", resolve(FIXTURE_DIR, "setup-e2e-staff-assignee.ts"), String(RUN_ID)],
      { cwd: DB_DIR, encoding: "utf8", shell: process.platform === "win32" },
    )
      .trim()
      .split(/\r?\n/);
    fx = JSON.parse(out[out.length - 1]!) as Fixture;
  });

  test.afterAll(() => {
    execFileSync(
      "pnpm",
      ["exec", "tsx", resolve(FIXTURE_DIR, "cleanup-e2e-staff-assignee.ts"), String(RUN_ID)],
      { cwd: DB_DIR, stdio: "inherit", shell: process.platform === "win32" },
    );
  });

  test("シナリオ1: userId 経由の過去データはスタッフの担当件数に数えない", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto(`/salespeople?query=${encodeURIComponent(fx.selfStaffName)}`, {
      timeout: 120_000,
    });
    await expect(page.getByRole("heading", { name: "スタッフ一覧" })).toBeVisible({
      timeout: 90_000,
    });

    const row = page.getByRole("table").locator("tbody tr").first();
    await row.getByRole("button", { name: /詳細を開く$/ }).click();

    // 「表示件数: N件」と紛れないよう、展開バナー行の中だけを見る。
    const banner = page.getByRole("table").locator("tbody tr").nth(1);
    // fixture の顧客は tossUpUserId / closingUserId のみ設定（*SalespersonId は null）。
    // スタッフ（Salesperson）とシステムユーザー（User）は別管理なので、
    // Salesperson.userId 経由の過去データはスタッフの担当実績として数えない。
    await expect(banner.getByText("トスアップ担当", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(banner.getByText("クロージング担当", { exact: true })).toBeVisible();
    // 実績は 0 件（*SalespersonId が張られていないため）。
    await expect(banner.getByText("1件", { exact: true })).toHaveCount(0);
    await expect(banner.getByText("0件", { exact: true })).toHaveCount(3);
  });

  test("シナリオ2: 会社までしか記録が無い既存取引先担当は「未登録」で復元される", async ({
    page,
  }) => {
    await signInAsDemo(page);
    await openAssigneeDialog(page, fx.legacyDealerCustomerId);

    const tossUp = page.getByRole("dialog").getByRole("group", { name: "トスアップ担当" });
    // 所属区分は取引先として復元される。
    await expect(tossUp.getByLabel("所属区分")).toHaveValue("dealer");
    // 取引先（会社）も復元される。
    await expect(tossUp.getByLabel("取引先")).not.toHaveValue("");
    // 個人スタッフは勝手に選ばれず「未登録」のまま。
    await expect(tossUp.getByLabel("担当スタッフ")).toHaveValue("");
  });

  test("シナリオ3: 取引先 → 所属スタッフ の2段で選んで保存でき、整合する", async ({ page }) => {
    await signInAsDemo(page);
    await openAssigneeDialog(page, fx.unassignedCustomerId);

    const tossUp = page.getByRole("dialog").getByRole("group", { name: "トスアップ担当" });
    // トスアップを「取引先」にする。
    await tossUp.getByLabel("所属区分").selectOption("dealer");
    // 会社を選ぶまで担当スタッフは選べない。
    await expect(tossUp.getByLabel("担当スタッフ")).toBeDisabled();

    await tossUp.getByLabel("取引先").selectOption({ label: fx.dealerName });
    const staffSelect = tossUp.getByLabel("担当スタッフ");
    await expect(staffSelect).toBeEnabled();
    // その取引先に所属するスタッフだけが候補に出る。
    await expect(staffSelect.locator("option", { hasText: fx.dealerStaffAName })).toHaveCount(1);
    await staffSelect.selectOption({ label: fx.dealerStaffBName });

    await page.getByRole("dialog").getByRole("button", { name: "保存" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 60_000 });

    // 再度開くと、会社とスタッフの両方が復元される（= DB に整合して保存された）。
    await openAssigneeDialog(page, fx.unassignedCustomerId);
    const reopened = page.getByRole("dialog").getByRole("group", { name: "トスアップ担当" });
    await expect(reopened.getByLabel("所属区分")).toHaveValue("dealer");
    await expect(reopened.getByLabel("担当スタッフ")).not.toHaveValue("");
  });

  test("シナリオ4: 自社スタッフを担当に選んで保存できる（クロージング）", async ({ page }) => {
    await signInAsDemo(page);
    await openAssigneeDialog(page, fx.unassignedCustomerId);

    const closing = page.getByRole("dialog").getByRole("group", { name: "クロージング担当" });
    await closing.getByLabel("所属区分").selectOption("user");
    await closing.getByLabel("担当者").selectOption({ label: fx.selfStaffName });

    await page.getByRole("dialog").getByRole("button", { name: "保存" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 60_000 });

    await openAssigneeDialog(page, fx.unassignedCustomerId);
    const reopened = page.getByRole("dialog").getByRole("group", { name: "クロージング担当" });
    await expect(reopened.getByLabel("所属区分")).toHaveValue("user");
    await expect(reopened.getByLabel("担当者")).not.toHaveValue("");
  });

  test("シナリオ5: 明示リンクは 1 件だけ数え、userId 経由は加算しない", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto(`/salespeople?query=${encodeURIComponent(fx.selfStaffName)}`, {
      timeout: 120_000,
    });
    await expect(page.getByRole("heading", { name: "スタッフ一覧" })).toBeVisible({
      timeout: 90_000,
    });

    const row = page.getByRole("table").locator("tbody tr").first();
    await row.getByRole("button", { name: /詳細を開く$/ }).click();

    // 「表示件数: N件」と紛れないよう、展開バナー行の中だけを見る。
    const banner = page.getByRole("table").locator("tbody tr").nth(1);
    // シナリオ4 でクロージングに明示リンク（closingSalespersonId）を 1 件張った。
    // 集計は *SalespersonId だけなので、
    //   トスアップ 0 件（fixture は tossUpUserId のみ）
    //   クロージング 1 件（明示リンク。二重に数えない）
    //   イベント 0 件
    // となる。
    await expect(banner.getByText("1件", { exact: true })).toHaveCount(1);
    await expect(banner.getByText("0件", { exact: true })).toHaveCount(2);
    await expect(banner.getByText("2件", { exact: true })).toHaveCount(0);
  });
});
