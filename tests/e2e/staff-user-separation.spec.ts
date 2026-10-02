import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// スタッフ（Salesperson）とシステムユーザー（User）が完全に分離されていることの検証。
//
//   A. スタッフ追加 → Salesperson +1 / User +0
//   B. スタッフ編集 → 保存される
//   C. スタッフ削除 → 一覧から消える / DB 行は残る（isActive=false）/ User に影響なし
//   D. スタッフ一覧に User 由来の概念（システム利用・スタッフ情報未登録）が無い
//   E. システムユーザー一覧にスタッフ紐付けの表示が無い
//
// 作ったデータは afterAll で削除する。

const DEMO_EMAIL = "demo@solar-saas.demo";
const DEMO_PASSWORD = "Demo1234!";

const RUN_ID = Date.now();
const STAFF_NAME = `E2E分離スタッフ${RUN_ID}`;
const FIXTURE_DIR = resolve(__dirname, "fixtures");
const DB_DIR = resolve(__dirname, "..", "..", "packages", "db");

async function signIn(page: Page): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(DEMO_EMAIL);
  await page.getByLabel("パスワード").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "サインイン" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
}

function probe(): Record<string, unknown> {
  const out = execFileSync(
    "pnpm",
    ["exec", "tsx", resolve(FIXTURE_DIR, "probe-staff-user-counts.ts"), String(RUN_ID)],
    { cwd: DB_DIR, encoding: "utf8", shell: process.platform === "win32" },
  )
    .trim()
    .split(/\r?\n/);
  return JSON.parse(out[out.length - 1]!) as Record<string, unknown>;
}

test.describe.serial("スタッフとシステムユーザーの分離", () => {
  test.describe.configure({ timeout: 240_000 });

  let before: Record<string, unknown>;

  test.afterAll(() => {
    execFileSync(
      "pnpm",
      ["exec", "tsx", resolve(FIXTURE_DIR, "cleanup-staff-user-separation.ts"), String(RUN_ID)],
      { cwd: DB_DIR, stdio: "inherit", shell: process.platform === "win32" },
    );
  });

  test("A: スタッフ追加で Salesperson +1 / User +0", async ({ page }) => {
    before = probe();

    await signIn(page);
    await page.goto("/salespeople", { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "スタッフ一覧" })).toBeVisible({
      timeout: 90_000,
    });

    await page.getByRole("link", { name: "スタッフを登録" }).click();
    await page.waitForLoadState("networkidle", { timeout: 90_000 });
    await page.getByLabel("氏名（漢字）").fill(STAFF_NAME);
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.waitForURL(/\/salespeople$/, { timeout: 90_000 });

    const after = probe();
    expect(after.salespersonCount, "Salesperson が 1 件増える").toBe(
      (before.salespersonCount as number) + 1,
    );
    expect(after.userCount, "User は増えない").toBe(before.userCount);
    expect(after.staffUserId, "User と自動で紐付かない").toBeNull();
  });

  test("D: スタッフ一覧に User 由来の概念が無い", async ({ page }) => {
    await signIn(page);
    await page.goto("/salespeople", { timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });

    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader", { name: "システム利用" })).toHaveCount(0);
    await expect(page.getByText("スタッフ情報未登録")).toHaveCount(0);
    // 追加したスタッフは出る。
    await expect(table.getByText(STAFF_NAME)).toBeVisible({ timeout: 90_000 });
  });

  test("B/C: 編集して保存でき、削除すると一覧から消えるが DB 行は残る", async ({ page }) => {
    await signIn(page);
    await page.goto(`/salespeople?query=${encodeURIComponent(STAFF_NAME)}`, { timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });

    // 編集（雇用形態を設定）。
    await page.getByRole("link", { name: STAFF_NAME }).click();
    // 一覧側の絞り込みにも「雇用形態」があるため、編集画面へ遷移したことを必ず確認する。
    await page.waitForURL(/\/salespeople\/[^/]+$/, { timeout: 90_000 });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });
    await page.getByLabel("雇用形態").selectOption("CONTRACT");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.waitForURL(/\/salespeople$/, { timeout: 90_000 });

    await page.goto(`/salespeople?query=${encodeURIComponent(STAFF_NAME)}`, { timeout: 120_000 });
    const row = page.getByRole("table").locator("tbody tr").filter({ hasText: STAFF_NAME }).first();
    await expect(row).toContainText("契約社員", { timeout: 90_000 });

    // 削除（論理削除）。行を展開して削除ボタンを押す。
    await row.click();
    await page.getByRole("button", { name: new RegExp(`${STAFF_NAME} 削除`) }).click();
    await page.getByRole("button", { name: "削除する" }).click();
    await page.waitForLoadState("networkidle", { timeout: 90_000 });

    await page.goto(`/salespeople?query=${encodeURIComponent(STAFF_NAME)}`, { timeout: 120_000 });
    await expect(
      page.getByRole("table").locator("tbody tr").filter({ hasText: STAFF_NAME }),
    ).toHaveCount(0, { timeout: 90_000 });

    const after = probe();
    expect(after.staffExists, "DB の行は残っている").toBe(true);
    expect(after.staffIsActive, "論理削除は isActive=false で表現される").toBe(false);
    expect(after.userCount, "User には影響しない").toBe(before.userCount);
  });

  test("E: システムユーザー一覧にスタッフ紐付けの表示が無い", async ({ page }) => {
    await signIn(page);
    await page.goto("/members", { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "システムユーザー" })).toBeVisible({
      timeout: 90_000,
    });

    const table = page.getByRole("table");
    await expect(table.getByRole("columnheader", { name: "紐付くスタッフ" })).toHaveCount(0);
    // 操作はスタッフ一覧と同じく展開バナー側にある（通常行は情報確認に徹する）。
    await expect(table.getByRole("columnheader", { name: "操作" })).toHaveCount(0);
    const firstRow = table.locator("tbody tr").first();
    await expect(firstRow.getByRole("button", { name: /編集|削除/ })).toHaveCount(0);
    await firstRow.click();
    const banner = table.locator("tbody tr").nth(1);
    await expect(banner.getByRole("button", { name: "編集" })).toBeVisible({ timeout: 90_000 });
    await expect(banner.getByRole("button", { name: "削除" })).toBeVisible();
  });
});
