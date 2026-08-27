import { expect, test, type Page } from "@playwright/test";

// 顧客詳細「売電状況」タブ（設置申請タブとコールタブの間）の検証。
//
// 管理項目は 顧客ごとの 売電開始日 + 備考 の 2 つだけ。申請 ID の独立項目は持たず、
// 「★申請ID：09174680」のような補足は備考へ自由記述する運用。
// 保存は既存の updateCustomerAction（customer.update 権限 + テナント境界）を使い、
// Customer.powerSaleStartDate / powerSaleNote へ永続化する。
//
// 認証は demo@solar-saas.demo / Demo1234!（WHOLESALER_ADMIN, 2FA off, seed 投入済）。
// Seed は tests/e2e/global-setup.ts で全 spec 起動前に 1 回だけ実行される。
// workers:1 + fullyParallel:false（tests/e2e/playwright.config.ts）に追従。

const DEMO_EMAIL = "demo@solar-saas.demo";
const DEMO_PASSWORD = "Demo1234!";

/** 備考の複数行サンプル（改行・全角記号・★申請ID を含む）。 */
const MULTILINE_NOTE =
  "店舗契約→2月21日の14時〜16時の間\n電力情報施工店共有済み〇\n★申請ID：09174680";

async function signInAsDemo(page: Page): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(DEMO_EMAIL);
  await page.getByLabel("パスワード").fill(DEMO_PASSWORD);
  const submit = page.getByRole("button", { name: "サインイン" });
  await expect(submit).toBeVisible();
  await submit.click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 120_000 });
}

/** 顧客一覧の先頭顧客の詳細を開き、その URL（?tab= 無し）を返す。 */
async function openFirstCustomer(page: Page): Promise<string> {
  await page.goto("/customers", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "顧客一覧" })).toBeVisible({ timeout: 90_000 });
  const row = page.getByRole("button", { name: /様$/ }).first();
  await expect(row).toBeVisible({ timeout: 90_000 });
  await row.click();
  await page.waitForURL(/\/customers\/[^/]+$/, { timeout: 90_000 });
  return page.url();
}

function powerSaleTab(page: Page) {
  return page.getByRole("tab", { name: "売電状況" });
}
function startDateInput(page: Page) {
  return page.locator("#power-sale-start");
}
function noteInput(page: Page) {
  return page.locator("#power-sale-note");
}

/**
 * 売電開始日を空へ戻す。
 * input[type=date] に対する fill("") は React の制御コンポーネントへ反映されないことが
 * あるため、実際の利用者と同じくキーボード（全選択 → Delete）で消す。
 */
async function clearStartDate(page: Page): Promise<void> {
  const input = startDateInput(page);
  await input.click();
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Delete");
  await expect(input).toHaveValue("");
}

/** 売電状況タブを開く（タブ本文が見えるまで待つ）。 */
async function openPowerSaleTab(page: Page): Promise<void> {
  await powerSaleTab(page).click();
  await expect(startDateInput(page)).toBeVisible({ timeout: 30_000 });
}

/** 保存し、リロードして DB に永続化されたことを確認できる状態にする。 */
async function saveAndReload(page: Page, url: string): Promise<void> {
  await page.getByRole("button", { name: "保存", exact: true }).click();
  // 保存トーストが出るまで待ってからリロード（refresh 競合の回避）。
  await expect(page.getByText("保存しました").first()).toBeVisible({ timeout: 60_000 });
  await page.goto(`${url}?tab=powerSale`, { timeout: 120_000 });
  await expect(startDateInput(page)).toBeVisible({ timeout: 90_000 });
}

