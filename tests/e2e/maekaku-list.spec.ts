import { expect, test, type Page } from "@playwright/test";

// コール一覧（/customers/maekaku）の検証。
//
// 通常行は 8 列（顧客名 / 担当者 / 4 種のコールステータス / 次回対応 / 展開）だけで、
// 横スクロールなしに 4 種のステータスを一目で比較できることを最優先にしている。
// 電話番号・各コールの希望日時とメモ・次回アポイント詳細・直近コール履歴は、
// 行を展開したときだけ行直下のバナーに出る（モーダルではない）。
// 遷移は顧客名リンクとバナー右下の「詳細を見る」から顧客詳細のコールタブ（?tab=calls）へ。
// 表示名は「コール一覧」だが URL は互換性のため /customers/maekaku のまま。
//
// 認証は demo@solar-saas.demo / Demo1234!（WHOLESALER_ADMIN, 2FA off, seed 投入済）。
// Seed は tests/e2e/global-setup.ts で全 spec 起動前に 1 回だけ実行される。
// workers:1 + fullyParallel:false（tests/e2e/playwright.config.ts）に追従。

const DEMO_EMAIL = "demo@solar-saas.demo";
const DEMO_PASSWORD = "Demo1234!";

const LIST_PATH = "/customers/maekaku";

async function signInAsDemo(page: Page): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(DEMO_EMAIL);
  await page.getByLabel("パスワード").fill(DEMO_PASSWORD);
  const submit = page.getByRole("button", { name: "サインイン" });
  await expect(submit).toBeVisible();
  await submit.click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 120_000 });
}

async function openCallList(page: Page): Promise<void> {
  await page.goto(LIST_PATH, { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "コール一覧" })).toBeVisible({
    timeout: 90_000,
  });
}

/** 顧客名リンク（1 行 1 個）。行数のカウントと詳細遷移の起点を兼ねる。 */
function customerLinks(page: Page) {
  return page.getByRole("link", { name: /様$/ });
}

async function rowCount(page: Page): Promise<number> {
  return customerLinks(page).count();
}

/** 折りたたみ式の検索パネルのヘッダ。 */
function filterToggle(page: Page) {
  return page.getByRole("button", { name: /^検索条件/ });
}

/** 検索パネルを開く（既に開いていれば何もしない）。初期状態は閉じている。 */
async function openFilters(page: Page): Promise<void> {
  const toggle = filterToggle(page);
  await expect(toggle).toBeVisible({ timeout: 90_000 });
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(page.getByLabel("顧客名で検索")).toBeVisible();
}

/**
 * 【対象項目】×【ステータス】で絞り込む。
 * 対象項目を変えるとステータスの選択肢が入れ替わるので、必ずこの順で操作する。
 */
async function filterByCall(page: Page, callType: string, status: string): Promise<void> {
  await openFilters(page);
  await page.getByLabel("対象項目").selectOption(callType);
  await page.getByLabel("ステータス", { exact: true }).selectOption(status);
  await page.getByRole("button", { name: "検索", exact: true }).click();
  await page.waitForURL(new RegExp(`callStatus=${status}`), { timeout: 90_000 });
}

