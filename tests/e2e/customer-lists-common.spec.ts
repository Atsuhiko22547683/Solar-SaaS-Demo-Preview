import { expect, test, type Page } from "@playwright/test";

// 顧客管理配下の各一覧に共通で入れた UI（デプロイ前の最終調整）の検証。
//
//   - 検索条件は折りたたみ（初期は閉じる / URL に条件があれば開く）
//   - 日付は「検索範囲」1 見出し + aria-label で開始/終了を区別
//   - 並び替えは検索パネルの外・表示件数の右で、select 変更で即反映
//   - 並び替えを変えても検索条件は消えない
// あわせて、横断一覧としての「商談一覧」を廃止したこと、契約一覧の列変更、
// ローン審査一覧の不備 2 値化、施工一覧の着工日も確認する。
//
// 認証は demo@solar-saas.demo / Demo1234!（WHOLESALER_ADMIN, 2FA off, seed 投入済）。
// workers:1 + fullyParallel:false（tests/e2e/playwright.config.ts）に追従。

const DEMO_EMAIL = "demo@solar-saas.demo";
const DEMO_PASSWORD = "Demo1234!";

/** 共通 UI を適用した一覧（顧客一覧・コール一覧は専用 spec で個別に検証済み）。 */
const LISTS = [
  { path: "/customers", heading: "顧客一覧", hasDateRange: false },
  { path: "/customers/maekaku", heading: "コール一覧", hasDateRange: true },
  { path: "/appointments", heading: "アポイント一覧", hasDateRange: true },
  { path: "/contracts", heading: "契約一覧", hasDateRange: true },
  { path: "/loan-reviews", heading: "ローン審査一覧", hasDateRange: false },
  { path: "/constructions", heading: "施工一覧", hasDateRange: true },
  { path: "/applications", heading: "申請一覧", hasDateRange: true },
] as const;

async function signInAsDemo(page: Page): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(DEMO_EMAIL);
  await page.getByLabel("パスワード").fill(DEMO_PASSWORD);
  const submit = page.getByRole("button", { name: "サインイン" });
  await expect(submit).toBeVisible();
  await submit.click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 120_000 });
}

function filterToggle(page: Page) {
  return page.getByRole("button", { name: /^検索条件/ });
}

async function open(page: Page, path: string, heading: string): Promise<void> {
  await page.goto(path, { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 90_000 });
}

/**
 * 行内のインライン編集（select / date input）を触る前に呼ぶ。
 * ハイドレーション前に値を入れると React の onChange が付いておらず保存が走らないため、
 * 通信が落ち着くまで待ってから操作する。
 */
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
}

