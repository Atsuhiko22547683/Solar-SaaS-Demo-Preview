import { expect, test, type Page } from "@playwright/test";

// 製品カタログ（/product-catalog）の最小検証。
//
//   A. 画面中央に 6 カテゴリのタブが無い（切替はサイドバーだけ）
//   B. サイドバーの 6 カテゴリ切替は維持され、6 カテゴリすべてを開ける
//   C. PV / BT でメーカー絞り込みができる（すべて → 該当メーカーのみ）
//   D. メーカー絞り込みと検索条件は併用できる
//   E. 新しいメーカー名で商品を登録でき、そのメーカーが絞り込み候補に出る
//   F. 編集でメーカーを変更できる
//   G. 商品を登録 → 編集 → 論理削除できる（仕入れ値 / 卸値の保存を含む）
//   H. BT は容量・機能区分・保証を持つ（機能区分違いは別商品）
//   I. エコキュートはメーカー / シリーズ / 型番で管理する
//   J. 390px でメーカー UI と一覧が崩れない
//   K. 一覧の「有効」チェックで即時に有効 / 無効を切り替えられる（行は展開しない）
//   L. OWNER / SYSTEM_ADMIN / GENERAL_USER の 3 ロールとも登録・編集・削除・切替できる
//
// 業務ロジック（契約・粗利）は対象外。ここはカタログ画面の CRUD と見た目だけ。

const OWNER = "owner@solar-saas.demo";
const SYSTEM_ADMIN = "sysadmin@solar-saas.demo";
const GENERAL_USER = "user@solar-saas.demo";
const PASSWORD = "Demo1234!";

const BASE = "/product-catalog";

const CATEGORY_LABELS = ["PV", "BT", "エコキュート", "IH", "プレゼント品", "その他"];

test.describe.configure({ timeout: 180_000 });

async function signIn(page: Page, email: string = OWNER): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "サインイン" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
}

