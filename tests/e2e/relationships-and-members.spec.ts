import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// 取引先管理（追加 / 編集 / 論理削除）とシステムユーザー 2 タブの最小検証。
//
//   A. 取引先を追加 → 一覧に出る
//   B. 対応範囲をインライン編集して保存される
//   C. 削除 → 通常一覧から消える。ただし DB の行は残っている（論理削除）
//   D. システムユーザーが 自社 / 取引先 の 2 タブに分かれる
//   E. 自社 User は自社タブ、取引先 User は取引先タブに出る
//   F. 他卸業者配下の取引先 User が漏れない
//
// 作ったデータは afterAll で削除する（この spec が作った Tenant / Relationship のみ）。

const DEMO_EMAIL = "demo@solar-saas.demo";
const DEMO_PASSWORD = "Demo1234!";

const RUN_ID = Date.now();
const DEALER_NAME = `E2E取引先${RUN_ID}`;
const FIXTURE_DIR = resolve(__dirname, "fixtures");
const DB_DIR = resolve(__dirname, "..", "..", "packages", "db");

async function signIn(page: Page): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(DEMO_EMAIL);
  await page.getByLabel("パスワード").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "サインイン" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
}

/** cleanup スクリプトを呼び、標準出力の最終行（JSON）を返す。 */
function runFixture(script: string): Record<string, unknown> {
  const out = execFileSync("pnpm", ["exec", "tsx", resolve(FIXTURE_DIR, script), String(RUN_ID)], {
    cwd: DB_DIR,
    encoding: "utf8",
    shell: process.platform === "win32",
  })
    .trim()
    .split(/\r?\n/);
  return JSON.parse(out[out.length - 1]!) as Record<string, unknown>;
}

test.describe.serial("取引先管理 / システムユーザー", () => {
  test.describe.configure({ timeout: 240_000 });

  test.afterAll(() => {
    execFileSync(
      "pnpm",
      ["exec", "tsx", resolve(FIXTURE_DIR, "cleanup-e2e-relationship.ts"), String(RUN_ID)],
      { cwd: DB_DIR, stdio: "inherit", shell: process.platform === "win32" },
    );
  });

  test("A: 取引先を追加すると一覧に出る", async ({ page }) => {
    await signIn(page);
    await page.goto("/masters/relationships", { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "取引先一覧" })).toBeVisible({
      timeout: 90_000,
    });

    await page.getByRole("button", { name: "取引先を追加" }).click();
    await page.getByLabel("取引先名").fill(DEALER_NAME);
    await page.getByRole("button", { name: "追加", exact: true }).click();

    await expect(page.getByRole("table").getByText(DEALER_NAME)).toBeVisible({ timeout: 90_000 });
  });

  test("B: 対応範囲をインライン編集できる", async ({ page }) => {
    await signIn(page);
    await page.goto("/masters/relationships", { timeout: 120_000 });
    const row = page.getByRole("table").locator("tbody tr").filter({ hasText: DEALER_NAME });
    await expect(row).toHaveCount(1, { timeout: 90_000 });

    await row.getByLabel("対応範囲").selectOption("APPOINTMENT_ONLY");
    await page.waitForLoadState("networkidle", { timeout: 90_000 });

    await page.reload();
    const reloaded = page.getByRole("table").locator("tbody tr").filter({ hasText: DEALER_NAME });
    await expect(reloaded.getByLabel("対応範囲")).toHaveValue("APPOINTMENT_ONLY", {
      timeout: 90_000,
    });
  });

  test("C: 削除すると一覧から消えるが、DB のレコードは残る（論理削除）", async ({ page }) => {
    await signIn(page);
    await page.goto("/masters/relationships", { timeout: 120_000 });
    const row = page.getByRole("table").locator("tbody tr").filter({ hasText: DEALER_NAME });
    await expect(row).toHaveCount(1, { timeout: 90_000 });

    await row.getByRole("button", { name: /削除$/ }).click();
    await page.getByRole("button", { name: "削除する" }).click();

    await expect(
      page.getByRole("table").locator("tbody tr").filter({ hasText: DEALER_NAME }),
    ).toHaveCount(0, { timeout: 90_000 });

    // 物理削除されていないこと（行が残り、status が TERMINATED）。
    const probe = runFixture("probe-e2e-relationship.ts");
    expect(probe.exists, "Relationship の行が残っている").toBe(true);
    expect(probe.status, "論理削除は status=TERMINATED で表現される").toBe("TERMINATED");
  });

  test("D/E: システムユーザーが自社 / 取引先の 2 タブに分かれる", async ({ page }) => {
    await signIn(page);
    await page.goto("/members", { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "システムユーザー" })).toBeVisible({
      timeout: 90_000,
    });

    // 所属タブはスタッフ一覧と同じ共通部品（role="tablist" / role="tab"）。
    const nav = page.getByRole("tablist", { name: "システムユーザーの所属" });
    await expect(nav.getByRole("tab", { name: "自社" })).toBeVisible();
    await expect(nav.getByRole("tab", { name: "取引先" })).toBeVisible();

    // 自社タブ: 自テナントのデモユーザーが出る。
    await expect(page.getByRole("table").getByText(DEMO_EMAIL)).toBeVisible({ timeout: 90_000 });

    // 取引先タブへ。
    await nav.getByRole("tab", { name: "取引先" }).click();
    await page.waitForURL(/tab=dealer/, { timeout: 90_000 });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });

    // 取引先タブに自社ユーザーは出ない。
    await expect(page.getByText(DEMO_EMAIL)).toHaveCount(0);
  });

  test("F: 他卸業者配下の取引先ユーザーが漏れない", async ({ page }) => {
    await signIn(page);
    await page.goto("/members?tab=dealer", { timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });

    // 表示されている全ユーザーが、自卸業者と繋がっている取引先の所属であること。
    const allowed = runFixture("probe-e2e-relationship.ts");
    const allowedNames = (allowed.dealerNames as string[]) ?? [];

    const rows = page.getByRole("table").locator("tbody tr");
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).innerText();
      const matched = allowedNames.some((n) => text.includes(n));
      expect(matched, `行 ${i} の所属取引先が自卸業者の取引先である: ${text}`).toBe(true);
    }
  });
});
