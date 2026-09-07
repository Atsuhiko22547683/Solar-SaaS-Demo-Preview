import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// イベントへの販売員アサインの検証（アサイン → 保存 → リロードで保持 →
// 解除 → リロードで解除が保持）。
//
// 本番シードには Event が 1 件も無いので、このスペックは自前でフィクスチャを
// 作る（setup-e2e-event.ts）。シード側は拡張しない — 全 E2E と手動確認が
// 共有する土台なので、1 スペックのために件数前提を動かさない。
// 作ったデータは afterAll で必ず削除する。

const DEMO_EMAIL = "demo@solar-saas.demo";
const DEMO_PASSWORD = "Demo1234!";

const RUN_ID = Date.now();
const FIXTURE_DIR = resolve(__dirname, "fixtures");
const DB_DIR = resolve(__dirname, "..", "..", "packages", "db");

interface EventFixture {
  eventId: string;
  salespersonId: string;
  salespersonName: string;
}

function runFixtureScript(script: string): string {
  return execFileSync("pnpm", ["exec", "tsx", resolve(FIXTURE_DIR, script), String(RUN_ID)], {
    cwd: DB_DIR,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
}

let fixture: EventFixture;

async function signInAsDemo(page: Page): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(DEMO_EMAIL);
  await page.getByLabel("パスワード").fill(DEMO_PASSWORD);
  const submit = page.getByRole("button", { name: "サインイン" });
  await expect(submit).toBeVisible();
  await submit.click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 120_000 });
}

async function openEvent(page: Page): Promise<void> {
  await page.goto(`/events/${fixture.eventId}`, { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "販売員", exact: true })).toBeVisible({
    timeout: 90_000,
  });
  // React が checkbox の onChange を張る前に操作すると保存が発火しないので待つ。
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
}

/** このスペックが作った販売員のチェックボックス。氏名ラベルで引く。 */
function assignCheckbox(page: Page) {
  return page.getByRole("checkbox", { name: fixture.salespersonName });
}

test.describe.serial("イベントへの販売員アサイン", () => {
  test.describe.configure({ timeout: 240_000 });

  test.beforeAll(() => {
    // setup スクリプトの標準出力の最終行が JSON（ログ行と混ざらないようにしている）。
    const out = runFixtureScript("setup-e2e-event.ts").trim().split(/\r?\n/);
    fixture = JSON.parse(out[out.length - 1]!) as EventFixture;
  });

  test.afterAll(() => {
    execFileSync(
      "pnpm",
      ["exec", "tsx", resolve(FIXTURE_DIR, "cleanup-e2e-event.ts"), String(RUN_ID)],
      { cwd: DB_DIR, stdio: "inherit", shell: process.platform === "win32" },
    );
  });

  test("シナリオ1: 販売員をアサインして保存し、リロード後も保持される", async ({ page }) => {
    await signInAsDemo(page);
    await openEvent(page);

    const checkbox = assignCheckbox(page);
    await expect(checkbox).toBeVisible({ timeout: 90_000 });
    await expect(checkbox).not.toBeChecked();

    // 未変更のうちは保存ボタンが押せない（dirty 追跡）。
    const save = page.getByRole("button", { name: "アサインを保存" });
    await expect(save).toBeDisabled();

    await checkbox.check();
    await expect(save).toBeEnabled();

    // Server Action の POST 完了を待つ（トーストは自動で消えるので当てにしない）。
    const saved = page.waitForResponse(
      (res) => res.request().method() === "POST" && res.status() < 400,
      { timeout: 90_000 },
    );
    await save.click();
    await saved;

    await openEvent(page);
    await expect(assignCheckbox(page)).toBeChecked();
  });

  test("シナリオ2: アサインを解除して保存し、リロード後も解除が保持される", async ({ page }) => {
    await signInAsDemo(page);
    await openEvent(page);

    const checkbox = assignCheckbox(page);
    await expect(checkbox).toBeChecked({ timeout: 90_000 });

    await checkbox.uncheck();

    const save = page.getByRole("button", { name: "アサインを保存" });
    await expect(save).toBeEnabled();
    const saved = page.waitForResponse(
      (res) => res.request().method() === "POST" && res.status() < 400,
      { timeout: 90_000 },
    );
    await save.click();
    await saved;

    await openEvent(page);
    await expect(assignCheckbox(page)).not.toBeChecked();
  });
});
