import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { signIn } from "../fixtures/auth";

// E2E spec for T-03-07 — wholesaler-side dealer-preference status screen
// (S-025 / S-026 / F-022 / docs/04 §1.3 / docs/05 §4.5).
//
// 検証内容:
//   1. wholesaler_admin で `/event-detail/[id]/preferences` にアクセスし、
//      「取引先別」「店舗別」の 2 タブが描画される。
//   2. 公開対象が無い場合は「公開対象の取引先がありません…」の空状態文言が
//      描画される（登録直後は visibility 0 件のため）。
//
// 現行 UI への追随:
//   イベント候補のルートは `/event-candidates` から `/event-detail` へ移動済み。
//   旧 spec は旧ルートを叩いていたため失敗していた（アプリ側は戻さない）。
//
// 前提: seed に EventCandidate は無いため、テスト先頭で `/event-detail/new`
// 経由で 1 件登録してから対象 ID を URL からキャプチャする。
// 登録した候補は afterAll で必ず削除する。

test.describe.configure({ timeout: 120_000 });

const RUN_ID = Date.now();
/** cleanup が完全一致で消す店舗名。 */
const STORE_NAME = `E2E希望状況店舗${RUN_ID}`;

const FIXTURE_DIR = resolve(__dirname, "..", "fixtures");
const DB_DIR = resolve(__dirname, "..", "..", "..", "packages", "db");

/**
 * イベント候補の「詳細」ページか。
 * /event-detail/new も同じ階層にあるので、単純な /<id> 判定だと新規画面に合致する。
 * ID が "new" のときだけ明示的に除外する。
 */
function isCandidateDetailUrl(url: URL): boolean {
  const m = url.pathname.match(/^\/event-detail\/([A-Za-z0-9_-]+)$/);
  return m !== null && m[1] !== "new";
}

test.afterAll(() => {
  execFileSync(
    "pnpm",
    ["exec", "tsx", resolve(FIXTURE_DIR, "cleanup-e2e-preference-status.ts"), String(RUN_ID)],
    { cwd: DB_DIR, stdio: "inherit", shell: process.platform === "win32" },
  );
});

test("wholesaler_admin can open the preference-status page with both tabs visible (empty state)", async ({
  page,
}) => {
  await signIn(page, "wholesaler_admin@solar-saas.dev");

  // --- Step 1: 新規イベント候補を 1 件作成して ID を取得 ---
  await page.goto("/event-detail/new");
  await expect(page.getByRole("heading", { name: "イベント候補を新規登録" })).toBeVisible();

  await page.getByLabel("店舗名", { exact: false }).fill(STORE_NAME);
  await page.getByLabel("対象年月", { exact: false }).fill("2026-12");
  // <input type="date">
  await page.locator("input[type=date]").first().fill("2026-12-15");
  // <input type="datetime-local"> for deadlineAt
  await page.locator("input[type=datetime-local]").first().fill("2026-12-01T10:00");

  await page.getByRole("button", { name: "登録", exact: false }).click();

  // 詳細画面へ遷移する。URL は `/event-detail/<id>` 形式（new は除外）。
  await page.waitForURL(isCandidateDetailUrl, { timeout: 60_000 });
  const match = page.url().match(/\/event-detail\/([A-Za-z0-9_-]+)/);
  expect(match, `failed to capture candidate id from URL ${page.url()}`).not.toBeNull();
  const candidateId = match![1]!;

  // --- Step 2: /preferences に遷移してタブ + 空状態を確認 ---
  await page.goto(`/event-detail/${candidateId}/preferences`);

  // 画面見出し。
  await expect(page.getByRole("heading", { name: "取引先希望状況", level: 1 })).toBeVisible();

  // 2 タブが両方描画されている。
  await expect(page.getByRole("tab", { name: "取引先別" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "店舗別" })).toBeVisible();

  // 既定タブは「取引先別」。visibility 0 件のため空状態の文言が出る。
  await expect(page.getByText("公開対象の取引先がありません", { exact: false })).toBeVisible();

  // 「店舗別」タブに切替えて表に対象店舗の行が出ることを確認。
  // 同じ店舗名はページ上部の見出しにも出るので、表のセルに限定して引く。
  await page.getByRole("tab", { name: "店舗別" }).click();
  await expect(page.getByRole("cell", { name: STORE_NAME })).toBeVisible();
});