test.describe("顧客詳細 売電状況タブ", () => {
  test.describe.configure({ timeout: 180_000 });

  test("シナリオ1: タブが 設置申請 → 売電状況 → コール の順で表示される", async ({ page }) => {
    await signInAsDemo(page);
    await openFirstCustomer(page);

    await expect(powerSaleTab(page)).toBeVisible({ timeout: 90_000 });

    // タブの並び順（DOM 順）を確認する。
    const names = await page.getByRole("tab").allInnerTexts();
    const trimmed = names.map((v) => v.trim());
    const subsidy = trimmed.indexOf("設置申請");
    const powerSale = trimmed.indexOf("売電状況");
    const calls = trimmed.indexOf("コール");

    expect(subsidy, "設置申請タブがある").toBeGreaterThanOrEqual(0);
    expect(powerSale, "売電状況タブがある").toBeGreaterThanOrEqual(0);
    expect(calls, "コールタブがある").toBeGreaterThanOrEqual(0);
    expect(powerSale, "売電状況は設置申請の直後").toBe(subsidy + 1);
    expect(calls, "コールは売電状況の直後").toBe(powerSale + 1);
  });

  test("シナリオ2: タブを開けて、URL からも直接開ける", async ({ page }) => {
    await signInAsDemo(page);
    const url = await openFirstCustomer(page);

    // タブクリックで開く。
    await openPowerSaleTab(page);
    await expect(noteInput(page)).toBeVisible();
    await expect(page.getByRole("heading", { name: "売電状況" })).toBeVisible();

    // ?tab=powerSale で直接開ける（他タブと同じ既存仕様）。
    await page.goto(`${url}?tab=powerSale`, { timeout: 120_000 });
    await expect(powerSaleTab(page)).toHaveAttribute("data-state", "active", { timeout: 90_000 });
    await expect(startDateInput(page)).toBeVisible();
  });

  test("シナリオ3: 売電開始日を保存でき、再読み込み後も同じ日付", async ({ page }) => {
    await signInAsDemo(page);
    const url = await openFirstCustomer(page);
    await openPowerSaleTab(page);

    await startDateInput(page).fill("2026-07-27");
    await saveAndReload(page, url);

    // タイムゾーン変換で前日・翌日にずれない。
    await expect(startDateInput(page)).toHaveValue("2026-07-27");
  });

  test("シナリオ4: 備考を複数行（★申請ID 含む）で保存でき、改行が保持される", async ({ page }) => {
    await signInAsDemo(page);
    const url = await openFirstCustomer(page);
    await openPowerSaleTab(page);

    await noteInput(page).fill(MULTILINE_NOTE);
    await saveAndReload(page, url);

    await expect(noteInput(page)).toHaveValue(MULTILINE_NOTE);
    // 改行が潰れていない（3 行のまま）。
    const value = await noteInput(page).inputValue();
    expect(value.split("\n")).toHaveLength(3);
    expect(value).toContain("★申請ID：09174680");
  });

  test("シナリオ5: 他タブへ移動して戻っても保持される", async ({ page }) => {
    await signInAsDemo(page);
    const url = await openFirstCustomer(page);
    await openPowerSaleTab(page);

    await startDateInput(page).fill("2026-08-15");
    await noteInput(page).fill(MULTILINE_NOTE);
    await saveAndReload(page, url);

    // コールタブ → 設置申請タブ → 売電状況タブ と往復する。
    await page.getByRole("tab", { name: "コール" }).click();
    await expect(page.getByRole("tab", { name: "コール" })).toHaveAttribute("data-state", "active");
    await page.getByRole("tab", { name: "設置申請" }).click();
    await openPowerSaleTab(page);

    await expect(startDateInput(page)).toHaveValue("2026-08-15");
    await expect(noteInput(page)).toHaveValue(MULTILINE_NOTE);
  });

  test("シナリオ6: 売電開始日・備考を空へ戻せる", async ({ page }) => {
    await signInAsDemo(page);
    const url = await openFirstCustomer(page);
    await openPowerSaleTab(page);

    // まず値を入れて保存。
    await startDateInput(page).fill("2026-09-01");
    await noteInput(page).fill("いったん入力");
    await saveAndReload(page, url);
    await expect(startDateInput(page)).toHaveValue("2026-09-01");

    // 空にして保存 → 未設定へ戻る。
    await clearStartDate(page);
    await noteInput(page).fill("");
    await saveAndReload(page, url);

    await expect(startDateInput(page)).toHaveValue("");
    await expect(noteInput(page)).toHaveValue("");
  });

  test("シナリオ7: 申請 ID の独立入力欄を持たない（備考のみ）", async ({ page }) => {
    await signInAsDemo(page);
    await openFirstCustomer(page);
    await openPowerSaleTab(page);

    // 売電状況タブ内の入力欄は 売電開始日 + 備考 の 2 つだけ。
    const panel = page.getByRole("tabpanel");
    await expect(panel.locator("input, textarea")).toHaveCount(2);
    await expect(panel.getByText("申請ID", { exact: true })).toHaveCount(0);
    await expect(panel.getByText("申請 ID", { exact: true })).toHaveCount(0);
  });

  test("シナリオ8: 既存タブ（設置申請 / コール / 基本情報）が壊れていない", async ({ page }) => {
    await signInAsDemo(page);
    await openFirstCustomer(page);

    // 既定は基本情報タブ。
    await expect(page.getByRole("tab", { name: "基本情報" })).toHaveAttribute(
      "data-state",
      "active",
    );

    await page.getByRole("tab", { name: "設置申請" }).click();
    await expect(page.getByRole("tab", { name: "設置申請" })).toHaveAttribute(
      "data-state",
      "active",
    );

    await page.getByRole("tab", { name: "コール" }).click();
    await expect(page.getByRole("tab", { name: "コール" })).toHaveAttribute("data-state", "active");
    await expect(page.getByRole("tabpanel").getByText("電話番号").first()).toBeVisible();
  });

  test("シナリオ9: 担当者変更 UI が壊れていない", async ({ page }) => {
    await signInAsDemo(page);
    await openFirstCustomer(page);

    await expect(page.getByRole("heading", { name: "担当者", exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await page.getByRole("button", { name: "変更", exact: true }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("担当者を変更")).toBeVisible({ timeout: 30_000 });

    // 所属区分 → 担当者 の 2 段構成が維持されている。
    await expect(page.locator("#edit-tossup-kind")).toBeVisible();
    await expect(page.locator("#edit-tossup-select")).toBeVisible();
    await expect(page.locator("#edit-closing-kind")).toBeVisible();
    await expect(page.locator("#edit-closing-select")).toBeVisible();

    await dialog.getByRole("button", { name: "キャンセル" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
