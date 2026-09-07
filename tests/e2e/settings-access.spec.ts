import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { signIn } from "./fixtures/auth";

// 設定配下の各画面に WHOLESALER_ADMIN が実際にアクセスできることの検証。
//
// 目的は「メニューには出るが開くと 403」を作らないこと。
// 卸業者グループの error boundary は ForbiddenError / TenantIsolationError を
// 見出し「この情報にアクセスできません」で描画するので、その見出しが出ないことと、
// 各画面固有の見出しが出ることの両方を確認する。
//
// サイドバーはアコーディオンで、現在のルートが配下にあるグループは初期状態で開く。
// そのため設定配下のページ（/masters）から始めてメニュー遷移を検証する。

/** 403 のときに error boundary が出す見出し（labels.common.forbidden）。 */
const FORBIDDEN_HEADING = "この情報にアクセスできません";

/** 設定配下の各画面。href はサイドバーのリンク先と一致させる。 */
const SETTINGS_PAGES = [
  { menu: "スタッフ一覧", href: "/salespeople", heading: "スタッフ一覧" },
  { menu: "取引先管理", href: "/masters/relationships", heading: "取引先一覧" },
  { menu: "システムユーザー", href: "/members", heading: "システムユーザー" },
  { menu: "エリア・場所管理", href: "/masters", heading: "エリア・場所管理" },
] as const;

async function expectNotForbidden(page: Page, where: string): Promise<void> {
  await expect(
    page.getByRole("heading", { name: FORBIDDEN_HEADING }),
    `${where}: 403 画面が出ている`,
  ).toHaveCount(0);
}

test.describe("設定配下の画面アクセス（WHOLESALER_ADMIN）", () => {
  test.describe.configure({ timeout: 180_000 });

  // 取引先管理の編集テストは seed の Relationship の備考を書き換えるので、
  // 実行後に必ず元（null）へ戻す。行そのものは既存データなので削除しない。
  test.afterAll(() => {
    execFileSync(
      "pnpm",
      ["exec", "tsx", resolve(__dirname, "fixtures", "cleanup-e2e-settings.ts")],
      {
        cwd: resolve(__dirname, "..", "..", "packages", "db"),
        stdio: "inherit",
        shell: process.platform === "win32",
      },
    );
  });

  for (const p of SETTINGS_PAGES) {
    test(`直接アクセス: ${p.menu} (${p.href}) が 403 にならない`, async ({ page }) => {
      await signIn(page, "wholesaler_admin@solar-saas.dev");
      await page.goto(p.href, { timeout: 120_000 });

      await expectNotForbidden(page, p.menu);
      await expect(page.getByRole("heading", { name: p.heading, level: 1 })).toBeVisible({
        timeout: 60_000,
      });
    });
  }

  test("サイドメニュー「設定」から各画面へクリック遷移できる", async ({ page }) => {
    await signIn(page, "wholesaler_admin@solar-saas.dev");

    for (const p of SETTINGS_PAGES) {
      // 設定配下のページから始めるとアコーディオンが開いた状態で描画される
      // （開閉アニメーション中のクリックで unstable になるのを避ける）。
      await page.goto("/masters", { timeout: 120_000 });
      await page.waitForLoadState("networkidle", { timeout: 90_000 });

      const link = page.getByRole("link", { name: p.menu }).first();
      await expect(link, `サイドバーに「${p.menu}」が無い`).toBeVisible({ timeout: 30_000 });
      await link.click();

      await page.waitForURL((url) => url.pathname.startsWith(p.href), { timeout: 60_000 });
      await expectNotForbidden(page, p.menu);
      await expect(page.getByRole("heading", { name: p.heading, level: 1 })).toBeVisible({
        timeout: 60_000,
      });
    }
  });

  test("取引先管理: 既存行をインライン編集して保存できる（masters.update）", async ({ page }) => {
    await signIn(page, "wholesaler_admin@solar-saas.dev");
    await page.goto("/masters/relationships", { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "取引先一覧", level: 1 })).toBeVisible({
      timeout: 60_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });

    // 行は常時インライン編集で、備考は blur 時に自動保存される（編集ボタンは無い）。
    // masters.update が未定義だとここで fail-closed の 403 になる。
    // 再読込後に同じ行を特定できるよう、対象行の取引先名を控えておく
    // （行順は tbody の先頭とは限らないため .first() で読み直さない）。
    const row = page.getByRole("table").locator("tbody tr").first();
    const dealerName = (await row.locator("td").first().innerText()).trim();
    const note = row.getByLabel("備考");
    await expect(note).toBeVisible({ timeout: 30_000 });
    const value = `E2E権限確認${Date.now()}`;
    await note.fill(value);

    await note.blur();

    // Server Action が失敗しても HTTP は 200 で返るため、ステータスでは判定できない。
    // 成功トーストが出ること（= 権限が通ったこと）で判定する。
    await expect(page.getByText("保存しました")).toBeVisible({ timeout: 60_000 });
    // 権限エラーのトーストが出ていないこと。
    await expect(page.getByText("権限がありません")).toHaveCount(0);
    await expect(page.getByText("未定義のアクションです")).toHaveCount(0);

    // 403 画面にもならず、再読込しても値が残る（= DB に永続化されている）。
    await expectNotForbidden(page, "取引先管理の保存");
    await page.reload({ timeout: 120_000 });
    const savedRow = page.getByRole("table").locator("tbody tr").filter({ hasText: dealerName });
    await expect(savedRow.getByLabel("備考")).toHaveValue(value, { timeout: 60_000 });
  });

  test("サイドバーに開けないリンクを出さない（監査ログの整合）", async ({ page }) => {
    await signIn(page, "wholesaler_admin@solar-saas.dev");
    await page.goto("/masters", { timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });

    // 監査ログがサイドバーに出ているなら、開いて 403 にならないこと。
    const auditLink = page.getByRole("link", { name: "監査ログ" });
    if ((await auditLink.count()) > 0) {
      await auditLink.first().click();
      await page.waitForURL(/\/audit-logs/, { timeout: 60_000 });
      await expectNotForbidden(page, "監査ログ");
    }
  });
});
