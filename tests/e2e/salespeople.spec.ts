import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// スタッフ一覧（設定配下のマスタ画面）の検証。
//
// スタッフは認証 User とは別概念で、ログインしない催事販売員も含めて管理する。
// 所属は Salesperson.relationshipId の有無で決まり、加盟店名は Relationship /
// 自テナントから導出する（文字列を複製しない）。
//
// PII（生年月日 / 電話 / メール / 現住所）を持つため、一覧ではマスキングし、
// 住所全文は通常行に出さない。
//
// このスペックは画面操作で実データを作るため、afterAll で必ず削除する
// （実行のたびにマスタが増えないようにする）。

const DEMO_EMAIL = "demo@solar-saas.demo";
const DEMO_PASSWORD = "Demo1234!";

const RUN_ID = Date.now();
/** この実行が登録するスタッフの氏名。RUN_ID を含むので実行ごとに一意。 */
const SP_NAME = `E2E販売員${RUN_ID}`;
/** 取引先スタッフタブ用に登録するスタッフ。 */
const DEALER_SP_NAME = `E2E二次店スタッフ${RUN_ID}`;

async function signInAsDemo(page: Page): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(DEMO_EMAIL);
  await page.getByLabel("パスワード").fill(DEMO_PASSWORD);
  const submit = page.getByRole("button", { name: "サインイン" });
  await expect(submit).toBeVisible();
  await submit.click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 120_000 });
}

