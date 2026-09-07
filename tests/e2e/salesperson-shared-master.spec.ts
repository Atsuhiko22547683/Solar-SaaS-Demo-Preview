import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { openCustomerByName } from "./fixtures/customers";

// 1 人の Salesperson が「スタッフ一覧 / 顧客のトスアップ担当 / 顧客のクロージング担当 /
// イベント配置」の全てで **同じ id** として使われることの検証。
//
//   A. 顧客のトスアップ担当に選ぶと Customer.tossUpSalespersonId = Salesperson.id
//   B. 同じ人物をクロージング担当に選ぶと Customer.closingSalespersonId = Salesperson.id
//      かつ *UserId は書かれない（User をスタッフマスタにしない）
//   C. 同じ人物をイベントへ配置すると EventSalesperson.salespersonId = Salesperson.id
//   D. スタッフ一覧の展開行に トスアップ / クロージング / イベント の各担当件数が出る
//
// setup-e2e-event.ts が作る Salesperson と Event をそのまま使う（人物を別途作らない）。

const DEMO_EMAIL = "demo@solar-saas.demo";
const DEMO_PASSWORD = "Demo1234!";

const RUN_ID = Date.now();
const FIXTURE_DIR = resolve(__dirname, "fixtures");
const DB_DIR = resolve(__dirname, "..", "..", "packages", "db");

interface Fixture {
  eventId: string;
  salespersonId: string;
  salespersonName: string;
}

let fx: Fixture;

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
    ["exec", "tsx", resolve(FIXTURE_DIR, "probe-salesperson-links.ts"), fx.salespersonId],
    { cwd: DB_DIR, encoding: "utf8", shell: process.platform === "win32" },
  )
    .trim()
    .split(/\r?\n/);
  return JSON.parse(out[out.length - 1]!) as Record<string, unknown>;
}

test.describe.serial("Salesperson を共通スタッフマスタとして使う", () => {
  test.describe.configure({ timeout: 300_000 });

  test.beforeAll(() => {
    const out = execFileSync(
      "pnpm",
      ["exec", "tsx", resolve(FIXTURE_DIR, "setup-e2e-event.ts"), String(RUN_ID)],
      { cwd: DB_DIR, encoding: "utf8", shell: process.platform === "win32" },
    )
      .trim()
      .split(/\r?\n/);
    fx = JSON.parse(out[out.length - 1]!) as Fixture;
  });

  test.afterAll(() => {
    execFileSync(
      "pnpm",
      ["exec", "tsx", resolve(FIXTURE_DIR, "cleanup-e2e-event.ts"), String(RUN_ID)],
      {
        cwd: DB_DIR,
        stdio: "inherit",
        shell: process.platform === "win32",
      },
    );
  });

  test("A/B: 顧客のトスアップ / クロージング担当に同じスタッフを選べる", async ({ page }) => {
    await signIn(page);
    await openCustomerByName(page, "山田 香織");

    await page.getByRole("button", { name: "変更" }).first().click();

    // ダイアログは役割ごとに「所属区分 → 担当者」の 2 段。
    // 自社スタッフとして同じ人物を両方の役割に選ぶ。
    for (const prefix of ["edit-tossup", "edit-closing"]) {
      await page.locator(`#${prefix}-kind`).selectOption("user");
      const select = page.locator(`#${prefix}-select`);
      await expect(select).toBeVisible({ timeout: 30_000 });
      await select.selectOption({ label: fx.salespersonName });
    }

    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.waitForLoadState("networkidle", { timeout: 90_000 });

    const p = probe();
    expect(p.tossUpCustomerCount, "トスアップ担当として参照される").toBeGreaterThanOrEqual(1);
    expect(p.closingCustomerCount, "クロージング担当として参照される").toBeGreaterThanOrEqual(1);
    // User をスタッフマスタにしないので *UserId は書かれない。
    expect(p.tossUpUserIdLeak, "tossUpUserId は書かれない").toBe(0);
    expect(p.closingUserIdLeak, "closingUserId は書かれない").toBe(0);
  });

  test("C: 同じスタッフをイベントへ配置できる", async ({ page }) => {
    await signIn(page);
    await page.goto(`/events/${fx.eventId}`, { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "販売員", exact: true })).toBeVisible({
      timeout: 90_000,
    });

    const box = page.getByRole("checkbox", { name: fx.salespersonName });
    if (!(await box.isChecked())) {
      await box.check();
      await page.getByRole("button", { name: "アサインを保存" }).click();
      await page.waitForLoadState("networkidle", { timeout: 90_000 });
    }

    const p = probe();
    expect(p.eventAssignmentCount, "EventSalesperson から参照される").toBe(1);
  });

  test("D: スタッフ一覧に 3 種類の担当実績が出る", async ({ page }) => {
    await signIn(page);
    await page.goto(`/salespeople?query=${encodeURIComponent(fx.salespersonName)}`, {
      timeout: 120_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });

    const row = page
      .getByRole("table")
      .locator("tbody tr")
      .filter({ hasText: fx.salespersonName })
      .first();
    await row.getByRole("button", { name: /詳細を開く$/ }).click();

    for (const label of ["トスアップ担当", "クロージング担当", "イベント担当"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    }
  });
});
