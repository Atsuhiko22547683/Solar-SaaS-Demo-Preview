import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// スタッフマスタ（Salesperson）の集合一致テスト。
//
//   A. /salespeople の自社スタッフ集合 = 顧客担当者候補 = イベントアサイン候補
//   B. スタッフを 1 名追加すると 3 箇所すべてに出る
//   C. 論理削除すると 3 箇所すべての新規候補から消える（DB 行は残る）
//   D. システムユーザー（User）を足しても 3 箇所には出ない
//
// システムユーザー（User）は人物マスタではないので、どの候補にも混ざらない。

const DEMO_EMAIL = "demo@solar-saas.demo";
const DEMO_PASSWORD = "Demo1234!";

const RUN_ID = Date.now();
const STAFF_NAME = `E2E集合スタッフ${RUN_ID}`;
const USER_NAME = `E2E集合ユーザー${RUN_ID}`;
const USER_EMAIL = `e2e-set-${RUN_ID}@solar-saas.dev`;
const FIXTURE_DIR = resolve(__dirname, "fixtures");
const DB_DIR = resolve(__dirname, "..", "..", "packages", "db");

async function signIn(page: Page): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(DEMO_EMAIL);
  await page.getByLabel("パスワード").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "サインイン" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
}

/** /salespeople（自社タブ）に出ているスタッフ氏名の集合。 */
async function staffListNames(page: Page): Promise<string[]> {
  await page.goto("/salespeople", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "スタッフ一覧" })).toBeVisible({
    timeout: 90_000,
  });
  const links = page.getByRole("table").locator("tbody tr td:first-child a");
  return (await links.allInnerTexts()).map((s) => s.trim()).filter(Boolean);
}

/** 顧客詳細 → 担当者変更ダイアログ「自社社員」の候補氏名の集合。 */
async function customerStaffOptionNames(page: Page): Promise<string[]> {
  await page.goto("/customers", { timeout: 120_000 });
  await page.getByRole("table").locator("tbody tr").first().click();
  await page.waitForURL(/\/customers\/[^/]+$/, { timeout: 90_000 });
  await page.getByRole("button", { name: "変更" }).first().click();

  await page.locator("#edit-tossup-kind").selectOption("user");
  const options = page.locator("#edit-tossup-select option");
  const texts = await options.allInnerTexts();
  // 先頭の「未設定」と、過去データ用の「（過去データ）」行は候補ではないので除く。
  return texts
    .map((s) => s.trim())
    .filter((s) => s && s !== "未設定" && !s.endsWith("（過去データ）"));
}

