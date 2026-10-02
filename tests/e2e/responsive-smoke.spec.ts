import { expect, test, type Page } from "@playwright/test";

// レスポンシブの smoke。390 / 834 / 1440px で主要画面が崩れないことだけを見る。
//
//   - ページ全体の横スクロールが出ない
//   - h1 と主操作ボタンが画面内に収まる
//   - 一覧は画面幅に応じて列数が減る（PC の縮小表示にしない）
//   - モーダルが viewport を超えない
//
// 画面外に出てよいのは閉じた状態のモバイルナビ（aside）だけ。

const OWNER = "owner@solar-saas.demo";
const PASSWORD = "Demo1234!";

const PATHS = [
  "/members",
  "/salespeople",
  "/payments",
  "/customers",
  "/customers/maekaku",
  "/appointments",
  "/contracts",
  "/loan-reviews",
  "/constructions",
  "/applications",
  // 製品カタログ。カテゴリごとに列構成が違うので、代表として
  // 列数が最も多い BT と、最も少ないプレゼント品の 2 つを見る。
  "/product-catalog/bt",
  "/product-catalog/gift",
];

/** 展開シェブロンを持つ一覧（展開前後で位置が変わらないことを確認する対象）。 */
const EXPANDABLE = ["/salespeople", "/members", "/product-catalog/bt"];

test.describe.configure({ timeout: 240_000 });

async function signIn(page: Page): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(OWNER);
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "サインイン" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
}

/** 表示中（display:none でない）の列数。 */
async function visibleColumnCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const table = document.querySelector("table");
    if (!table) return 0;
    return Array.from(table.querySelectorAll("thead th")).filter(
      (th) => th.getBoundingClientRect().width > 0,
    ).length;
  });
}

for (const width of [390, 834, 1440]) {
  test(`${width}px で主要画面が崩れない`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);

    for (const path of PATHS) {
      await page.goto(path, { timeout: 120_000 });
      await page.waitForLoadState("networkidle", { timeout: 90_000 });
      // ハイドレーション後のレイアウト確定を待ってから測る。
      await page.waitForTimeout(500);

      const result = await page.evaluate(() => {
        const vw = window.innerWidth;
        const h1 = document.querySelector("h1");
        // 画面外に出ている操作要素。閉じたモバイルナビ（aside）内は除く。
        const outside = Array.from(document.querySelectorAll("a,button,select")).filter((el) => {
          if (el.closest("aside")) return false;
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > vw + 1 || r.left < -1);
        }).length;

        const table = document.querySelector("table");
        // 内容が列幅を超えていて、かつ clip されていないセル。
        // これが隣の値と連結して見える原因になる。
        const bleeding = table
          ? Array.from(table.querySelectorAll("tbody td")).filter((td) => {
              const w = td.getBoundingClientRect().width;
              if (w <= 0 || td.scrollWidth <= Math.ceil(w) + 1) return false;
              const overflowX = getComputedStyle(td).overflowX;
              return !["hidden", "clip", "auto", "scroll"].includes(overflowX);
            }).length
          : 0;
        // バッジが 1 文字ずつ折り返すと高さが伸びる（1 行なら 20px 前後）。
        const tallBadges = table
          ? Array.from(
              table.querySelectorAll("tbody [class*='inline-flex'][class*='rounded-sm']"),
            ).filter((el) => el.getBoundingClientRect().height > 30).length
          : 0;

        return {
          pageOverflow: document.documentElement.scrollWidth > vw + 1,
          h1Inside: h1
            ? h1.getBoundingClientRect().left >= 0 && h1.getBoundingClientRect().right <= vw + 1
            : true,
          outside,
          bleeding,
          tallBadges,
        };
      });

      expect(result.pageOverflow, `${path} に横スクロールが出ない`).toBe(false);
      expect(result.h1Inside, `${path} の見出しが切れない`).toBe(true);
      expect(result.outside, `${path} の操作要素が画面外に出ない`).toBe(0);
      expect(result.bleeding, `${path} でセルの値が隣へはみ出さない`).toBe(0);
      expect(result.tallBadges, `${path} でバッジが途中改行しない`).toBe(0);
    }
  });
}

test("一覧は画面幅に応じて列数が減る", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);

  const wide: Record<string, number> = {};
  for (const path of ["/members", "/salespeople", "/customers/maekaku", "/product-catalog/bt"]) {
    await page.goto(path, { timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });
    await page.waitForTimeout(500);
    wide[path] = await visibleColumnCount(page);
  }

  await page.setViewportSize({ width: 390, height: 900 });
  for (const path of ["/members", "/salespeople", "/customers/maekaku", "/product-catalog/bt"]) {
    await page.goto(path, { timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });
    await page.waitForTimeout(500);
    const narrow = await visibleColumnCount(page);
    expect(narrow, `${path} は狭い画面で列が減る`).toBeLessThan(wide[path]!);
    // 主要情報 + シェブロンだけに絞れていること。
    expect(narrow, `${path} は狭い画面で 4 列以下`).toBeLessThanOrEqual(4);
  }
});

test("390px でモーダルが viewport を超えない", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await signIn(page);

  await page.goto("/members", { timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
  const table = page.getByRole("table");
  await table.locator("tbody tr").first().click();
  await table.locator("tbody tr").nth(1).getByRole("button", { name: "編集" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 90_000 });
  // 開くアニメーション（zoom）が終わってから位置を測る。
  await page.waitForTimeout(600);

  const box = await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"]')!;
    const r = el.getBoundingClientRect();
    return {
      left: r.left,
      right: r.right,
      vw: window.innerWidth,
      maxHeightFits: r.height <= window.innerHeight,
    };
  });
  expect(box.left, "左に余白がある").toBeGreaterThan(0);
  expect(box.right, "右が画面内").toBeLessThanOrEqual(box.vw);
  expect(box.maxHeightFits, "縦も画面内に収まる").toBe(true);

  // フッターのボタンが押せる位置にある。
  await expect(dialog.getByRole("button", { name: "保存" })).toBeVisible();
});

test("展開シェブロンの位置は展開前後で変わらない", async ({ page }) => {
  // 展開行の colSpan は非表示列にも幅を配分するため、幅指定が抜けていると
  // 展開時だけ列が痩せて chevron が左へ動く。その回帰を防ぐ。
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);

    for (const path of EXPANDABLE) {
      await page.goto(path, { timeout: 120_000 });
      await page.waitForLoadState("networkidle", { timeout: 90_000 });
      await page.waitForTimeout(400);

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

      expect(
        Math.abs(after.x - before.x),
        `${width}px ${path} の chevron x が動かない`,
      ).toBeLessThanOrEqual(1);
      expect(after.w, `${width}px ${path} の chevron 幅が変わらない`).toBe(before.w);
      // スマホでは 44px のタップ領域を確保する。
      if (width === 390) {
        expect(before.h, `${path} の chevron タップ領域`).toBeGreaterThanOrEqual(44);
        expect(before.w, `${path} の chevron タップ領域`).toBeGreaterThanOrEqual(44);
      }
    }
  }
});
