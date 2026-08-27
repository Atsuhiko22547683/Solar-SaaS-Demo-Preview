import { expect, test, type Page } from "@playwright/test";

// 顧客管理配下の各一覧 → 顧客詳細の該当タブへの遷移統一と、
// アポイント / 施工 / 申請の行展開（長文表示・日付編集）の検証。
//
// 一覧は「横断して案件を探す場所」で、詳細確認はその顧客の顧客詳細タブへ寄せる。
// 一覧専用の詳細ページ（/contracts/[id] など）は他導線が使うため残してある。
//
// 認証は demo@solar-saas.demo / Demo1234!（WHOLESALER_ADMIN, 2FA off, seed 投入済）。
// workers:1 + fullyParallel:false（tests/e2e/playwright.config.ts）に追従。

const DEMO_EMAIL = "demo@solar-saas.demo";
const DEMO_PASSWORD = "Demo1234!";

/** 一覧 → 顧客詳細タブの対応（tab key は customers/[id]/page.tsx の TAB_VALUES）。 */
// clickBy: "row" = 行そのものが遷移（展開 UI を持たない一覧）
//          "link" = 顧客名リンクが遷移（行クリックは展開）
const NAV = [
  { path: "/customers", heading: "顧客一覧", tab: null, tabName: "基本情報", clickBy: "row" },
  {
    path: "/customers/maekaku",
    heading: "コール一覧",
    tab: "calls",
    tabName: "コール",
    clickBy: "link",
  },
  {
    path: "/appointments",
    heading: "アポイント一覧",
    tab: "history",
    tabName: "商談履歴",
    clickBy: "link",
  },
  { path: "/contracts", heading: "契約一覧", tab: "contract", tabName: "契約", clickBy: "row" },
  {
    path: "/loan-reviews",
    heading: "ローン審査一覧",
    tab: "loan",
    tabName: "ローン審査",
    clickBy: "row",
  },
  {
    path: "/constructions",
    heading: "施工一覧",
    tab: "construction",
    tabName: "施工",
    clickBy: "link",
  },
  {
    path: "/applications",
    heading: "申請一覧",
    tab: "subsidy",
    tabName: "設置申請",
    clickBy: "link",
  },
] as const;

/**
 * 顧客詳細の「タブ一覧」に限定した tab ロケータ。
 * 契約 / 施工 / 設置申請の各タブ内にはサブタブ（契約 #1 など）があり、
 * ページ全体から探すと strict mode で衝突するため最初の tablist に絞る。
 */
function mainTab(page: Page, name: string) {
  return page.getByRole("tablist").first().getByRole("tab", { name, exact: true });
}

async function signInAsDemo(page: Page): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(DEMO_EMAIL);
  await page.getByLabel("パスワード").fill(DEMO_PASSWORD);
  const submit = page.getByRole("button", { name: "サインイン" });
  await expect(submit).toBeVisible();
  await submit.click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 120_000 });
}