test.describe("コール一覧", () => {
  test.describe.configure({ timeout: 120_000 });

  test("シナリオ1: サイドメニュー「コール一覧」から一覧画面を開ける", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/customers", { timeout: 120_000 });

    // 顧客管理グループを開いてから「コール一覧」へ。
    const menu = page.getByRole("link", { name: "コール一覧" });
    if ((await menu.count()) === 0) {
      await page.getByRole("button", { name: "顧客管理" }).first().click();
    }
    await page.getByRole("link", { name: "コール一覧" }).first().click();

    await page.waitForURL(/\/customers\/maekaku/, { timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "コール一覧" })).toBeVisible();
    await expect(
      page.getByText("顧客ごとの各種コール対応状況を一覧で確認・管理できます。"),
    ).toBeVisible();
  });

  test("シナリオ1b: 検索パネルは初期状態で閉じ、ヘッダのクリックで開閉する", async ({ page }) => {
    await signInAsDemo(page);
    await openCallList(page);

    const toggle = filterToggle(page);
    await expect(toggle).toBeVisible({ timeout: 90_000 });

    // 初期状態は閉じている = フォームが 1 つも出ていない。
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    for (const field of ["顧客名で検索", "対象項目", "日付対象", "検索範囲 開始日"]) {
      await expect(page.getByLabel(field), `${field} は閉じている間は出ない`).toHaveCount(0);
    }
    await expect(page.getByRole("button", { name: "検索", exact: true })).toHaveCount(0);
    // 閉じていても一覧はすぐ見える。
    await expect(page.getByRole("table")).toBeVisible();

    // 開く。
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    for (const field of ["顧客名で検索", "担当者", "対象項目", "ステータス", "日付対象"]) {
      await expect(page.getByLabel(field, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("button", { name: "検索", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "クリア" })).toBeVisible();

    // もう一度クリックで閉じる。
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByLabel("顧客名で検索")).toHaveCount(0);
  });

  test("シナリオ1c: 検索条件付き URL では検索パネルが開いた状態で表示される", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto(`${LIST_PATH}?query=山本&callType=thank_you&callStatus=done`, {
      timeout: 120_000,
    });
    await expect(page.getByRole("heading", { name: "コール一覧" })).toBeVisible({
      timeout: 90_000,
    });

    await expect(filterToggle(page)).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByLabel("顧客名で検索")).toHaveValue("山本");
    await expect(page.getByLabel("対象項目")).toHaveValue("thank_you");
    // 有効な条件数がヘッダに出る（顧客名 + 対象項目 + ステータス = 3 件）。
    await expect(filterToggle(page)).toContainText("3件");
  });

  test("シナリオ1d: 日付は「検索範囲」としてまとまり、単独の開始日/終了日ラベルが無い", async ({
    page,
  }) => {
    await signInAsDemo(page);
    await openCallList(page);
    await openFilters(page);

    await expect(page.getByText("検索範囲", { exact: true })).toBeVisible();
    await expect(page.getByLabel("検索範囲 開始日")).toBeVisible();
    await expect(page.getByLabel("検索範囲 終了日")).toBeVisible();

    // 何の日付か分からない単独ラベルは残っていない。
    await expect(page.getByText("開始日", { exact: true })).toHaveCount(0);
    await expect(page.getByText("終了日", { exact: true })).toHaveCount(0);
  });

  test("シナリオ2: 通常状態は 8 列で 4 種のステータスが同時に見える", async ({ page }) => {
    await signInAsDemo(page);
    await openCallList(page);

    const table = page.getByRole("table");
    await expect(table).toBeVisible({ timeout: 90_000 });

    for (const col of [
      "顧客名",
      "担当者",
      "マエカク",
      "サンキュー",
      "ローン完了",
      "施工完了",
      "次回対応",
    ]) {
      await expect(
        table.getByRole("columnheader", { name: col, exact: true }),
        `列「${col}」が表示される`,
      ).toBeVisible();
    }

    // 顧客名 + 担当者 + 4 ステータス + 次回対応 + 展開 = 8 セル。
    const firstRow = table.locator("tbody tr").first();
    await expect(firstRow.locator("td")).toHaveCount(8);

    // 4 種のステータスセルが同時に見えている（未設定は "—"）。
    for (let i = 2; i <= 5; i += 1) {
      await expect(firstRow.locator("td").nth(i)).toBeVisible();
    }
  });

  test("シナリオ3: 通常状態では電話番号・希望日時・メモ・履歴を出さない", async ({ page }) => {
    await signInAsDemo(page);
    await openCallList(page);

    const table = page.getByRole("table");
    await expect(table).toBeVisible({ timeout: 90_000 });

    // 通常行から外した列が復活していないこと。
    for (const col of [
      "固定電話",
      "携帯電話",
      "希望日時",
      "メモ",
      "次回アポイント",
      "次回担当者",
      "次回アクション",
      "最終架電日時",
      "対応者",
    ]) {
      await expect(
        table.getByRole("columnheader", { name: col, exact: true }),
        `列「${col}」は通常状態では出ない`,
      ).toHaveCount(0);
    }

    // 展開バナー側の項目名も、閉じている間はテーブル内に出ない
    // （PII マスキング設定に依存しないよう、値ではなく項目名で確認する。
    //  「最終架電日時」等は絞り込みバーの日付対象セレクトにも存在するのでテーブルに限定する）。
    for (const field of ["固定電話", "携帯電話", "次回アクション", "最終架電日時", "対応者"]) {
      await expect(
        table.getByText(field, { exact: true }),
        `「${field}」は展開前はテーブルに出ない`,
      ).toHaveCount(0);
    }
  });

  test("シナリオ4: PC 幅（1366 / 1920）で横スクロールが発生しない", async ({ page }) => {
    await signInAsDemo(page);

    for (const width of [1366, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await openCallList(page);
      await expect(page.getByRole("table")).toBeVisible({ timeout: 90_000 });

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `幅 ${width}px で横スクロールが出ない`).toBeLessThanOrEqual(0);
    }
  });

  test("シナリオ5: 次回対応に対応項目名と日時が 1 件だけ表示される", async ({ page }) => {
    await signInAsDemo(page);
    await openCallList(page);

    const KINDS = /(マエカク|サンキューコール|ローン審査完了コール|施工完了コール|次回アポイント)/;
    const rows = page.getByRole("table").locator("tbody tr");
    const total = await rowCount(page);
    let withTask = 0;

    for (let i = 0; i < total; i += 1) {
      const cell = rows.nth(i).locator("td").nth(6);
      const text = (await cell.innerText()).trim();
      if (text === "—") continue;
      withTask += 1;
      // 対応項目名 + 日時（YYYY/MM/DD HH:mm）が 1 組だけ。
      expect(text, `${i} 行目の次回対応に項目名がある`).toMatch(KINDS);
      const dates = text.match(/\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}/g) ?? [];
      expect(dates, `${i} 行目の次回対応の日時は 1 件だけ`).toHaveLength(1);
    }
    expect(withTask, "次回対応が算出された行が 1 件以上ある").toBeGreaterThan(0);
  });

  test("シナリオ6: 展開ボタンでバナーが開き、もう一度押すと閉じる", async ({ page }) => {
    await signInAsDemo(page);
    await openCallList(page);

    // 展開すると aria-label が「詳細を閉じる」に変わるため、ラベルではなく
    // 「1 行目のトグルボタン」という位置で掴んでおく（同一要素を追い続けるため）。
    const toggle = page.getByRole("table").locator("tbody tr").first().getByRole("button");
    await expect(toggle).toBeVisible({ timeout: 90_000 });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveAccessibleName(/詳細を開く$/);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toHaveAccessibleName(/詳細を閉じる$/);

    // 上段 — 電話番号は見出し付きブロックではなく、ラベル + 値の横 1 行。
    await expect(page.getByText("固定電話", { exact: true })).toBeVisible();
    await expect(page.getByText("携帯電話", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "連絡先" })).toHaveCount(0);

    // 中段 — 4 種のコールブロックが通常行と同じ順で必ず 4 つ出る。
    const banner = page.getByRole("table").locator("tbody tr").nth(1);
    await expect(
      banner.getByRole("heading"),
      "4 コール + 次回対応 + 直近コール履歴 = 6 ブロック",
    ).toHaveText([
      "マエカク",
      "サンキューコール",
      "ローン審査完了コール",
      "施工完了コール",
      "次回対応",
      "直近コール履歴",
    ]);

    await expect(page.getByRole("link", { name: "詳細を見る" })).toBeVisible();

    // 同じボタンをもう一度押すと閉じる。
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText("固定電話", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "詳細を見る" })).toHaveCount(0);
  });

  test("シナリオ6b: 展開バナーはラベルの上下にラベル→値が積まれる", async ({ page }) => {
    await signInAsDemo(page);
    await openCallList(page);

    await page.getByRole("table").locator("tbody tr").first().getByRole("button").click();
    const banner = page.getByRole("table").locator("tbody tr").nth(1);

    /** 見出し直後の項目リスト（h4 の兄弟 dl）を掴む。祖先 div を拾わないよう XPath で指定。 */
    const blockFields = (title: string) =>
      banner.locator(`xpath=.//h4[normalize-space()="${title}"]/following-sibling::dl`);

    // 各コールブロックは「コール名 → 希望日時 → メモ」の縦読み。
    for (const title of [
      "マエカク",
      "サンキューコール",
      "ローン審査完了コール",
      "施工完了コール",
    ]) {
      await expect(blockFields(title).locator("dt"), title).toHaveText(["希望日時", "メモ"]);
    }

    // 次回対応 / 直近コール履歴も縦読み。
    await expect(blockFields("次回対応").locator("dt")).toHaveText([
      "次回アポイント",
      "次回担当者",
      "次回アクション",
    ]);
    await expect(blockFields("直近コール履歴").locator("dt")).toHaveText([
      "最終架電日時",
      "対応者",
      "メモ",
    ]);

    // ラベル (dt) と値 (dd) が横並びでない = dd が dt より下にある。
    const stacked = await blockFields("次回対応")
      .locator("dt")
      .first()
      .evaluate((dt) => {
        const dd = dt.nextElementSibling as HTMLElement | null;
        if (!dd) return false;
        return dd.getBoundingClientRect().top >= dt.getBoundingClientRect().bottom;
      });
    expect(stacked, "値はラベルの下に積まれる").toBe(true);

    // 次回アクションは広い列（下段 3 列中 2 列ぶん）に置くので、
    // 直近コール履歴ブロックより明確に横幅が広い。
    const widths = await blockFields("次回対応")
      .first()
      .evaluate((el) => el.getBoundingClientRect().width);
    const lastWidth = await blockFields("直近コール履歴")
      .first()
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(widths, "次回対応の方が広い").toBeGreaterThan(lastWidth);
  });

  test("シナリオ7: アコーディオン — 別の行を開くと前の行は閉じる", async ({ page }) => {
    await signInAsDemo(page);
    await openCallList(page);

    const toggles = page.getByRole("button", { name: /詳細を(開く|閉じる)$/ });
    expect(await toggles.count(), "2 行以上ある").toBeGreaterThan(1);

    await toggles.nth(0).click();
    await expect(toggles.nth(0)).toHaveAttribute("aria-expanded", "true");

    await toggles.nth(1).click();
    await expect(toggles.nth(1)).toHaveAttribute("aria-expanded", "true");
    await expect(toggles.nth(0)).toHaveAttribute("aria-expanded", "false");
    // 開いているバナーは常に 1 つ。
    await expect(page.getByRole("link", { name: "詳細を見る" })).toHaveCount(1);
  });

  test("シナリオ8: 行クリックでは遷移せず展開する", async ({ page }) => {
    await signInAsDemo(page);
    await openCallList(page);

    const firstRow = page.getByRole("table").locator("tbody tr").first();
    // 顧客名リンクを避けて担当者セルをクリック。
    await firstRow.locator("td").nth(1).click();

    await expect(page).toHaveURL(new RegExp(`${LIST_PATH}$`));
    await expect(page.getByRole("link", { name: "詳細を見る" })).toBeVisible();
  });

  test("シナリオ9: 顧客名クリックで顧客詳細のコールタブが開く", async ({ page }) => {
    await signInAsDemo(page);
    await openCallList(page);

    const link = customerLinks(page).first();
    await expect(link).toBeVisible({ timeout: 90_000 });
    await link.click();

    await page.waitForURL(/\/customers\/[^/]+\?tab=calls$/, { timeout: 90_000 });
    await expect(page.getByRole("tab", { name: "コール" })).toHaveAttribute("data-state", "active");
    await expect(page.getByRole("tabpanel").getByText("電話番号").first()).toBeVisible();
  });

  test("シナリオ10: 展開バナーの「詳細を見る」からもコールタブへ遷移する", async ({ page }) => {
    await signInAsDemo(page);
    await openCallList(page);

    await page
      .getByRole("button", { name: /詳細を開く$/ })
      .first()
      .click();
    await page.getByRole("link", { name: "詳細を見る" }).click();

    await page.waitForURL(/\/customers\/[^/]+\?tab=calls$/, { timeout: 90_000 });
    await expect(page.getByRole("tab", { name: "コール" })).toHaveAttribute("data-state", "active");
  });

  test("シナリオ11: 顧客名検索で絞り込め、クリアで解除できる", async ({ page }) => {
    await signInAsDemo(page);
    await openCallList(page);

    const allRows = await rowCount(page);
    expect(allRows, "seed の顧客が 1 件以上表示される").toBeGreaterThan(0);

    await openFilters(page);
    await page.getByLabel("顧客名で検索").fill("山本");
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await page.waitForURL(/query=/, { timeout: 90_000 });

    const filtered = customerLinks(page);
    await expect(filtered.first()).toBeVisible({ timeout: 90_000 });
    await expect(filtered.first()).toContainText("山本");
    expect(await filtered.count()).toBeLessThan(allRows);

    await page.getByRole("button", { name: "クリア" }).click();
    await page.waitForURL((url) => !url.search.includes("query="), { timeout: 90_000 });
    await expect(customerLinks(page)).toHaveCount(allRows);
  });

  test("シナリオ12: 対象項目 = マエカク + ステータスで絞り込める", async ({ page }) => {
    await signInAsDemo(page);
    await openCallList(page);
    const before = await rowCount(page);

    // マエカクのステータス値域は 未設定 / pending / done / unnecessary（顧客詳細と同一）。
    // seed の顧客は maekakuStatus が全て未設定なので、未設定 = 全件・実施済み = 0 件になる。
    await filterByCall(page, "maekaku", "unset");
    await expect(page).toHaveURL(/callType=maekaku/);
    expect(await rowCount(page), "未設定は seed 全件が該当する").toBe(before);
    // マエカク列（3 セル目）は全て未設定表示。
    for (const row of await page.getByRole("table").locator("tbody tr").all()) {
      await expect(row.locator("td").nth(2)).toHaveText("—");
    }

    // 実施済み（done）は該当なし → 空状態が出る（マエカク列に対して絞り込めている証拠）。
    await page.getByLabel("ステータス", { exact: true }).selectOption("done");
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await page.waitForURL(/callStatus=done/, { timeout: 90_000 });
    await expect(page.getByText("該当する顧客がありません")).toBeVisible();
    await expect(page.getByText("表示件数: 0件")).toBeVisible();
  });

  test("シナリオ13: 対象項目 = サンキューコール + ステータスで絞り込める", async ({ page }) => {
    await signInAsDemo(page);
    await openCallList(page);
    const before = await rowCount(page);

    // サンキュー以降の 3 種は not_done / done / unnecessary。
    await filterByCall(page, "thank_you", "done");
    await expect(page).toHaveURL(/callType=thank_you/);

    const after = await rowCount(page);
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
    // サンキュー列は 4 セル目。
    for (const row of await page.getByRole("table").locator("tbody tr").all()) {
      await expect(row.locator("td").nth(3)).toHaveText("実施済");
    }
  });

  test("シナリオ14: 対象項目 = ローン審査完了コール + ステータスで絞り込める", async ({ page }) => {
    await signInAsDemo(page);
    await openCallList(page);
    const before = await rowCount(page);

    await filterByCall(page, "loan_completion", "not_done");
    await expect(page).toHaveURL(/callType=loan_completion/);

    const after = await rowCount(page);
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
    for (const row of await page.getByRole("table").locator("tbody tr").all()) {
      await expect(row.locator("td").nth(4)).toHaveText("実施前");
    }
  });

  test("シナリオ15: 対象項目 = 施工完了コール + ステータスで絞り込める", async ({ page }) => {
    await signInAsDemo(page);
    await openCallList(page);
    const before = await rowCount(page);

    await filterByCall(page, "post_completion", "done");
    await expect(page).toHaveURL(/callType=post_completion/);

    const after = await rowCount(page);
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
    for (const row of await page.getByRole("table").locator("tbody tr").all()) {
      await expect(row.locator("td").nth(5)).toHaveText("実施済");
    }
  });

  test("シナリオ16: 対象項目を切り替えるとステータスの選択肢が入れ替わる", async ({ page }) => {
    await signInAsDemo(page);
    await openCallList(page);
    await openFilters(page);

    const status = page.getByLabel("ステータス", { exact: true });

    // 既定（すべて）— 4 種横断の統合ステータス。
    await expect(status.locator("option")).toHaveText([
      "すべて",
      "未設定",
      "未実施・実施前",
      "実施済",
      "不要",
    ]);

    await page.getByLabel("対象項目").selectOption("maekaku");
    await expect(status.locator("option")).toHaveText([
      "すべて",
      "未設定",
      "未実施",
      "実施済み",
      "不要",
    ]);

    await page.getByLabel("対象項目").selectOption("thank_you");
    await expect(status.locator("option")).toHaveText([
      "すべて",
      "未設定",
      "実施前",
      "実施済",
      "不要",
    ]);
  });

  test("シナリオ17: 担当者で絞り込める", async ({ page }) => {
    await signInAsDemo(page);
    await openCallList(page);

    const before = await rowCount(page);
    await openFilters(page);
    const assignee = page.getByLabel("担当者", { exact: true });
    await expect(assignee).toBeVisible();

    // 「すべて」以外の最初の担当者を選ぶ。
    const value = await assignee.locator("option").nth(1).getAttribute("value");
    expect(value, "担当者候補が 1 件以上ある").toBeTruthy();
    await assignee.selectOption(value!);
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await page.waitForURL(/assigneeUserId=/, { timeout: 90_000 });

    await expect(page.getByText("表示件数:")).toBeVisible();
    expect(await rowCount(page)).toBeLessThanOrEqual(before);
  });

  test("シナリオ18: 顧客名の昇順/降順で並べ替えできる", async ({ page }) => {
    await signInAsDemo(page);
    await openCallList(page);

    async function firstRowName(): Promise<string> {
      const first = customerLinks(page).first();
      await expect(first).toBeVisible({ timeout: 90_000 });
      return (await first.innerText()).trim();
    }

    // 並び替えは検索パネルの外（表示件数の横）にあり、検索ボタンを押さずに即反映される。
    await expect(filterToggle(page)).toHaveAttribute("aria-expanded", "false");

    await page.getByLabel("並び替え").selectOption("name");
    await page.waitForURL(/sortField=name/, { timeout: 90_000 });
    // 項目切替で並び順は自動的に昇順（あいうえお順）になる。
    await expect(page.getByLabel("並び順")).toHaveValue("asc");
    const asc = await firstRowName();

    await page.getByLabel("並び順").selectOption("desc");
    await page.waitForURL(/sortDir=desc/, { timeout: 90_000 });
    const desc = await firstRowName();

    expect(asc, "昇順と降順で先頭行が入れ替わる").not.toBe(desc);
  });

  test("シナリオ18b: 並び替えは表示件数の横にあり、検索条件を保ったまま切り替わる", async ({
    page,
  }) => {
    await signInAsDemo(page);
    await openCallList(page);

    // 表示件数と並び替えが同じ行に並ぶ（1366px でも折り返さない）。
    const countBox = await page.getByText(/^表示件数: \d+件$/).boundingBox();
    const sortBox = await page.getByLabel("並び替え").boundingBox();
    expect(countBox && sortBox).toBeTruthy();
    expect(sortBox!.x, "並び替えは表示件数より右").toBeGreaterThan(countBox!.x);
    expect(Math.abs(sortBox!.y - countBox!.y), "表示件数と並び替えは同じ行").toBeLessThan(
      sortBox!.height,
    );

    // 絞り込んだ状態で並び替えても検索条件は落ちない。
    await filterByCall(page, "thank_you", "done");
    const filtered = await rowCount(page);

    await page.getByLabel("並び替え").selectOption("name");
    await page.waitForURL(/sortField=name/, { timeout: 90_000 });
    await expect(page).toHaveURL(/callType=thank_you/);
    await expect(page).toHaveURL(/callStatus=done/);
    expect(await rowCount(page), "絞り込み結果の件数は変わらない").toBe(filtered);
  });

  test("シナリオ19: 日付項目の昇順/降順が機能する", async ({ page }) => {
    await signInAsDemo(page);
    await openCallList(page);

    // マエカク希望日時の近い順（昇順）。並び替えの対象列は通常行に出していないので、
    // 「並びが変わり、かつ同じ顧客集合が保たれる」ことで検証する。
    // seed は 5 日ぶんの希望日時を 12 顧客に巡回投入していて同値が多く、同値内は第 2 キー
    // （更新日時降順）で固定されるため、降順は昇順の完全な反転にはならない。
    await page.getByLabel("並び替え").selectOption("maekaku_preferred_at");
    await page.waitForURL(/sortField=maekaku_preferred_at/, { timeout: 90_000 });
    await expect(page.getByRole("table")).toBeVisible();
    const asc = await customerLinks(page).allInnerTexts();
    expect(asc.length).toBeGreaterThan(1);

    // 遠い順（降順）へ反転。
    await page.getByLabel("並び順").selectOption("desc");
    await page.waitForURL(/sortDir=desc/, { timeout: 90_000 });
    const desc = await customerLinks(page).allInnerTexts();

    expect(desc, "件数（= ページング）は変わらない").toHaveLength(asc.length);
    expect([...desc].sort(), "同じ顧客集合が返る").toEqual([...asc].sort());
    expect(desc, "並び順は昇順と異なる").not.toEqual(asc);
    expect(desc[0], "先頭行が入れ替わる").not.toBe(asc[0]);
  });

  test("シナリオ20: 日付対象 × 期間で絞り込める", async ({ page }) => {
    await signInAsDemo(page);
    await openCallList(page);
    const before = await rowCount(page);

    await openFilters(page);
    await page.getByLabel("日付対象").selectOption("next_appointment_at");
    await page.getByLabel("検索範囲 開始日").fill("2000-01-01");
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await page.waitForURL(/dateFrom=2000-01-01/, { timeout: 90_000 });
    await expect(page).toHaveURL(/dateField=next_appointment_at/);

    // 次回アポイント未設定の顧客が落ちるので、全件以下になる。
    expect(await rowCount(page)).toBeLessThanOrEqual(before);
    await expect(page.getByText("表示件数:")).toBeVisible();
  });

  test("シナリオ21: 表示件数セレクトとページャが動作する", async ({ page }) => {
    await signInAsDemo(page);
    await openCallList(page);

    await expect(page.getByText("表示件数", { exact: true })).toBeVisible();
    const sizeSelect = page.getByRole("combobox").filter({ hasText: "件" }).first();
    await sizeSelect.selectOption("10");
    await page.waitForURL(/pageSize=10/, { timeout: 90_000 });
    expect(await rowCount(page)).toBeLessThanOrEqual(10);

    // 10 件/ページなので seed（12 件）ではページャが出て 2 ページ目へ行ける。
    const next = page.getByRole("link", { name: "次へ" });
    if ((await next.count()) > 0) {
      await next.click();
      await page.waitForURL(/page=2/, { timeout: 90_000 });
      await expect(page.getByRole("table")).toBeVisible();
      expect(await rowCount(page)).toBeGreaterThan(0);
    }
  });

  test("シナリオ22: 既存の顧客一覧・顧客詳細が壊れていない", async ({ page }) => {
    await signInAsDemo(page);

    await page.goto("/customers", { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "顧客一覧" })).toBeVisible({ timeout: 90_000 });
    const row = page.getByRole("button", { name: /様$/ }).first();
    await expect(row).toBeVisible();
    await row.click();

    // ?tab= 無しの遷移では従来どおり基本情報タブが初期表示。
    await page.waitForURL(/\/customers\/[^/]+$/, { timeout: 90_000 });
    await expect(page.getByRole("tab", { name: "基本情報" })).toHaveAttribute(
      "data-state",
      "active",
    );
  });
});