/** イベント詳細 → アサイン設定「自社要員を選択」の候補氏名の集合。 */
async function eventStaffOptionNames(page: Page): Promise<string[]> {
  await page.goto("/event-detail", { timeout: 120_000 });
  // 「新規登録」リンクも同じ接頭辞なので、表の中の行リンクだけを選ぶ。
  await page.getByRole("table").locator('tbody a[href^="/event-detail/"]').first().click();
  await page.waitForURL((u) => /[0-9a-z]{20,}$/.test(u.pathname), { timeout: 90_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
  await page.getByRole("button", { name: "アサイン設定" }).click();
  const dialog = page.getByRole("dialog");
  // 開催体制を「自社開催」にすると自社要員だけが並ぶ（取引先ブロックは出ない）。
  await dialog.getByRole("button", { name: "自社開催" }).click();
  await expect(dialog.getByText("自社要員を選択")).toBeVisible({ timeout: 90_000 });
  const staffLabels = dialog.locator("label", { has: page.locator('input[type="checkbox"]') });
  return (await staffLabels.allInnerTexts()).map((v) => v.trim()).filter(Boolean);
}

test.describe.serial("スタッフマスタの集合一致", () => {
  test.describe.configure({ timeout: 300_000 });

  test.afterAll(() => {
    execFileSync(
      "pnpm",
      ["exec", "tsx", resolve(FIXTURE_DIR, "cleanup-staff-master-consistency.ts"), String(RUN_ID)],
      { cwd: DB_DIR, stdio: "inherit", shell: process.platform === "win32" },
    );
  });

  test("A: スタッフ一覧 / 顧客担当者候補 / イベントアサイン候補が同じ集合", async ({ page }) => {
    await signIn(page);

    const listNames = (await staffListNames(page)).sort();
    const customerNames = (await customerStaffOptionNames(page)).sort();
    const eventNames = (await eventStaffOptionNames(page)).sort();

    expect(listNames.length, "自社スタッフが 1 名以上いる").toBeGreaterThan(0);
    expect(customerNames, "顧客担当者候補 = スタッフ一覧").toEqual(listNames);
    expect(eventNames, "イベントアサイン候補 = スタッフ一覧").toEqual(listNames);
  });

  test("B: スタッフを追加すると 3 箇所すべてに出る", async ({ page }) => {
    await signIn(page);
    await page.goto("/salespeople", { timeout: 120_000 });
    await page.getByRole("link", { name: "スタッフを登録" }).click();
    await page.waitForLoadState("networkidle", { timeout: 90_000 });
    await page.getByLabel("氏名（漢字）").fill(STAFF_NAME);
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.waitForURL(/\/salespeople$/, { timeout: 90_000 });

    expect(await staffListNames(page)).toContain(STAFF_NAME);
    expect(await customerStaffOptionNames(page)).toContain(STAFF_NAME);
    expect(await eventStaffOptionNames(page)).toContain(STAFF_NAME);
  });

  test("C: 論理削除すると 3 箇所すべての新規候補から消える", async ({ page }) => {
    await signIn(page);
    await page.goto(`/salespeople?query=${encodeURIComponent(STAFF_NAME)}`, { timeout: 120_000 });
    const row = page.getByRole("table").locator("tbody tr").filter({ hasText: STAFF_NAME }).first();
    await expect(row).toBeVisible({ timeout: 90_000 });
    await row.click();
    await page.getByRole("button", { name: new RegExp(`${STAFF_NAME} 削除`) }).click();
    await page.getByRole("button", { name: "削除する" }).click();
    // 削除の再描画が終わるまで待つ。行が消えてから 3 画面を見に行く。
    await expect(
      page.getByRole("table").locator("tbody tr").filter({ hasText: STAFF_NAME }),
    ).toHaveCount(0, { timeout: 90_000 });

    expect(await staffListNames(page)).not.toContain(STAFF_NAME);
    expect(await customerStaffOptionNames(page)).not.toContain(STAFF_NAME);
    expect(await eventStaffOptionNames(page)).not.toContain(STAFF_NAME);

    // DB 行は残る（過去の担当実績からの参照が切れないため）。
    const out = execFileSync(
      "pnpm",
      ["exec", "tsx", resolve(FIXTURE_DIR, "probe-staff-master-consistency.ts"), String(RUN_ID)],
      { cwd: DB_DIR, encoding: "utf8", shell: process.platform === "win32" },
    )
      .trim()
      .split(/\r?\n/);
    const probe = JSON.parse(out[out.length - 1]!) as Record<string, unknown>;
    expect(probe.staffExists, "DB 行は残っている").toBe(true);
    expect(probe.staffIsActive, "論理削除は isActive=false").toBe(false);
  });

  test("D: システムユーザーを追加してもスタッフ候補には出ない", async ({ page }) => {
    // Salesperson を作らずに User だけ足す。UI の招待フローに依存せず、
    // 「User が増えてもスタッフ集合は変わらない」ことだけを見る。
    execFileSync(
      "pnpm",
      [
        "exec",
        "tsx",
        resolve(FIXTURE_DIR, "setup-staff-master-consistency.ts"),
        String(RUN_ID),
        USER_NAME,
        USER_EMAIL,
      ],
      { cwd: DB_DIR, stdio: "inherit", shell: process.platform === "win32" },
    );

    await signIn(page);
    await page.goto("/members", { timeout: 120_000 });
    await expect(page.getByRole("table").getByText(USER_NAME)).toBeVisible({ timeout: 90_000 });

    expect(await staffListNames(page), "スタッフ一覧に出ない").not.toContain(USER_NAME);
    expect(await customerStaffOptionNames(page), "顧客担当者候補に出ない").not.toContain(USER_NAME);
    expect(await eventStaffOptionNames(page), "イベント候補に出ない").not.toContain(USER_NAME);
  });
});