async function openCategory(page: Page, slug: string, label: string): Promise<void> {
  await page.goto(`${BASE}/${slug}`, { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: label, exact: true, level: 1 })).toBeVisible({
    timeout: 90_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
}

/** メーカー絞り込みのチップ（sm 以上で出る横並び）。 */
function makerChip(page: Page, name: string) {
  return page.getByRole("link", { name, exact: true });
}

/** 通常行の「有効」チェックボックス。 */
function activeCheckbox(row: ReturnType<Page["getByRole"]>) {
  return row.getByRole("checkbox");
}

/** 一意な名前。同じ spec を繰り返し流しても重複判定に当たらないようにする。 */
function unique(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

test("A: 画面中央に 6 カテゴリのタブが無い", async ({ page }) => {
  await signIn(page);
  await openCategory(page, "pv", "PV");

  // カテゴリ切替はサイドバーの役割。中央にタブを再掲しない。
  await expect(page.getByRole("tab")).toHaveCount(0);

  // 代わりにメーカー絞り込みが置かれている。
  await expect(page.getByRole("heading", { name: "メーカー", exact: true })).toBeVisible();
  await expect(makerChip(page, "すべて")).toBeVisible();

  // どのカテゴリにいるかは見出しで分かる。
  await expect(page.getByText("製品カタログ", { exact: true }).first()).toBeVisible();

  // /product-catalog は先頭カテゴリ（PV）へ寄せる。
  await page.goto(BASE, { timeout: 120_000 });
  await expect(page).toHaveURL(/\/product-catalog\/pv/, { timeout: 90_000 });
});

test("B: サイドバーから 6 カテゴリすべてを開ける", async ({ page }) => {
  await signIn(page);
  await openCategory(page, "pv", "PV");

  // サイドバーの導線は 6 カテゴリを決められた順で持つ。
  const nav = page.getByRole("navigation").first();
  for (const label of CATEGORY_LABELS) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toHaveCount(1);
  }

  const expected: [string, string, string[]][] = [
    ["pv", "PV", ["メーカー", "型番"]],
    ["bt", "BT", ["シリーズ", "容量", "機能区分"]],
    ["eco-cute", "エコキュート", ["シリーズ", "型番"]],
    ["ih", "IH", ["メーカー", "型番"]],
    ["gift", "プレゼント品", ["商品名"]],
    ["other", "その他", ["商品名", "型番"]],
  ];

  for (const [slug, label, headers] of expected) {
    await openCategory(page, slug, label);
    for (const h of headers) {
      await expect(page.getByRole("columnheader", { name: h, exact: true })).toBeVisible();
    }
    // 仕入れ値 / 卸値は全カテゴリ共通。名称を言い換えない。
    await expect(page.getByRole("columnheader", { name: "仕入れ値" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "卸値" })).toBeVisible();
  }
});

test("C: BT をメーカーで絞り込める", async ({ page }) => {
  await signIn(page);
  await openCategory(page, "bt", "BT");

  const rows = page.getByRole("table").locator("tbody tr");
  const all = await rows.count();
  expect(all, "「すべて」では複数メーカーの商品が並ぶ").toBeGreaterThan(0);
  await expect(page.getByRole("row").filter({ hasText: "長州産業" }).first()).toBeVisible();

  // ニチコンだけに絞る。
  await makerChip(page, "ニチコン").click();
  await page.waitForURL(/maker=/, { timeout: 90_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });

  const filtered = await rows.count();
  expect(filtered, "絞り込むと件数が減る").toBeLessThan(all);
  expect(filtered).toBeGreaterThan(0);
  // 他メーカーの行は残らない。
  await expect(page.getByRole("row").filter({ hasText: "長州産業" })).toHaveCount(0);

  // 「すべて」で戻る。
  await makerChip(page, "すべて").click();
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
  await expect(rows).toHaveCount(all, { timeout: 90_000 });
});

test("C2: PV をメーカーで絞り込める（選択はリロードしても残る）", async ({ page }) => {
  await signIn(page);
  await openCategory(page, "pv", "PV");

  await makerChip(page, "Qセルズ").click();
  await page.waitForURL(/maker=/, { timeout: 90_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });

  const rows = page.getByRole("table").locator("tbody tr");
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  await expect(page.getByRole("row").filter({ hasText: "カナディアンソーラー" })).toHaveCount(0);

  // クエリで保持しているので、リロードしても選択が消えない。
  await page.reload({ timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
  await expect(rows).toHaveCount(count, { timeout: 90_000 });
  await expect(makerChip(page, "Qセルズ")).toHaveAttribute("aria-current", "true");
});

test("D: メーカー絞り込みと検索条件は併用できる", async ({ page }) => {
  await signIn(page);
  // 長州産業 × "9.8" — 長州産業の 9.8kWh だけが残る。
  await page.goto(`${BASE}/bt?maker=${encodeURIComponent("長州産業")}&query=9.8`, {
    timeout: 120_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });

  const rows = page.getByRole("table").locator("tbody tr");
  await expect(rows).toHaveCount(3, { timeout: 90_000 });
  await expect(page.getByRole("row").filter({ hasText: "オムロン" })).toHaveCount(0);

  // 検索パネルから検索し直してもメーカー絞り込みは維持される。
  // 検索条件つきの URL で開いているのでパネルは最初から開いている。
  await page.getByRole("button", { name: "検索", exact: true }).click();
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
  await expect(page).toHaveURL(/maker=/, { timeout: 90_000 });
});

test("E/F/G: 新しいメーカーで登録 → filter へ反映 → 編集 → 論理削除", async ({ page }) => {
  await signIn(page);
  await openCategory(page, "ih", "IH");

  const modelNo = unique("IH-TEST");
  const newMaker = unique("テスト電機");
  const renamedMaker = `${newMaker}-改`;

  // --- 登録（メーカーは候補に無い新しい名前。前後の空白は落として保存される） ---
  await page.getByRole("button", { name: "商品を登録" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 90_000 });
  await expect(dialog.getByLabel("カテゴリ")).toHaveValue("IH");
  // IH に無い項目は描かない。
  await expect(dialog.getByLabel("容量", { exact: false })).toHaveCount(0);
  // メーカー欄は既存候補を持つ combobox（datalist）。
  await expect(dialog.getByLabel("メーカー")).toHaveAttribute("list", /maker-options/);

  await dialog.getByLabel("メーカー").fill(`  ${newMaker}  `);
  await dialog.getByLabel("型番").fill(modelNo);
  await dialog.getByLabel("仕入れ値").fill("12000");
  await dialog.getByLabel("卸値").fill("18000");
  await dialog.getByRole("button", { name: "登録", exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 90_000 });

  const row = page.getByRole("row").filter({ hasText: modelNo });
  await expect(row).toHaveCount(1, { timeout: 90_000 });
  await expect(row).toContainText("¥12,000");
  await expect(row).toContainText("¥18,000");

  // --- 新しいメーカーが絞り込み候補に出る（trim されている） ---
  await page.reload({ timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
  await expect(makerChip(page, newMaker)).toBeVisible({ timeout: 90_000 });

  // --- 編集（メーカーと価格を変える） ---
  await page
    .getByRole("row")
    .filter({ hasText: modelNo })
    .first()
    .getByRole("button", { name: /詳細を開く/ })
    .click();
  await page.getByRole("button", { name: "編集" }).first().click();
  const editDialog = page.getByRole("dialog");
  await expect(editDialog).toBeVisible({ timeout: 90_000 });
  await expect(editDialog.getByLabel("型番")).toHaveValue(modelNo);
  await expect(editDialog.getByLabel("メーカー")).toHaveValue(newMaker);
  await expect(editDialog.getByLabel("仕入れ値")).toHaveValue("12000");
  await editDialog.getByLabel("メーカー").fill(renamedMaker);
  await editDialog.getByLabel("卸値").fill("19500");
  await editDialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(editDialog).toBeHidden({ timeout: 90_000 });

  const updated = page.getByRole("row").filter({ hasText: modelNo });
  await expect(updated.first()).toContainText("¥19,500", { timeout: 90_000 });
  await expect(updated.first()).toContainText(renamedMaker);

  // --- 削除（論理削除） ---
  // 保存後も行は開いたまま（展開状態はクライアント側の状態で、
  // router.refresh() では閉じない）。そのまま展開バナーの削除を押す。
  await page.getByRole("button", { name: "削除" }).first().click();
  const confirm = page.getByRole("dialog");
  await expect(confirm).toBeVisible({ timeout: 90_000 });
  await confirm.getByRole("button", { name: "削除", exact: true }).click();
  await expect(confirm).toBeHidden({ timeout: 90_000 });

  // 通常一覧からは消える。
  await expect(page.getByRole("row").filter({ hasText: modelNo })).toHaveCount(0, {
    timeout: 90_000,
  });
  // 無効な商品しか持たないメーカーは絞り込み候補にも残らない。
  await expect(makerChip(page, renamedMaker)).toHaveCount(0);
  // 行自体は残っている（物理削除しない）ので、無効も表示すれば見える。
  await page.goto(`${BASE}/ih?retired=1`, { timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
  await expect(page.getByRole("row").filter({ hasText: modelNo })).toHaveCount(1, {
    timeout: 90_000,
  });
});

test("H: BT は容量・機能区分・保証を持ち、機能区分違いが別商品として並ぶ", async ({ page }) => {
  await signIn(page);
  await openCategory(page, "bt", "BT");

  // シード済みの「スマートPVマルチ 6.3kWh」が 3 つの機能区分で並ぶ。
  const rows = page.getByRole("row").filter({ hasText: "6.3kWh" });
  await expect(rows).toHaveCount(3, { timeout: 90_000 });
  for (const fn of ["単機能", "特定負荷", "全負荷"]) {
    await expect(
      page.getByRole("row").filter({ hasText: "6.3kWh" }).filter({ hasText: fn }),
    ).toHaveCount(1);
  }

  // 展開すると容量・機能区分・保証が揃って見える。
  await rows
    .first()
    .getByRole("button", { name: /詳細を開く/ })
    .click();
  const banner = page.locator("[id^='catalog-row-detail-']").first();
  await expect(banner).toContainText("6.3kWh");
  await expect(banner).toContainText("年保証");

  // 登録フォームは BT 固有の項目を出す。
  await page.getByRole("button", { name: "商品を登録" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("カテゴリ")).toHaveValue("BT");
  await expect(dialog.getByLabel("シリーズ")).toBeVisible();
  await expect(dialog.getByLabel("機能区分")).toBeVisible();
});

test("I: エコキュートはメーカー / シリーズ / 型番で管理する", async ({ page }) => {
  await signIn(page);
  await openCategory(page, "eco-cute", "エコキュート");

  const row = page.getByRole("row").filter({ hasText: "HE-S37LQS" });
  await expect(row).toHaveCount(1, { timeout: 90_000 });
  await row.getByRole("button", { name: /詳細を開く/ }).click();

  const banner = page.locator("[id^='catalog-row-detail-']").first();
  await expect(banner).toContainText("Panasonic");
  await expect(banner).toContainText("Sシリーズ");
  await expect(banner).toContainText("HE-S37LQS");
});

test("J: 390px で横スクロールが出ず、メーカー UI が select になる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await signIn(page);

  const slugs: [string, string][] = [
    ["pv", "PV"],
    ["bt", "BT"],
    ["eco-cute", "エコキュート"],
    ["ih", "IH"],
    ["gift", "プレゼント品"],
    ["other", "その他"],
  ];

  for (const [slug, label] of slugs) {
    await openCategory(page, slug, label);
    await page.waitForTimeout(400);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow, `${slug} に横スクロールが出ない`).toBe(false);
  }

  // 狭い画面ではチップではなく select を出す（名前が多くても詰め込まない）。
  await openCategory(page, "bt", "BT");
  const makerSelect = page.getByRole("combobox", { name: "メーカー", exact: true });
  await expect(makerSelect).toBeVisible();
  await expect(makerChip(page, "すべて")).toBeHidden();

  await makerSelect.selectOption({ label: "ニチコン" });
  await page.waitForURL(/maker=/, { timeout: 90_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
  await expect(page.getByRole("row").filter({ hasText: "長州産業" })).toHaveCount(0);

  // 展開しても chevron の位置・幅が動かない（44px のタップ領域も維持）。
  const box = () =>
    page.evaluate(() => {
      const btn = document.querySelector("table tbody tr button[aria-expanded]")!;
      const r = btn.getBoundingClientRect();
      return { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height) };
    });

  const before = await box();
  await page.locator("table tbody tr button[aria-expanded]").first().click();
  await page.waitForTimeout(400);
  const after = await box();

  expect(Math.abs(after.x - before.x), "chevron の x が動かない").toBeLessThanOrEqual(1);
  expect(after.w, "chevron の幅が変わらない").toBe(before.w);
  expect(before.h, "chevron のタップ領域").toBeGreaterThanOrEqual(44);
  expect(before.w, "chevron のタップ領域").toBeGreaterThanOrEqual(44);
});

test("K: 一覧の「有効」チェックで即時に切り替わる（行は展開しない）", async ({ page }) => {
  await signIn(page);
  await openCategory(page, "ih", "IH");

  const modelNo = unique("IH-TOGGLE");

  // 対象を 1 件作る（既存のシード商品を無効化して他テストに影響させない）。
  await page.getByRole("button", { name: "商品を登録" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 90_000 });
  await dialog.getByLabel("メーカー").fill("トグル電機");
  await dialog.getByLabel("型番").fill(modelNo);
  await dialog.getByLabel("仕入れ値").fill("1000");
  await dialog.getByLabel("卸値").fill("2000");
  await dialog.getByRole("button", { name: "登録", exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 90_000 });

  const allRows = page.getByRole("table").locator("tbody tr");
  const row = page.getByRole("row").filter({ hasText: modelNo });
  await expect(row).toHaveCount(1, { timeout: 90_000 });

  // A. 有効な商品はチェックが入っている。
  await expect(activeCheckbox(row)).toBeChecked();

  // G. チェック操作では行が展開しない（アコーディオンと完全に分離）。
  const before = await allRows.count();
  await activeCheckbox(row).click();
  await expect(page.getByText("無効にしました")).toBeVisible({ timeout: 90_000 });

  // B/C. isActive=false になり、通常一覧からは消える。
  await expect(page.getByRole("row").filter({ hasText: modelNo })).toHaveCount(0, {
    timeout: 90_000,
  });
  // 展開行が増えていない（= チェックで開いていない）。
  expect(await allRows.count()).toBeLessThanOrEqual(before);

  // D/E. 「無効の商品も表示」で見えて、チェックは外れている。
  await page.goto(`${BASE}/ih?retired=1`, { timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
  const retiredRow = page.getByRole("row").filter({ hasText: modelNo });
  await expect(retiredRow).toHaveCount(1, { timeout: 90_000 });
  await expect(activeCheckbox(retiredRow)).not.toBeChecked();

  // F. チェックを戻すと有効へ復帰する。
  await activeCheckbox(retiredRow).click();
  await expect(page.getByText("有効にしました")).toBeVisible({ timeout: 90_000 });
  await page.goto(`${BASE}/ih`, { timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
  const restored = page.getByRole("row").filter({ hasText: modelNo });
  await expect(restored).toHaveCount(1, { timeout: 90_000 });
  await expect(activeCheckbox(restored)).toBeChecked();

  // H. シェブロンは従来どおり展開する。
  await restored.getByRole("button", { name: /詳細を開く/ }).click();
  await expect(page.locator("[id^='catalog-row-detail-']").first()).toBeVisible();

  // 後片付け（論理削除して一覧から外す）。
  await page.getByRole("button", { name: "削除" }).first().click();
  const confirm = page.getByRole("dialog");
  await confirm.getByRole("button", { name: "削除", exact: true }).click();
  await expect(confirm).toBeHidden({ timeout: 90_000 });
});

test("I2: 有効チェックを足してもシェブロンの位置は展開前後で変わらない", async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    await openCategory(page, "bt", "BT");
    await page.waitForTimeout(400);

    const box = () =>
      page.evaluate(() => {
        const btn = document.querySelector("table tbody tr button[aria-expanded]")!;
        const r = btn.getBoundingClientRect();
        return { x: Math.round(r.x), w: Math.round(r.width) };
      });
    const checkboxBox = () =>
      page.evaluate(() => {
        const el = document.querySelector('table tbody tr input[type="checkbox"]')!;
        const r = el.getBoundingClientRect();
        return { right: Math.round(r.right), vw: window.innerWidth };
      });

    const before = await box();
    const cb = await checkboxBox();
    // チェックボックスは画面内で、シェブロンより左にある。
    expect(cb.right, `${width}px でチェックボックスが画面内`).toBeLessThanOrEqual(cb.vw);
    expect(cb.right, `${width}px でチェックボックスはシェブロンの左`).toBeLessThanOrEqual(
      before.x + before.w,
    );

    await page.locator("table tbody tr button[aria-expanded]").first().click();
    await page.waitForTimeout(400);
    const after = await box();
    expect(
      Math.abs(after.x - before.x),
      `${width}px で chevron の x が動かない`,
    ).toBeLessThanOrEqual(1);
    expect(after.w, `${width}px で chevron の幅が変わらない`).toBe(before.w);
  }
});

// L: システムユーザーの 3 ロールとも同じ操作ができる。
// 製品カタログは通常業務機能なので、設定・決済管理と違って GENERAL_USER も含む。
for (const [roleLabel, email] of [
  ["SYSTEM_ADMIN", SYSTEM_ADMIN],
  ["GENERAL_USER", GENERAL_USER],
] as const) {
  test(`L: ${roleLabel} も登録・編集・削除・有効無効切替ができる`, async ({ page }) => {
    await signIn(page, email);
    await openCategory(page, "ih", "IH");

    const modelNo = unique(`IH-${roleLabel}`);

    // 登録 — ボタンが見えて、実際に保存できる。
    await page.getByRole("button", { name: "商品を登録" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 90_000 });
    await dialog.getByLabel("メーカー").fill("権限テスト電機");
    await dialog.getByLabel("型番").fill(modelNo);
    await dialog.getByLabel("仕入れ値").fill("3000");
    await dialog.getByLabel("卸値").fill("4000");
    await dialog.getByRole("button", { name: "登録", exact: true }).click();
    await expect(dialog).toBeHidden({ timeout: 90_000 });

    const row = page.getByRole("row").filter({ hasText: modelNo });
    await expect(row).toHaveCount(1, { timeout: 90_000 });

    // 有効無効切替 — チェックを外すと通常一覧から消える。
    await activeCheckbox(row).click();
    await expect(page.getByRole("row").filter({ hasText: modelNo })).toHaveCount(0, {
      timeout: 90_000,
    });

    // 無効も表示 → 有効へ戻す。
    await page.goto(`${BASE}/ih?retired=1`, { timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });
    const retiredRow = page.getByRole("row").filter({ hasText: modelNo });
    await expect(activeCheckbox(retiredRow)).not.toBeChecked();
    await activeCheckbox(retiredRow).click();
    await expect(page.getByText("有効にしました")).toBeVisible({ timeout: 90_000 });

    // 編集 — 展開バナーの編集が出て、保存できる。
    await page.goto(`${BASE}/ih`, { timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });
    await page
      .getByRole("row")
      .filter({ hasText: modelNo })
      .first()
      .getByRole("button", { name: /詳細を開く/ })
      .click();
    await page.getByRole("button", { name: "編集" }).first().click();
    const editDialog = page.getByRole("dialog");
    await expect(editDialog).toBeVisible({ timeout: 90_000 });
    await editDialog.getByLabel("卸値").fill("4500");
    await editDialog.getByRole("button", { name: "保存", exact: true }).click();
    await expect(editDialog).toBeHidden({ timeout: 90_000 });
    await expect(page.getByRole("row").filter({ hasText: modelNo }).first()).toContainText(
      "¥4,500",
    );

    // 削除 — 展開バナーの削除が出て、論理削除できる。
    await page.getByRole("button", { name: "削除" }).first().click();
    const confirm = page.getByRole("dialog");
    await expect(confirm).toBeVisible({ timeout: 90_000 });
    await confirm.getByRole("button", { name: "削除", exact: true }).click();
    await expect(confirm).toBeHidden({ timeout: 90_000 });
    await expect(page.getByRole("row").filter({ hasText: modelNo })).toHaveCount(0, {
      timeout: 90_000,
    });
  });
}