/** 一覧を開き、ハイドレーションまで待つ（展開・保存はハイドレーション後でないと動かない）。 */
async function open(page: Page, path: string, heading: string): Promise<void> {
  await page.goto(path, { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 90_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
}

/** 1 行目を展開して、その詳細行（バナー）を返す。 */
async function expandFirstRow(page: Page) {
  const table = page.getByRole("table");
  await table
    .locator("tbody tr")
    .first()
    .getByRole("button", { name: /詳細を開く$/ })
    .click();
  return table.locator("tbody tr").nth(1);
}

test.describe("一覧 → 顧客詳細タブの遷移統一", () => {
  test.describe.configure({ timeout: 300_000 });

  test("シナリオ1: 各一覧の顧客名クリックで顧客詳細の該当タブが開く", async ({ page }) => {
    await signInAsDemo(page);

    for (const list of NAV) {
      await open(page, list.path, list.heading);

      // 展開 UI を持つ一覧は顧客名リンク、持たない一覧は行そのものが遷移する。
      // 行の aria-label は「顧客名様 + 補足」なので 様 は末尾とは限らない。
      if (list.clickBy === "row") {
        await page.getByRole("button", { name: /様/ }).first().click();
      } else {
        await page.getByRole("link", { name: /様$/ }).first().click();
      }

      await page.waitForURL(/\/customers\/[^/]+/, { timeout: 90_000 });
      if (list.tab) {
        await expect(page, `${list.heading}: ?tab=${list.tab}`).toHaveURL(
          new RegExp(`tab=${list.tab}`),
        );
      }
      await expect(
        mainTab(page, list.tabName),
        `${list.heading} → ${list.tabName} タブ`,
      ).toHaveAttribute("data-state", "active", { timeout: 90_000 });
    }
  });

  test("シナリオ2: 展開バナーの「案件詳細」からも該当タブへ遷移する", async ({ page }) => {
    await signInAsDemo(page);

    for (const list of NAV.filter((l) =>
      ["/customers/maekaku", "/appointments", "/constructions", "/applications"].includes(l.path),
    )) {
      await open(page, list.path, list.heading);
      await expandFirstRow(page);

      const detail = page.getByRole("link", { name: "案件詳細" });
      await expect(detail, `${list.heading}: 案件詳細ボタン`).toBeVisible();
      await detail.click();

      await page.waitForURL(new RegExp(`tab=${list.tab}`), { timeout: 90_000 });
      await expect(mainTab(page, list.tabName)).toHaveAttribute("data-state", "active", {
        timeout: 90_000,
      });
    }
  });

  test("シナリオ3: コール一覧の「案件詳細」は主要操作のボタンになっている", async ({ page }) => {
    await signInAsDemo(page);
    await open(page, "/customers/maekaku", "コール一覧");
    await expandFirstRow(page);

    const detail = page.getByRole("link", { name: "案件詳細" });
    await expect(detail).toBeVisible();

    // primary ボタン（塗り）で、単なるテキストリンクより明確に大きい。
    const box = await detail.boundingBox();
    expect(box!.height, "十分な高さがある").toBeGreaterThanOrEqual(32);
    const bg = await detail.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg, "背景色のある塗りボタン").not.toBe("rgba(0, 0, 0, 0)");
  });
});

test.describe("アポイント一覧 — 長文の展開と操作列の整理", () => {
  test.describe.configure({ timeout: 240_000 });

  test("シナリオ4: 通常行に「次に必要な対応」列と「操作」列が無い", async ({ page }) => {
    await signInAsDemo(page);
    await open(page, "/appointments", "アポイント一覧");

    const table = page.getByRole("table");
    for (const col of ["次に必要な対応", "操作"]) {
      await expect(
        table.getByRole("columnheader", { name: col, exact: true }),
        `列「${col}」は通常行に無い`,
      ).toHaveCount(0);
    }
    // 短い一覧向けの列は維持されている。
    for (const col of ["予定日時", "顧客名", "エリア", "担当者", "種別・場所", "状態"]) {
      await expect(
        table.getByRole("columnheader", { name: col, exact: true }),
        `列「${col}」は残っている`,
      ).toBeVisible();
    }
  });

  test("シナリオ5: 展開すると「次に必要な対応」の全文とマエカク入力が出る", async ({ page }) => {
    await signInAsDemo(page);
    await open(page, "/appointments", "アポイント一覧");

    const banner = await expandFirstRow(page);
    await expect(banner.getByRole("heading", { name: "次に必要な対応" })).toBeVisible();
    // 旧「操作」列の実体は、何をするか分かる名前で残っている。
    await expect(banner.getByRole("link", { name: "マエカクを入力" })).toBeVisible();
    await expect(banner.getByRole("link", { name: "案件詳細" })).toBeVisible();

    // 長文は truncate せず折り返して全文が読める。
    const text = banner.locator("p").first();
    const truncated = await text.evaluate((el) => {
      const cs = getComputedStyle(el);
      return cs.textOverflow === "ellipsis" || cs.whiteSpace === "nowrap";
    });
    expect(truncated, "全文表示（truncate しない）").toBe(false);

    // 旧「操作」列の機能（マエカク入力画面）はそのまま生きている。
    await banner.getByRole("link", { name: "マエカクを入力" }).click();
    await page.waitForURL(/\/appointments\/[^/]+\/pre-call/, { timeout: 90_000 });
  });

  test("シナリオ6: 1366px で横スクロールが発生しない", async ({ page }) => {
    await signInAsDemo(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await open(page, "/appointments", "アポイント一覧");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "横スクロールなし").toBeLessThanOrEqual(0);
  });
});

test.describe("施工一覧 — 日付の read-only 表示と展開編集", () => {
  test.describe.configure({ timeout: 300_000 });

  test("シナリオ7: 検索範囲が左・日付対象が右で、既定は「すべて」", async ({ page }) => {
    await signInAsDemo(page);
    await open(page, "/constructions", "施工一覧");
    await page.getByRole("button", { name: /^検索条件/ }).click();

    const dateField = page.getByLabel("日付対象");
    await expect(dateField).toHaveValue("all");
    await expect(dateField.locator("option")).toHaveText([
      "すべて",
      "施工予定日",
      "着工日",
      "完工日",
    ]);

    const rangeBox = await page.getByLabel("検索範囲 開始日").boundingBox();
    const fieldBox = await dateField.boundingBox();
    expect(fieldBox!.x, "日付対象は検索範囲の右").toBeGreaterThan(rangeBox!.x);

    // 日付対象=すべてのまま期間だけ指定しても横断検索が効く。
    await page.getByLabel("検索範囲 開始日").fill("2000-01-01");
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await page.waitForURL(/from=2000-01-01/, { timeout: 90_000 });
    await expect(page, "既定値なので dateField は URL に載らない").not.toHaveURL(/dateField=/);
    await expect(page.getByText("表示件数:")).toBeVisible();
  });

  test("シナリオ8: 通常行の着工日・完工日は read-only（input が無い）", async ({ page }) => {
    await signInAsDemo(page);
    await open(page, "/constructions", "施工一覧");

    const table = page.getByRole("table");
    for (const col of ["着工日", "完工日"]) {
      await expect(table.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
    }
    // 通常行に date input を置かない（列幅を使いすぎないため）。
    await expect(table.locator("tbody tr").first().locator("input")).toHaveCount(0);
  });

  test("シナリオ9: 展開すると着工日・完工日を編集でき、再読込後も残る", async ({ page }) => {
    await signInAsDemo(page);
    await open(page, "/constructions", "施工一覧");

    const banner = await expandFirstRow(page);
    const started = banner.locator('input[type="date"]').first();
    const completed = banner.locator('input[type="date"]').nth(1);
    await expect(started).toBeVisible();
    await expect(completed).toBeVisible();

    await started.fill("2026-09-01");
    await completed.fill("2026-09-20");

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === "POST" && r.url().includes("/constructions"),
        { timeout: 60_000 },
      ),
      banner.getByRole("button", { name: "保存" }).click(),
    ]);
    expect(response.status()).toBe(200);

    // 並び替えキー（施工予定日）は変えていないので行順は変わらない。
    await open(page, "/constructions", "施工一覧");
    const row = page.getByRole("table").locator("tbody tr").first();
    await expect(row.locator("td").nth(6), "着工日が read-only で反映").toContainText("2026/09/01");
    await expect(row.locator("td").nth(7), "完工日が read-only で反映").toContainText("2026/09/20");

    const reopened = await expandFirstRow(page);
    await expect(reopened.locator('input[type="date"]').first()).toHaveValue("2026-09-01");
    await expect(reopened.locator('input[type="date"]').nth(1)).toHaveValue("2026-09-20");
  });

  test("シナリオ10: 1366px で横スクロールが発生しない", async ({ page }) => {
    await signInAsDemo(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await open(page, "/constructions", "施工一覧");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("申請一覧 — 日付の read-only 表示と展開編集", () => {
  test.describe.configure({ timeout: 300_000 });

  test("シナリオ11: 通常行の日付は read-only（input が無い）", async ({ page }) => {
    await signInAsDemo(page);
    await open(page, "/applications", "申請一覧");

    const table = page.getByRole("table");
    await expect(table.locator("tbody tr").first().locator("input")).toHaveCount(0);
    // 列構成は従来どおり。
    for (const col of ["申請予定日", "提出日", "承認日"]) {
      await expect(table.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
    }
  });

  test("シナリオ12: 展開すると申請日程を編集でき、再読込後も残る", async ({ page }) => {
    await signInAsDemo(page);
    await open(page, "/applications", "申請一覧");

    const banner = await expandFirstRow(page);
    const inputs = banner.locator('input[type="date"]');
    await expect(inputs, "申請予定日 / 提出日 / 承認日").toHaveCount(3);

    await inputs.nth(1).fill("2026-09-05");
    await inputs.nth(2).fill("2026-09-12");

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === "POST" && r.url().includes("/applications"),
        { timeout: 60_000 },
      ),
      banner.getByRole("button", { name: "保存" }).click(),
    ]);
    expect(response.status()).toBe(200);

    await open(page, "/applications", "申請一覧");
    const row = page.getByRole("table").locator("tbody tr").first();
    await expect(row.locator("td").nth(5), "提出日が反映").toContainText("2026/09/05");
    await expect(row.locator("td").nth(6), "承認日が反映").toContainText("2026/09/12");

    const reopened = await expandFirstRow(page);
    await expect(reopened.locator('input[type="date"]').nth(1)).toHaveValue("2026-09-05");
    await expect(reopened.locator('input[type="date"]').nth(2)).toHaveValue("2026-09-12");
  });

  test("シナリオ13: 1366px で横スクロールが発生しない", async ({ page }) => {
    await signInAsDemo(page);
    await page.setViewportSize({ width: 1366, height: 900 });
    await open(page, "/applications", "申請一覧");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
