import { expect, test, type Page } from "@playwright/test";

// 二次店サイトのレスポンシブ確認（スタッフサイト / 管理者サイト）。
//
// 見た目そのものではなく「壊れていないこと」を機械的に確かめる。
//   R1. ページ全体に横スクロールが出ない（320 / 360 / 390 / 430 / 768 / 1280px）
//   R2. 狭い画面では開閉メニューになり、開閉が aria に反映される
//   R3. 一覧の主要操作（検索・条件をクリア・ページ送り）が指で押せる高さ
//   R4. 入力欄の文字が 16px 以上（iOS の自動拡大を避ける）
//   R5. 表の横スクロールは表の領域内だけで起きる
//   R6. 隠した列の内容が、狭い画面でも行内で確認できる
//   S1. ヘッダ 2 段がページ末尾まで画面上部に残る
//   S2. スクロール途中でもメニューを開閉でき、最後の項目まで選べる
//   S3. メニューを開いても本文が押し出されない / ヘッダの高さも変わらない
//   S4. 高さの狭い画面（横向き）でもメニュー内を縦スクロールできる
//
// baseURL は playwright.partner.config.ts の project が与える。

const WIDTHS = [320, 360, 390, 430, 768, 1280];
const PASSWORD = "Pilot!2026";

/** そのプロジェクトがスタッフサイトか（baseURL で判断する）。 */
function isStaffSite(baseURL: string | undefined): boolean {
  return (baseURL ?? "").includes("3200");
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "サインイン" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
}

/** ページ全体が横にはみ出していないか（1px の丸め誤差は許容）。 */
async function hasPageOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth > 1;
  });
}

test.describe.configure({ timeout: 240_000 });

test("R1/R5: 主要画面が各幅で横スクロールを起こさない", async ({ page, baseURL }) => {
  const staff = isStaffSite(baseURL);
  const email = staff ? "alpha-staff@solar-saas.dev" : "alpha-admin@solar-saas.dev";
  await signIn(page, email);

  // 一覧・詳細・フォームをひととおり。データがある状態で見る。
  const paths = staff
    ? [
        "/p-home",
        "/p-appointments",
        "/p-contracts",
        "/p-reports",
        "/p-catalog",
        "/p-customers",
        "/p-shifts",
        "/p-appointments/new?type=first-visit",
      ]
    : [
        "/p-home",
        "/p-appointments",
        "/p-contracts",
        "/p-reports",
        "/p-salespeople",
        "/p-accounts",
        "/p-customers",
        "/p-commissions",
        "/p-lane-preferences",
        "/p-shifts",
      ];

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of paths) {
      await page.goto(path, { timeout: 120_000 });
      await page.waitForLoadState("networkidle", { timeout: 90_000 });
      expect(await hasPageOverflow(page), `${width}px / ${path} で横スクロールが出ている`).toBe(
        false,
      );
    }
  }
});

test("R1: 0 件・複数条件・エラー表示でも横スクロールが出ない", async ({ page, baseURL }) => {
  const staff = isStaffSite(baseURL);
  await signIn(page, staff ? "alpha-staff@solar-saas.dev" : "alpha-admin@solar-saas.dev");

  const cases = [
    // 0 件
    "/p-reports?venuePlace=" + encodeURIComponent("該当しない会場名ZZZ"),
    // 複数条件
    "/p-reports?venuePlace=" +
      encodeURIComponent("会場") +
      "&eventDateFrom=2026-01-01&eventDateTo=2026-12-31&venueChain=CAINZ_W&category=HOUSING_EQUIPMENT",
    // 条件エラー（開始 > 終了）
    "/p-reports?eventDateFrom=2026-12-31&eventDateTo=2026-01-01",
  ];

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of cases) {
      await page.goto(path, { timeout: 120_000 });
      await page.waitForLoadState("networkidle", { timeout: 90_000 });
      expect(await hasPageOverflow(page), `${width}px / ${path}`).toBe(false);
    }
  }
});

