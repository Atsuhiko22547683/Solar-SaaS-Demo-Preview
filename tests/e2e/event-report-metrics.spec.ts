import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// 成果報告の「追加集計項目」(EventReportMetric) の画面操作。
//
// 追加 / 名称編集 / 値編集 / 削除 が動き、いずれも再読込後の状態に反映されること。
// 固定集計項目（声かけ数 / アンケート数 / アポ数 / コメント）は別セクションのままで、
// このセクションからは触らない（「カインズPay対応数」は固定項目ではなく追加行）。
//
// イベントと成果報告は fixture で用意し、afterAll で必ず削除する。

const DEMO_EMAIL = "demo@solar-saas.demo";
const DEMO_PASSWORD = "Demo1234!";

const RUN_ID = Date.now();
const FIXTURE_DIR = resolve(__dirname, "fixtures");
const DB_DIR = resolve(__dirname, "..", "..", "packages", "db");

const METRIC_NAME = "カインズPay対応数";
const RENAMED_METRIC = "カインズPay決済数";

let eventId = "";

async function signInAsDemo(page: Page): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(DEMO_EMAIL);
  await page.getByLabel("パスワード").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "サインイン" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 120_000 });
}

async function openEvent(page: Page): Promise<void> {
  await page.goto(`/events/${eventId}`, { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "追加集計項目" })).toBeVisible({
    timeout: 90_000,
  });
  // React が onChange / onClick を張る前に操作すると保存が発火しないので待つ。
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
}

/** 追加集計項目セクション。固定集計項目のフォームと取り違えないよう領域で絞る。 */
function metricsSection(page: Page) {
  return page.getByRole("region", { name: "追加集計項目" });
}

test.describe.serial("成果報告の追加集計項目", () => {
  test.describe.configure({ timeout: 240_000 });

  test.beforeAll(() => {
    const out = execFileSync(
      "pnpm",
      ["exec", "tsx", resolve(FIXTURE_DIR, "setup-e2e-report-metric.ts"), String(RUN_ID)],
      { cwd: DB_DIR, encoding: "utf8", shell: process.platform === "win32" },
    )
      .trim()
      .split(/\r?\n/);
    eventId = (JSON.parse(out[out.length - 1]!) as { eventId: string }).eventId;
  });

  test.afterAll(() => {
    execFileSync(
      "pnpm",
      ["exec", "tsx", resolve(FIXTURE_DIR, "cleanup-e2e-report-metric.ts"), String(RUN_ID)],
      { cwd: DB_DIR, stdio: "inherit", shell: process.platform === "win32" },
    );
  });

  test("シナリオ1: 項目を追加でき、再読込後も残る", async ({ page }) => {
    await signInAsDemo(page);
    await openEvent(page);

    const section = metricsSection(page);
    await expect(section.getByText("追加集計項目は登録されていません")).toBeVisible({
      timeout: 30_000,
    });

    await section.locator("#metric-new-name").fill(METRIC_NAME);
    await section.locator("#metric-new-value").fill("12");

    const saved = page.waitForResponse(
      (res) => res.request().method() === "POST" && res.status() < 400,
      { timeout: 90_000 },
    );
    await section.getByRole("button", { name: "項目を追加" }).click();
    await saved;

    await openEvent(page);
    await expect(metricsSection(page).getByText(METRIC_NAME)).toBeVisible({ timeout: 30_000 });
    await expect(metricsSection(page).getByText("12", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("シナリオ2: 同じ項目名は追加できない", async ({ page }) => {
    await signInAsDemo(page);
    await openEvent(page);

    const section = metricsSection(page);
    await section.locator("#metric-new-name").fill(METRIC_NAME);
    await section.locator("#metric-new-value").fill("3");
    await section.getByRole("button", { name: "項目を追加" }).click();

    await expect(page.getByText("同じ項目名がすでに登録されています")).toBeVisible({
      timeout: 30_000,
    });

    // 追加されていない（行は 1 件のまま）。
    await openEvent(page);
    await expect(metricsSection(page).getByText(METRIC_NAME)).toHaveCount(1);
  });

  test("シナリオ3: 名称と値を編集でき、再読込後も残る", async ({ page }) => {
    await signInAsDemo(page);
    await openEvent(page);

    await metricsSection(page)
      .getByRole("button", { name: `${METRIC_NAME} を編集` })
      .click();

    // 編集中は「追加フォーム」と「編集行」の両方に 項目名 / 数値 があるので、
    // 保存ボタンを持つ編集行の <li> に絞ってから入力する。
    const editRow = metricsSection(page)
      .getByRole("listitem")
      .filter({ has: page.getByRole("button", { name: "保存", exact: true }) });
    await editRow.getByLabel("項目名").fill(RENAMED_METRIC);
    await editRow.getByLabel("数値").fill("34");

    const saved = page.waitForResponse(
      (res) => res.request().method() === "POST" && res.status() < 400,
      { timeout: 90_000 },
    );
    await editRow.getByRole("button", { name: "保存", exact: true }).click();
    await saved;

    await openEvent(page);
    await expect(metricsSection(page).getByText(RENAMED_METRIC)).toBeVisible({ timeout: 30_000 });
    await expect(metricsSection(page).getByText("34", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(metricsSection(page).getByText(METRIC_NAME, { exact: true })).toHaveCount(0);
  });

  test("シナリオ4: 削除でき、再読込後も消えている", async ({ page }) => {
    await signInAsDemo(page);
    await openEvent(page);

    // 削除は window.confirm で確認する。
    page.once("dialog", (dialog) => void dialog.accept());

    const saved = page.waitForResponse(
      (res) => res.request().method() === "POST" && res.status() < 400,
      { timeout: 90_000 },
    );
    await metricsSection(page)
      .getByRole("button", { name: `${RENAMED_METRIC} を削除` })
      .click();
    await saved;

    await openEvent(page);
    await expect(metricsSection(page).getByText(RENAMED_METRIC)).toHaveCount(0);
    await expect(metricsSection(page).getByText("追加集計項目は登録されていません")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("シナリオ5: 固定集計項目は追加集計項目セクションの外に残っている", async ({ page }) => {
    await signInAsDemo(page);
    await openEvent(page);

    // 成果報告は提出済みなので固定項目のフォームは「提出済み」表示になる。
    // 追加集計項目セクションが固定項目を飲み込んでいないことだけ確認する。
    const section = metricsSection(page);
    await expect(section.getByLabel("声かけ数")).toHaveCount(0);
    await expect(section.getByLabel("アンケート数")).toHaveCount(0);
    await expect(section.getByLabel("アポ取得数")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "成果報告" })).toBeVisible({ timeout: 20_000 });
  });
});