test.describe("顧客管理配下の一覧 — 共通 UI", () => {
  test.describe.configure({ timeout: 240_000 });

  test("シナリオ1: 全一覧で検索条件が折りたためる", async ({ page }) => {
    await signInAsDemo(page);

    for (const list of LISTS) {
      await open(page, list.path, list.heading);
      const toggle = filterToggle(page);

      await expect(toggle, `${list.heading}: 検索条件ヘッダがある`).toBeVisible();
      await expect(toggle, `${list.heading}: 初期は閉じている`).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      // 閉じている間は検索ボタンも出ない = 画面が一覧に使える。
      await expect(page.getByRole("button", { name: "検索", exact: true })).toHaveCount(0);

      await toggle.click();
      await expect(toggle, `${list.heading}: クリックで開く`).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      await expect(page.getByRole("button", { name: "検索", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "クリア" })).toBeVisible();

      await toggle.click();
      await expect(toggle, `${list.heading}: 再クリックで閉じる`).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    }
  });

  test("シナリオ2: 日付検索は「検索範囲」に統一され、単独の開始日/終了日が無い", async ({
    page,
  }) => {
    await signInAsDemo(page);

    for (const list of LISTS.filter((l) => l.hasDateRange)) {
      await open(page, list.path, list.heading);
      await filterToggle(page).click();

      await expect(
        page.getByText("検索範囲", { exact: true }),
        `${list.heading}: 検索範囲の見出し`,
      ).toBeVisible();
      await expect(page.getByLabel("検索範囲 開始日")).toBeVisible();
      await expect(page.getByLabel("検索範囲 終了日")).toBeVisible();
      // 何の日付か分からない単独ラベルは残っていない。
      await expect(page.getByText("開始日", { exact: true })).toHaveCount(0);
      await expect(page.getByText("終了日", { exact: true })).toHaveCount(0);
    }
  });

  test("シナリオ3: 並び替えは表示件数の右にあり、検索パネルの中には無い", async ({ page }) => {
    await signInAsDemo(page);

    for (const list of LISTS) {
      await open(page, list.path, list.heading);

      // 検索パネルは閉じたまま並び替えが操作できる = パネルの外にある。
      await expect(filterToggle(page)).toHaveAttribute("aria-expanded", "false");
      const sortField = page.getByLabel("並び替え");
      const sortDir = page.getByLabel("並び順");
      await expect(sortField, `${list.heading}: 並び替え項目`).toBeVisible();
      await expect(sortDir, `${list.heading}: 並び順`).toBeVisible();

      // 表示件数の右・同じ行に並ぶ。
      const countBox = await page.getByText(/^表示件数: \d+件$/).boundingBox();
      const sortBox = await sortField.boundingBox();
      expect(countBox && sortBox, `${list.heading}: 両方が描画されている`).toBeTruthy();
      expect(sortBox!.x, `${list.heading}: 並び替えは表示件数より右`).toBeGreaterThan(countBox!.x);
      expect(Math.abs(sortBox!.y - countBox!.y), `${list.heading}: 同じ行に並ぶ`).toBeLessThan(
        sortBox!.height,
      );
    }
  });

  test("シナリオ4: 並び替えは検索ボタンを押さずに即反映される", async ({ page }) => {
    await signInAsDemo(page);

    for (const list of LISTS) {
      await open(page, list.path, list.heading);
      const sortDir = page.getByLabel("並び順");
      const before = await sortDir.inputValue();
      const next = before === "asc" ? "desc" : "asc";

      await sortDir.selectOption(next);
      await page.waitForURL(new RegExp(`sortDir=${next}`), { timeout: 90_000 });
      await expect(sortDir, `${list.heading}: 選択が反映される`).toHaveValue(next);
    }
  });

  test("シナリオ5: 並び替えを変えても検索条件が消えない", async ({ page }) => {
    await signInAsDemo(page);

    // 顧客名検索を掛けた状態で並び替えを変える（顧客一覧を代表に使う）。
    await open(page, "/customers?query=山本", "顧客一覧");
    await expect(filterToggle(page), "条件付き URL では開いた状態").toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await page.getByLabel("並び替え").selectOption("name");
    await page.waitForURL(/sortField=name/, { timeout: 90_000 });
    await expect(page, "検索条件が URL に残る").toHaveURL(/query=/);
    await expect(page.getByLabel("顧客名で検索")).toHaveValue("山本");
  });

  test("シナリオ6: 商談一覧が廃止されている（サイドバー・ページとも）", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/customers", { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "顧客一覧" })).toBeVisible({ timeout: 90_000 });

    // サイドバーの顧客管理配下に「商談一覧」が無い。
    await expect(page.getByRole("link", { name: "商談一覧" })).toHaveCount(0);
    // 他の一覧は残っている。
    for (const name of ["顧客一覧", "コール一覧", "アポイント一覧", "契約一覧"]) {
      await expect(page.getByRole("link", { name }).first()).toBeVisible();
    }

    // 一覧ページ自体も無い（404）。
    const res = await page.goto("/deals", { timeout: 120_000 });
    expect(res?.status(), "/deals は 404").toBe(404);
  });

  test("シナリオ7: 顧客詳細の「商談履歴」タブは残っている", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/customers", { timeout: 120_000 });
    await page.getByRole("button", { name: /様$/ }).first().click();
    await page.waitForURL(/\/customers\/[^/]+$/, { timeout: 90_000 });

    const tab = page.getByRole("tab", { name: "商談履歴" });
    await expect(tab).toBeVisible({ timeout: 90_000 });
    await tab.click();
    await expect(tab).toHaveAttribute("data-state", "active");
  });

  test("シナリオ8: 契約一覧に施工・設置申請の列が無く、入金状況がある", async ({ page }) => {
    await signInAsDemo(page);
    await open(page, "/contracts", "契約一覧");

    const table = page.getByRole("table");
    await expect(table).toBeVisible({ timeout: 90_000 });
    await expect(table.getByRole("columnheader", { name: "入金状況", exact: true })).toBeVisible();
    for (const col of ["施工（後続工程）", "設置申請（後続工程）"]) {
      await expect(
        table.getByRole("columnheader", { name: col, exact: true }),
        `列「${col}」は無い`,
      ).toHaveCount(0);
    }
  });

  test("シナリオ9: 契約一覧から入金状況を変更・保存でき、再読込後も残る", async ({ page }) => {
    await signInAsDemo(page);
    await open(page, "/contracts", "契約一覧");

    await waitForHydration(page);
    const select = page.getByRole("table").locator("tbody tr").first().locator("select");
    await expect(select).toBeVisible({ timeout: 90_000 });
    const before = await select.inputValue();
    const next = before === "PAID" ? "UNPAID" : "PAID";

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === "POST" && r.url().includes("/contracts"),
        { timeout: 60_000 },
      ),
      select.selectOption(next),
    ]);
    expect(response.status()).toBe(200);

    await page.reload({ timeout: 120_000 });
    await expect(page.getByRole("table")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole("table").locator("tbody tr").first().locator("select")).toHaveValue(
      next,
    );
  });

  test("シナリオ10: ローン審査一覧の不備は「あり / なし」で、最終更新列が無い", async ({
    page,
  }) => {
    await signInAsDemo(page);
    await open(page, "/loan-reviews", "ローン審査一覧");

    const table = page.getByRole("table");
    await expect(table).toBeVisible({ timeout: 90_000 });
    await expect(table.getByRole("columnheader", { name: "不備", exact: true })).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "最終更新", exact: true }),
      "最終更新列は削除済み",
    ).toHaveCount(0);

    // 不備列（5 セル目）は「あり」か「なし」の 2 値だけ。
    for (const row of await table.locator("tbody tr").all()) {
      await expect(row.locator("td").nth(4)).toHaveText(/^(あり|なし)$/);
    }
  });

  test("シナリオ11: 施工一覧に着工日・完工日の列があり、通常行は read-only", async ({ page }) => {
    await signInAsDemo(page);
    await open(page, "/constructions", "施工一覧");

    const table = page.getByRole("table");
    for (const col of ["着工日", "完工日"]) {
      await expect(
        table.getByRole("columnheader", { name: col, exact: true }),
        `列「${col}」がある`,
      ).toBeVisible({ timeout: 90_000 });
    }

    // 編集 UI は展開バナー側へ移した（通常行に date input を置かない）。
    // 展開しての保存・再読込は customer-lists-navigation.spec.ts で検証する。
    await waitForHydration(page);
    await expect(table.locator("tbody tr").first().locator("input")).toHaveCount(0);
  });

  test("シナリオ12: 施工一覧は着工日でも期間検索できる", async ({ page }) => {
    await signInAsDemo(page);
    await open(page, "/constructions", "施工一覧");
    await filterToggle(page).click();

    await page.getByLabel("日付対象").selectOption("started");
    await page.getByLabel("検索範囲 開始日").fill("2000-01-01");
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await page.waitForURL(/dateField=started/, { timeout: 90_000 });
    await expect(page.getByText("表示件数:")).toBeVisible();
  });

  test("シナリオ13: 申請一覧の列構成は変わっていない", async ({ page }) => {
    await signInAsDemo(page);
    await open(page, "/applications", "申請一覧");

    const table = page.getByRole("table");
    for (const col of [
      "申請予定日",
      "顧客名",
      "担当者",
      "申請種別・提出先",
      "申請状態",
      "提出日",
      "承認日",
      "関連書類",
    ]) {
      await expect(
        table.getByRole("columnheader", { name: col, exact: true }),
        `列「${col}」が残っている`,
      ).toBeVisible();
    }
  });

  test("シナリオ14: ページングが壊れていない", async ({ page }) => {
    await signInAsDemo(page);
    await open(page, "/customers", "顧客一覧");

    const sizeSelect = page.getByRole("combobox").filter({ hasText: "件" }).first();
    await sizeSelect.selectOption("10");
    await page.waitForURL(/pageSize=10/, { timeout: 90_000 });
    await expect(page.getByRole("table")).toBeVisible();
  });
});