test("R2: 狭い画面は開閉メニュー、広い画面は横並びタブ", async ({ page, baseURL }) => {
  const staff = isStaffSite(baseURL);
  await signIn(page, staff ? "alpha-staff@solar-saas.dev" : "alpha-admin@solar-saas.dev");
  await page.goto("/p-appointments", { timeout: 120_000 });
  // 開閉ボタンは SSR 済みでも、ハイドレーション前に押すと反応しない。
  // 同ファイルの S2/S3・S4 と同じく、操作の前に読み込みの落ち着きを待つ。
  await page.waitForLoadState("networkidle", { timeout: 90_000 });

  await page.setViewportSize({ width: 390, height: 800 });
  const toggle = page.getByRole("button", { name: /メニューを(開く|閉じる)/ });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  // 閉じているときはメニュー項目が見えない（現在の業務名だけ出る）。
  const nav = page.getByRole("navigation", { name: "パートナーメニュー" });
  await expect(nav.getByRole("link", { name: "トップ", exact: true })).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(nav.getByRole("link", { name: "トップ", exact: true })).toBeVisible();
  // 開いた状態でも横スクロールは出ない。
  expect(await hasPageOverflow(page)).toBe(false);

  // 押しやすい高さ（44px 以上）。
  const box = await nav.getByRole("link", { name: "トップ", exact: true }).boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(44);

  // 遷移するとメニューは閉じる。
  await nav.getByRole("link", { name: "トップ", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/p-home", { timeout: 120_000 });
  await expect(page.getByRole("button", { name: /メニューを開く/ })).toHaveAttribute(
    "aria-expanded",
    "false",
  );

  // 広い画面では横並びタブ（開閉ボタンは出ない）。
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole("button", { name: /メニューを(開く|閉じる)/ })).toBeHidden();
  await expect(nav.getByRole("link", { name: "トップ", exact: true })).toBeVisible();
});

test("R3/R4: 390px で検索まわりの操作が押しやすく、入力文字が 16px 以上", async ({
  page,
  baseURL,
}) => {
  const staff = isStaffSite(baseURL);
  await signIn(page, staff ? "alpha-staff@solar-saas.dev" : "alpha-admin@solar-saas.dev");
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/p-reports", { timeout: 120_000 });

  const apply = page.getByRole("button", { name: "検索", exact: true });
  const clear = page.getByRole("link", { name: "条件をクリア" });
  for (const target of [apply, clear]) {
    const box = await target.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  // テキスト入力・日付入力の文字サイズ。
  const venue = page.getByLabel("催事場所");
  const fontSize = await venue.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fontSize).toBeGreaterThanOrEqual(16);
  const inputBox = await venue.boundingBox();
  expect(inputBox!.height).toBeGreaterThanOrEqual(44);

  // 期間の開始・終了は縦に積み、どちらも画面内に収まる。
  const from = page.getByLabel("催事実施日 開始");
  const to = page.getByLabel("催事実施日 終了");
  const fromBox = await from.boundingBox();
  const toBox = await to.boundingBox();
  expect(toBox!.y).toBeGreaterThan(fromBox!.y);
  expect(fromBox!.x + fromBox!.width).toBeLessThanOrEqual(390);
});

test("R6: 狭い画面で隠した列の内容が行内から確認できる", async ({ page, baseURL }) => {
  const staff = isStaffSite(baseURL);
  await signIn(page, staff ? "alpha-staff@solar-saas.dev" : "alpha-admin@solar-saas.dev");
  await page.setViewportSize({ width: 390, height: 800 });

  await page.goto("/p-reports", { timeout: 120_000 });
  const firstRow = page.locator("tbody tr").first();
  if ((await page.locator("tbody tr").count()) > 0) {
    // 広い画面でしか列に出ない「抽選数」「種別」が、行の中に畳まれて出る。
    await expect(firstRow).toContainText("抽選数");
    await expect(firstRow).toContainText("種別");
  }

  // 詳細条件に値があると、畳まれず開いた状態で出る。
  await page.goto("/p-reports?areaInFacility=" + encodeURIComponent("入口"), { timeout: 120_000 });
  await expect(page.getByText("条件あり")).toBeVisible();
  await expect(page.getByLabel("施設内エリア")).toBeVisible();
});

/** ヘッダ（2 段）の現在位置と高さ。 */
async function headerRect(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector("header");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, height: r.height, bottom: r.bottom };
  });
}