async function openList(page: Page): Promise<void> {
  await page.goto("/salespeople", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "スタッフ一覧" })).toBeVisible({
    timeout: 90_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
}

test.describe.serial("スタッフ一覧（設定配下のマスタ）", () => {
  test.describe.configure({ timeout: 240_000 });

  test.afterAll(() => {
    const script = resolve(__dirname, "fixtures", "cleanup-e2e-salesperson.ts");
    const dbDir = resolve(__dirname, "..", "..", "packages", "db");
    execFileSync("pnpm", ["exec", "tsx", script, String(RUN_ID)], {
      cwd: dbDir,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
  });

  // サイドバーはアコーディオンで開閉アニメーションするため、1 テストで開く
  // グループは 1 つだけにする（複数を続けて開閉するとリンクが動いて click が
  // "element is not stable" で落ちる）。

  test("シナリオ1a: イベント管理配下から販売員一覧が消えている", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/events", { timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });

    await page.getByRole("button", { name: "イベント管理" }).first().click();
    // 展開後に他のイベント系リンクは出るが、販売員一覧は無い。
    await expect(page.getByRole("link", { name: "単発イベント一覧" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("link", { name: "販売員一覧" })).toHaveCount(0);
  });

  // 設定グループは「現在のルートが配下にあると初期状態で開く」実装なので、
  // 設定配下のページ（/masters）から始めると開閉アニメーションを挟まずに済む。
  test("シナリオ1b: サイドメニュー「設定 > スタッフ一覧」から開ける", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/masters", { timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });

    const staffLink = page.getByRole("link", { name: "スタッフ一覧" }).first();
    await expect(staffLink).toBeVisible({ timeout: 30_000 });
    await staffLink.click();

    await page.waitForURL(/\/salespeople/, { timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "スタッフ一覧" })).toBeVisible();
  });

  test("シナリオ1c: 設定配下に取引先管理・システムユーザー・エリア・場所管理がある", async ({
    page,
  }) => {
    await signInAsDemo(page);
    await page.goto("/masters", { timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });

    for (const item of ["取引先管理", "システムユーザー", "エリア・場所管理"]) {
      await expect(page.getByRole("link", { name: item })).toBeVisible({ timeout: 30_000 });
    }
    // 旧名称は消えている。
    await expect(page.getByRole("link", { name: "マスタ管理" })).toHaveCount(0);
  });

  test("シナリオ2: 所属タブ（自社 / 取引先）と共通の検索パネル・並び替えが載っている", async ({
    page,
  }) => {
    await signInAsDemo(page);
    await openList(page);

    // 所属タブ。既定は自社スタッフ。
    const tabs = page.getByRole("tablist", { name: "スタッフ一覧" });
    await expect(tabs.getByRole("tab", { name: "自社スタッフ" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(tabs.getByRole("tab", { name: "取引先スタッフ" })).toBeVisible();

    const toggle = page.getByRole("button", { name: /^検索条件/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    for (const field of ["氏名・カナで検索", "雇用形態"]) {
      await expect(page.getByLabel(field, { exact: true })).toBeVisible();
    }
    // 加盟店番号での検索は廃止（所属は会社の参照で表現する）。
    await expect(page.getByLabel("加盟店番号で検索")).toHaveCount(0);

    // 並び替えは検索パネルの外（表示件数の右）。
    await expect(page.getByLabel("並び替え")).toBeVisible();
    await expect(page.getByLabel("並び順")).toBeVisible();
  });

  test("シナリオ3: 自社スタッフを登録できる（住民票住所・営業経験は無い / 生年月日は任意）", async ({
    page,
  }) => {
    await signInAsDemo(page);
    await openList(page);

    await page.getByRole("link", { name: "スタッフを登録" }).click();
    await expect(page.getByRole("heading", { name: "スタッフを登録" })).toBeVisible({
      timeout: 90_000,
    });

    // 削除された項目はフォームに存在しない。
    await expect(page.getByLabel("住民票住所")).toHaveCount(0);
    await expect(page.getByLabel("営業経験歴")).toHaveCount(0);
    // 加盟店番号の自由入力も無い（所属取引先の選択に置き換わっている）。
    await expect(page.getByLabel("加盟店番号")).toHaveCount(0);

    await page.getByLabel("氏名（漢字）").fill(SP_NAME);
    await page.getByLabel("氏名（カナ）").fill("イーツーイーハンバイイン");
    await page.getByLabel("性別").selectOption("MALE");
    await page.getByLabel("雇用形態").selectOption("EMPLOYEE");
    await page.getByLabel("電話番号").fill("09012345678");
    await page.getByLabel("メールアドレス").fill(`e2e${RUN_ID}@example.com`);
    await page.getByLabel("現住所").fill("東京都新宿区西新宿1-1-1");
    // 生年月日は任意なので未入力のまま登録する。

    await page.getByRole("button", { name: "保存" }).click();
    await page.waitForURL(/\/salespeople$/, { timeout: 90_000 });

    // 自社タブに出る（氏名はマスキング設定に依存するのでメールで確認する）。
    await expect(page.getByText(`e2e${RUN_ID}@example.com`)).toBeVisible({ timeout: 90_000 });
  });

  test("シナリオ4: 一覧では住所全文を出さず、展開すると補足項目と「未登録」が見える", async ({
    page,
  }) => {
    await signInAsDemo(page);
    await openList(page);

    const table = page.getByRole("table");
    // 自社スタッフタブの通常行の列は 氏名 / カナ / 雇用形態 / 電話 / メール。
    for (const col of ["氏名", "カナ", "雇用形態", "電話番号", "メールアドレス"]) {
      await expect(table.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
    }
    // 「加盟店名」は自社タブでは全行が自テナント名になり、横幅を使うだけで
    // 何も区別しないため列ごと出さない（取引先タブでのみ表示する。シナリオ 8 で検証）。
    // 「システム利用」はシステムユーザー側の概念なのでスタッフ一覧には出さない。
    for (const col of ["加盟店名", "システム利用", "現住所", "生年月日", "性別", "加盟店番号"]) {
      await expect(
        table.getByRole("columnheader", { name: col, exact: true }),
        `列「${col}」は自社スタッフタブの通常行に無い`,
      ).toHaveCount(0);
    }
    // 住所全文は通常状態のテーブルに出ない。
    await expect(table.getByText("東京都新宿区西新宿1-1-1")).toHaveCount(0);

    // 展開すると補足項目が出る。生年月日は未入力なので「未登録」。
    const row = table
      .locator("tbody tr")
      .filter({ hasText: `e2e${RUN_ID}@example.com` })
      .first();
    await row.getByRole("button", { name: /詳細を開く$/ }).click();
    for (const label of ["性別", "現住所"]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText("未登録").first()).toBeVisible();
  });

  test("シナリオ5: 検索できる（氏名・雇用形態）", async ({ page }) => {
    await signInAsDemo(page);
    await openList(page);
    const before = await page.getByRole("table").locator("tbody tr").count();

    await page.getByRole("button", { name: /^検索条件/ }).click();
    await page.getByLabel("氏名・カナで検索").fill(SP_NAME);
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await page.waitForURL(/query=/, { timeout: 90_000 });

    const rows = page.getByRole("table").locator("tbody tr");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(`e2e${RUN_ID}@example.com`);
    expect(before).toBeGreaterThanOrEqual(1);

    // 該当しない雇用形態で 0 件になる（絞り込みが効いている証拠）。
    await page.getByLabel("雇用形態").selectOption("SUBCONTRACT");
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await page.waitForURL(/employmentType=SUBCONTRACT/, { timeout: 90_000 });
    await expect(page.getByText("該当するスタッフがいません")).toBeVisible();
  });

  test("シナリオ6: 編集して保存でき、再読込後も残る", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto(`/salespeople?query=${encodeURIComponent(SP_NAME)}`, { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "スタッフ一覧" })).toBeVisible({
      timeout: 90_000,
    });

    await page.getByRole("table").locator("tbody tr").first().getByRole("link").first().click();
    await expect(page.getByRole("heading", { name: "スタッフを編集" })).toBeVisible({
      timeout: 90_000,
    });

    // 編集フォームは生値（マスク前）を表示する。
    await expect(page.getByLabel("現住所")).toHaveValue("東京都新宿区西新宿1-1-1");

    await page.getByLabel("雇用形態").selectOption("CONTRACT");
    await page.getByRole("button", { name: "保存" }).click();
    await page.waitForURL(/\/salespeople$/, { timeout: 90_000 });

    // 再読込しても残っている（= DB へ永続化されている）。
    await page.goto(`/salespeople?query=${encodeURIComponent(SP_NAME)}`, { timeout: 120_000 });
    await expect(page.getByRole("table").locator("tbody tr").first()).toContainText("契約社員");
  });

  test("シナリオ7: 取引先スタッフを所属会社付きで登録でき、取引先タブに出る", async ({ page }) => {
    await signInAsDemo(page);
    await openList(page);

    await page.getByRole("link", { name: "スタッフを登録" }).click();
    await expect(page.getByRole("heading", { name: "スタッフを登録" })).toBeVisible({
      timeout: 90_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });

    await page.getByLabel("氏名（漢字）").fill(DEALER_SP_NAME);

    // 所属取引先を選ぶと取引先スタッフになる。選択肢は Relationship 由来の会社名。
    const relationshipSelect = page.getByLabel("所属取引先");
    const options = await relationshipSelect.locator("option").all();
    const dealerValue = await options[1]?.getAttribute("value");
    if (!dealerValue) throw new Error("取引先の選択肢がありません — seed データを確認してください");
    const dealerName = (await options[1]!.textContent())?.trim() ?? "";
    await relationshipSelect.selectOption(dealerValue);

    // 取引先スタッフにはログインユーザーを紐付けられないので、欄自体を出さない。
    await expect(page.getByLabel("ログインユーザー")).toHaveCount(0);

    await page.getByRole("button", { name: "保存" }).click();
    await page.waitForURL(/\/salespeople$/, { timeout: 90_000 });

    // 自社タブには出ない。
    await expect(page.getByRole("table").getByText(DEALER_SP_NAME)).toHaveCount(0);

    // 取引先タブに、導出された加盟店名つきで出る。
    await page.getByRole("tab", { name: "取引先スタッフ" }).click();
    await page.waitForURL(/tab=dealer/, { timeout: 90_000 });
    const row = page.getByRole("table").locator("tbody tr").filter({ hasText: DEALER_SP_NAME });
    await expect(row).toHaveCount(1);
    await expect(row.first()).toContainText(dealerName);
  });

  test("シナリオ8: 「加盟店名」列は取引先タブにだけ出る", async ({ page }) => {
    await signInAsDemo(page);
    await openList(page);

    const header = (name: string) =>
      page.getByRole("table").getByRole("columnheader", { name, exact: true });

    // 自社タブ: 全行が自テナント名になるので列ごと出さない。
    await expect(page.getByRole("tab", { name: "自社スタッフ" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(header("加盟店名"), "自社タブに加盟店名列は無い").toHaveCount(0);

    // 取引先タブ: 所属会社の識別に必要なので出す。
    await page.getByRole("tab", { name: "取引先スタッフ" }).click();
    await page.waitForURL(/tab=dealer/, { timeout: 90_000 });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });
    await expect(header("加盟店名"), "取引先タブには加盟店名列がある").toBeVisible({
      timeout: 30_000,
    });
  });
});