test("S1: 一覧と長いフォームを下までスクロールしてもヘッダが残る", async ({ page, baseURL }) => {
  const staff = isStaffSite(baseURL);
  await signIn(page, staff ? "alpha-staff@solar-saas.dev" : "alpha-admin@solar-saas.dev");

  const paths = staff
    ? ["/p-reports", "/p-appointments/new?type=first-visit"]
    : ["/p-reports", "/p-accounts"];

  for (const width of [320, 390, 430, 1280]) {
    await page.setViewportSize({ width, height: 700 });
    for (const path of paths) {
      await page.goto(path, { timeout: 120_000 });
      await page.waitForLoadState("networkidle", { timeout: 90_000 });

      const before = await headerRect(page);
      expect(before, `${width}px / ${path}`).not.toBeNull();
      // 初期表示ではヘッダが画面上部にあり、本文と重なっていない。
      expect(Math.abs(before!.top)).toBeLessThanOrEqual(1);

      // ページ末尾までスクロールしても上部に残る。
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(250);
      const after = await headerRect(page);
      expect(Math.abs(after!.top), `${width}px / ${path} でヘッダが流れた`).toBeLessThanOrEqual(1);
      // 追従しても高さが変わらない（配置が飛ばない）。
      expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(1);
      // 横スクロールも出ない。
      expect(await hasPageOverflow(page)).toBe(false);

      await page.evaluate(() => window.scrollTo(0, 0));
    }
  }
});

test("S2/S3: スクロール途中でメニューを開き、最後の項目から遷移できる", async ({
  page,
  baseURL,
}) => {
  const staff = isStaffSite(baseURL);
  await signIn(page, staff ? "alpha-staff@solar-saas.dev" : "alpha-admin@solar-saas.dev");
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/p-reports", { timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });

  // 途中までスクロールしてから開く。
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(250);

  const main = page.locator("main");
  const mainBefore = await main.boundingBox();
  const headerBefore = await headerRect(page);

  const toggle = page.getByRole("button", { name: /メニューを開く/ });
  await toggle.click();
  await expect(page.getByRole("button", { name: /メニューを閉じる/ })).toBeVisible();

  // 本文は押し出されない（重ねて表示する）。ヘッダの高さも変わらない。
  const mainAfter = await main.boundingBox();
  const headerAfter = await headerRect(page);
  expect(Math.abs(mainAfter!.y - mainBefore!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(headerAfter!.height - headerBefore!.height)).toBeLessThanOrEqual(1);
  expect(await hasPageOverflow(page)).toBe(false);

  // 最後の項目（シフト）まで到達でき、そこから遷移できる。
  const nav = page.getByRole("navigation", { name: "パートナーメニュー" });
  const last = nav.getByRole("link", { name: "催事シフト", exact: true });
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeVisible();
  await last.click();
  await page.waitForURL((u) => u.pathname === "/p-shifts", { timeout: 120_000 });
  // 遷移後は閉じている。
  await expect(page.getByRole("button", { name: /メニューを開く/ })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

test("S4: 高さの狭い画面でもメニュー内を縦スクロールできる", async ({ page, baseURL }) => {
  const staff = isStaffSite(baseURL);
  await signIn(page, staff ? "alpha-staff@solar-saas.dev" : "alpha-admin@solar-saas.dev");
  // スマートフォンの横向き相当。
  await page.setViewportSize({ width: 430, height: 320 });
  await page.goto("/p-reports", { timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });

  await page.getByRole("button", { name: /メニューを開く/ }).click();
  const menu = page.locator('nav[aria-label="パートナーメニュー"] ul').first();
  await expect(menu).toBeVisible();

  // メニュー自身が画面内に収まり、あふれる分は中で縦スクロールする。
  const box = await menu.boundingBox();
  expect(box!.height).toBeLessThanOrEqual(320);
  const scrollable = await menu.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
  expect(scrollable).toBe(true);

  // 最後の項目までスクロールして押せる。
  const nav = page.getByRole("navigation", { name: "パートナーメニュー" });
  const last = nav.getByRole("link", { name: "催事シフト", exact: true });
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeVisible();
});
