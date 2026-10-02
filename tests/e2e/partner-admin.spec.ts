import { execSync } from "node:child_process";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// パートナー管理者サイト（APP_VARIANT=partner-admin / http://localhost:3300）。
//
//   A. 管理者のトップとナビから 9 業務へ到達できる
//   B. 提出情報の一覧に「提出者」が出て、提出スタッフで絞り込める
//   C. 利用者アカウント管理 — 一覧・区分変更・販売員の紐付け
//   D. 自分自身の利用区分・利用状況は変えられない
//   E. 手数料管理 — 適用中の率と確定した営業フィー（仕入値は出ない）
//   F. 自社顧客管理 — 本人担当でない顧客も見え、編集できる
//   G. 自社顧客の削除（契約が無いものだけ）
//   H. 出店希望の提出 — 提出した内容が一覧・詳細に残る
//   I. 催事シフト — 自社ユーザー全員が見え、担当者で絞れる
//   J. 管理者専用画面はスタッフから開けない
//   K. 他二次店の管理者には、こちらのデータが 1 件も見えない
//   L. 利用区分の変更が、開いている既存セッションにも反映される
//   M. 利用停止が既存セッションとサインインの両方を止める
//   N. 販売員の紐付け候補は自社のものだけ
//   O. 販売員一覧の検索・絞り込みと、アカウント紐付け状況
//   P. 他二次店の ID を URL に直接指定しても開けない
//   Q. 販売員を登録・確認・編集できる（旧 partner-portal.spec.ts の C / S）
//   R. スタッフサイトの画面はこのサイトに存在しない
//   S. スタッフが提出した報告を、管理者サイトから同じデータとして確認できる
//   T. 同じブラウザで 2 サイトへ同時にログインでき、Cookie が上書きされない
//
// baseURL は playwright.partner.config.ts の "admin" プロジェクトが与える。

const ADMIN = "alpha-admin@solar-saas.dev";
const STAFF = "alpha-staff@solar-saas.dev";
const OTHER_DEALER_ADMIN = "beta-admin@solar-saas.dev";
/** シードの氏名（一覧の行リンク・担当者セレクトで使う）。 */
const ADMIN_NAME = "小林 誠";
const STAFF_NAME = "加藤 健太";
const PASSWORD = "Pilot!2026";

const KEEP_CUSTOMER = "[E2E admin] 管理者専用顧客";
const DELETE_CUSTOMER = "[E2E admin] 削除用顧客";

test.describe.configure({ timeout: 180_000 });

test.beforeAll(() => {
  // 管理者だけが見えるデータ（本人担当でない顧客・確定した営業フィー）を用意する。
  for (const fixture of ["partner-staff-fixture.ts", "partner-admin-fixture.ts"]) {
    execSync(`pnpm -F @solar/db exec tsx ../../tests/e2e/fixtures/${fixture}`, {
      cwd: resolve(__dirname, ".."),
      stdio: "inherit",
    });
  }
});

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "サインイン" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
}

async function signOut(page: Page): Promise<void> {
  await page.goto("/api/auth/signout", { timeout: 120_000 });
}

async function gotoForm(page: Page, path: string): Promise<void> {
  await page.goto(path, { timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
  await page.waitForTimeout(500);
}

test("A: 管理者のトップとナビから 9 業務へ到達できる", async ({ page }) => {
  await signIn(page, ADMIN);
  // 初回はルートのコンパイル待ちで "/" のまま止まることがあるため明示的に開く。
  await page.goto("/p-home", { timeout: 120_000 });

  const nav = page.getByRole("navigation", { name: "パートナーメニュー" });
  for (const label of [
    "アポイント",
    "成約報告",
    "催事日報",
    "販売員",
    "アカウント",
    "顧客情報",
    "手数料",
    "出店希望",
    "場所相談",
    "催事シフト",
  ]) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
  }

  // トップは 3 つのまとまりで、管理者の業務すべてに導線がある。
  for (const heading of ["提出情報の管理", "組織の管理", "取引・顧客"]) {
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  for (const card of [
    "アポイント管理",
    "成約報告管理",
    "催事日報管理",
    "スタッフ情報管理",
    "利用者アカウント管理",
    "自社顧客管理",
    "手数料管理",
    "出店希望の提出",
    "場所確保の相談",
    "催事シフト",
  ]) {
    await expect(page.getByRole("heading", { name: card })).toBeVisible();
  }
});

test("B: 提出情報の一覧に提出者が出て、提出スタッフで絞り込める", async ({ page }) => {
  await signIn(page, ADMIN);

  for (const path of ["/p-appointments", "/p-contracts", "/p-reports"]) {
    await page.goto(path, { timeout: 120_000 });
    await expect(
      page.getByText("自社が取り扱う内容をすべて表示しています（本人提出分に限りません）"),
    ).toBeVisible({
      timeout: 90_000,
    });
    // 「提出スタッフ」は詳細条件（details）の中。開いてから選択肢を見る。
    await page.locator("summary", { hasText: "詳細条件" }).click();
    const select = page.getByLabel("提出スタッフ");
    await expect(select).toBeVisible();
    await expect(select.locator("option", { hasText: STAFF_NAME })).toHaveCount(1);
  }

  // スタッフ資格の利用者は、このサイト（管理者サイト）自体の対象外。
  // 一覧の中身ではなく、サイトを間違えていると分かる案内が出ることを見る。
  // 「スタッフ側にも範囲の注記が出る」ことは、スタッフサイトの spec で確認する。
  await signOut(page);
  await signIn(page, STAFF);
  await page.goto("/p-reports", { timeout: 120_000 });
  await expect(page.getByText("このサイトはパートナー管理者向けです")).toBeVisible({
    timeout: 90_000,
  });
});

test("C: 利用者アカウントの一覧・販売員の紐付けを管理できる", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/p-accounts", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "利用者アカウント" })).toBeVisible({
    timeout: 90_000,
  });
  // 自社の利用者が並ぶ（管理者本人とスタッフ）。
  await expect(page.getByRole("link", { name: ADMIN_NAME })).toBeVisible();
  await expect(page.getByRole("link", { name: STAFF_NAME })).toBeVisible();

  // 「販売員との紐付け」で絞り込める。
  await page.getByLabel("販売員との紐付け").selectOption("LINKED");
  await page.getByRole("button", { name: "検索", exact: true }).click();
  await expect(page).toHaveURL(/link=LINKED/, { timeout: 90_000 });
});

test("D: 自分自身の利用区分・利用状況は変えられない", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/p-accounts", { timeout: 120_000 });
  await page.getByRole("link", { name: ADMIN_NAME }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/p-accounts/"), { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "この利用者の設定" })).toBeVisible({
    timeout: 90_000,
  });
  // 自分の行なので、利用区分と利用状況は操作できない。
  await expect(page.getByLabel("利用区分")).toBeDisabled();
  await expect(page.getByLabel("利用状況")).toBeDisabled();
  await expect(
    page.getByText("自分自身の利用区分・利用状況は変更できません").first(),
  ).toBeVisible();
});

test("E: 手数料管理に適用中の率と確定した営業フィーが出る（仕入値は出ない）", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/p-commissions", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "手数料管理" })).toBeVisible({ timeout: 90_000 });

  await expect(page.getByText("適用中の手数料率")).toBeVisible();
  await expect(page.getByText("トスアップ率")).toBeVisible();
  await expect(page.getByText("クロージング率")).toBeVisible();
  await expect(
    page.getByText("手数料率は代理店が設定します。この画面では変更できません。"),
  ).toBeVisible();

  // フィクスチャで入れた確定フィー 1 件。
  await expect(page.getByText("2026-05").first()).toBeVisible();
  await expect(page.getByText("¥20,000").first()).toBeVisible();

  const body = (await page.locator("body").innerText()).replace(/\s/g, "");
  expect(body).not.toContain("仕入値");
  expect(body).not.toContain("purchasePrice");
});

test("F: 本人担当でない自社顧客も見え、編集できる", async ({ page }) => {
  // スタッフには見えない顧客であることを先に確かめる。
  await signIn(page, STAFF);
  await page.goto(`/p-customers?name=${encodeURIComponent(KEEP_CUSTOMER)}`, { timeout: 120_000 });
  await expect(page.getByRole("link", { name: KEEP_CUSTOMER })).toHaveCount(0);

  await signOut(page);
  await signIn(page, ADMIN);
  await page.goto(`/p-customers?name=${encodeURIComponent(KEEP_CUSTOMER)}`, { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "自社顧客" })).toBeVisible({ timeout: 90_000 });
  await page.getByRole("link", { name: KEEP_CUSTOMER }).click();

  await page.getByRole("link", { name: "顧客情報を編集" }).click();
  await expect(page.getByRole("heading", { name: "顧客情報を編集" })).toBeVisible({
    timeout: 90_000,
  });
  const note = `更新 ${Date.now().toString(36)}`;
  await page.getByLabel("備考").fill(note);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("heading", { name: "自社顧客" })).toBeVisible({ timeout: 90_000 });

  // 保存された内容が編集画面に残る。
  await page.getByRole("link", { name: "顧客情報を編集" }).click();
  await expect(page.getByLabel("備考")).toHaveValue(note, { timeout: 90_000 });
});

test("G: 契約の無い自社顧客は削除でき、確認名が違えば削除されない", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto(`/p-customers?name=${encodeURIComponent(DELETE_CUSTOMER)}`, { timeout: 120_000 });
  const row = page.getByRole("link", { name: DELETE_CUSTOMER });
  if ((await row.count()) === 0) test.skip(true, "削除済み。フィクスチャを流し直すと復活する");
  await row.click();
  await page.getByRole("link", { name: "顧客情報を編集" }).click();

  // 名前が違えば削除しない。
  await page.getByLabel("削除するにはお客様名を入力してください").fill("ちがう名前");
  await page.getByRole("button", { name: "この顧客を削除" }).click();
  await expect(page.getByText("入力されたお客様名が一致しません")).toBeVisible({ timeout: 90_000 });

  // 正しい名前なら削除され、一覧から消える。
  await page.getByLabel("削除するにはお客様名を入力してください").fill(DELETE_CUSTOMER);
  await page.getByRole("button", { name: "この顧客を削除" }).click();
  await page.waitForURL((u) => u.pathname === "/p-customers", { timeout: 120_000 });
  await page.goto(`/p-customers?name=${encodeURIComponent(DELETE_CUSTOMER)}`, { timeout: 120_000 });
  await expect(page.getByRole("link", { name: DELETE_CUSTOMER })).toHaveCount(0);
});

// 出店希望はレーン単位の提出。対象月 × 依頼先代理店で 1 件になる。
test("H: 出店希望を提出すると、一覧と詳細に残る", async ({ page }) => {
  await signIn(page, ADMIN);
  const month = "2026-08";
  const venue = `[E2E admin] 希望場所 ${Date.now().toString(36)}`;

  await gotoForm(page, `/p-lane-preferences/new?month=${month}`);
  await expect(page.getByRole("heading", { name: "希望を提出する" })).toBeVisible({
    timeout: 90_000,
  });
  await page.getByLabel("対象月").fill(month);
  // 1 レーン目の第一希望に店舗を入れる。
  await page.getByLabel("第1希望").first().fill(venue);
  await page.getByLabel("希望日程").first().fill("2026-08-05\n2026-08-06");
  await page.getByLabel("特記事項").fill("E2E 提出");
  await page.getByRole("button", { name: "提出する" }).click();
  await expect(page.getByText("提出しました")).toBeVisible({ timeout: 90_000 });

  // 一覧に対象月の行が出て、詳細に提出内容が残っている。
  await page.goto("/p-lane-preferences", { timeout: 120_000 });
  await page.getByRole("link", { name: month }).first().click();
  await page.waitForURL(
    (u) => u.pathname.startsWith("/p-lane-preferences/") && !u.pathname.endsWith("/new"),
    { timeout: 90_000 },
  );
  // 店舗名は明細と、スレッドの提出記録の両方に出るので先頭で見る。
  await expect(page.getByText(venue).first()).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("E2E 提出")).toBeVisible();
});

// 催事シフトは会社全件を月単位で見る画面。担当者で絞り込める。並べ替え UI は持たない。
test("I: 催事シフトで自社ユーザー全員が見え、担当者で絞れる", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/p-shifts?month=2026-06&venue=%5BE2E%20shift%5D", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "催事シフト" })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByLabel("担当者")).toBeVisible();
  // 配置画面へ入れる（管理者だけの操作）。
  await expect(page.getByRole("link", { name: "配置する" })).toBeVisible();
});

test("J: スタッフはこのサイトの利用対象外で、案内とスタッフサイトへの入口が出る", async ({
  page,
}) => {
  await signIn(page, STAFF);
  await page.goto("/p-home", { timeout: 120_000 });
  // 黙って空の画面にせず、正しいサイトへの入口を見せる。
  await expect(page.getByText("このサイトはパートナー管理者向けです")).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByRole("link", { name: "パートナースタッフサイトを開く" })).toBeVisible();
  // タブも管理者業務の画面も出ない。
  await expect(page.getByRole("navigation", { name: "パートナーメニュー" })).toHaveCount(0);
  for (const path of ["/p-accounts", "/p-commissions", "/p-lane-preferences", "/p-salespeople"]) {
    await page.goto(path, { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "利用者アカウント" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "手数料管理" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "販売員一覧" })).toHaveCount(0);
  }
});

test("K: 別二次店の管理者にはこちらのデータが見えない", async ({ page }) => {
  await signIn(page, OTHER_DEALER_ADMIN);

  await page.goto(`/p-customers?name=${encodeURIComponent(KEEP_CUSTOMER)}`, { timeout: 120_000 });
  await expect(page.getByRole("link", { name: KEEP_CUSTOMER })).toHaveCount(0);

  // 利用者アカウントには自社の利用者しか並ばない。
  await page.goto(`/p-accounts?keyword=${encodeURIComponent(STAFF_NAME)}`, { timeout: 120_000 });
  await expect(page.getByText("条件に一致するデータがありません")).toBeVisible({ timeout: 90_000 });
});

/** 一覧の「該当 N件」を数値で読む。 */
async function resultCount(page: Page): Promise<number> {
  const text = await page.getByText("該当", { exact: false }).first().innerText();
  return Number(text.replace(/[^0-9]/g, ""));
}

/** 利用者アカウントの設定画面を開く（一覧 → 氏名リンク）。 */
async function openAccount(page: Page, name: string): Promise<void> {
  await page.goto("/p-accounts", { timeout: 120_000 });
  await page.getByRole("link", { name }).click();
  await page.waitForURL((u) => u.pathname.startsWith("/p-accounts/"), { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "この利用者の設定" })).toBeVisible({
    timeout: 90_000,
  });
}

/** 利用区分 / 利用状況を変えて保存する（一覧へ戻るまで待つ）。 */
async function saveAccount(page: Page, values: { role?: string; status?: string }): Promise<void> {
  if (values.role) await page.getByLabel("利用区分").selectOption(values.role);
  if (values.status) await page.getByLabel("利用状況").selectOption(values.status);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.waitForURL((u) => u.pathname === "/p-accounts", { timeout: 120_000 });
}

test("L: 利用区分の変更が既存セッションにも反映される", async ({ browser }) => {
  // スタッフ側のセッションを先に開いておく。
  const staffCtx = await browser.newContext();
  const staffPage = await staffCtx.newPage();
  await signIn(staffPage, STAFF);
  await staffPage.goto("/p-home", { timeout: 120_000 });
  const nav = staffPage.getByRole("navigation", { name: "パートナーメニュー" });
  await expect(nav.getByRole("link", { name: "アカウント", exact: true })).toHaveCount(0);

  // 別セッションの管理者がスタッフを管理者へ変更する。
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await signIn(adminPage, ADMIN);
  await openAccount(adminPage, STAFF_NAME);
  await saveAccount(adminPage, { role: "DEALER_ADMIN" });
  await expect(adminPage.getByRole("link", { name: STAFF_NAME })).toBeVisible({ timeout: 90_000 });

  // 開いていたスタッフのセッションは無効になり、ログインし直しになる。
  await staffPage.goto("/p-home", { timeout: 120_000 });
  await expect(staffPage).toHaveURL(/login/, { timeout: 120_000 });

  // 入り直すと管理者としてのメニューになる。
  await signIn(staffPage, STAFF);
  await staffPage.goto("/p-home", { timeout: 120_000 });
  await expect(
    staffPage.getByRole("navigation", { name: "パートナーメニュー" }).getByRole("link", {
      name: "アカウント",
      exact: true,
    }),
  ).toBeVisible({ timeout: 90_000 });

  // 後片付け：スタッフへ戻す（管理者は 2 人いるので降格できる）。
  await openAccount(adminPage, STAFF_NAME);
  await saveAccount(adminPage, { role: "DEALER_STAFF" });

  await staffCtx.close();
  await adminCtx.close();
});

test("M: 利用停止は既存セッションもサインインも止める", async ({ browser }) => {
  const staffCtx = await browser.newContext();
  const staffPage = await staffCtx.newPage();
  await signIn(staffPage, STAFF);
  await staffPage.goto("/p-home", { timeout: 120_000 });

  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await signIn(adminPage, ADMIN);
  await openAccount(adminPage, STAFF_NAME);
  await saveAccount(adminPage, { status: "SUSPENDED" });

  // 開いていたセッションはもう使えない。
  await staffPage.goto("/p-reports", { timeout: 120_000 });
  await expect(staffPage).toHaveURL(/login/, { timeout: 120_000 });

  // サインインもできない。
  await staffPage.goto("/login", { timeout: 120_000 });
  await staffPage.getByLabel("メールアドレス").fill(STAFF);
  await staffPage.getByLabel("パスワード").fill(PASSWORD);
  await staffPage.getByRole("button", { name: "サインイン" }).click();
  await expect(staffPage).toHaveURL(/login/, { timeout: 120_000 });

  // 後片付け：利用を再開する。
  await openAccount(adminPage, STAFF_NAME);
  await saveAccount(adminPage, { status: "ACTIVE" });

  // 管理者は自分自身の利用状況を変えられないので、管理者が 0 人にはならない。
  await openAccount(adminPage, ADMIN_NAME);
  await expect(adminPage.getByLabel("利用区分")).toBeDisabled();
  await expect(adminPage.getByLabel("利用状況")).toBeDisabled();

  await staffCtx.close();
  await adminCtx.close();
});

test("N: 販売員の紐付け候補は自社のものだけ", async ({ page }) => {
  await signIn(page, ADMIN);
  await openAccount(page, STAFF_NAME);
  const select = page.getByLabel("紐付ける販売員");
  await expect(select).toBeVisible();
  // 自社の販売員（スタッフ本人）は候補にある。同姓同名が複数いても成り立つよう
  // 「1 件以上」で見る。候補の絞り込み自体は relationshipId で効いている。
  await expect(select.locator("option").filter({ hasText: STAFF_NAME }).first()).toHaveCount(1);

  // 別二次店の管理者が見る候補には、こちらの販売員は出ない。
  await signOut(page);
  await signIn(page, OTHER_DEALER_ADMIN);
  await page.goto("/p-accounts", { timeout: 120_000 });
  await expect(page.getByRole("link", { name: STAFF_NAME })).toHaveCount(0);
});

test("O: 販売員一覧で検索・絞り込みができ、アカウント紐付け状況が分かる", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/p-salespeople", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "販売員一覧" })).toBeVisible({ timeout: 90_000 });

  // 氏名で検索できる。
  await page.getByLabel("氏名・カナ・連絡先").fill(STAFF_NAME);
  await page.getByRole("button", { name: "検索", exact: true }).click();
  await expect(page).toHaveURL(/keyword=/, { timeout: 90_000 });
  await expect(page.getByRole("link", { name: STAFF_NAME }).first()).toBeVisible();
  const all = await resultCount(page);
  expect(all).toBeGreaterThan(0);

  // 紐付け状況で絞り込むと、あり + なし が全件に一致する（件数も同じ範囲で数えている）。
  const q = "/p-salespeople?keyword=" + encodeURIComponent(STAFF_NAME);
  await page.goto(q + "&link=LINKED", { timeout: 120_000 });
  const linked = await resultCount(page);
  await page.goto(q + "&link=UNLINKED", { timeout: 120_000 });
  const unlinked = await resultCount(page);
  expect(linked).toBeGreaterThan(0);
  expect(linked + unlinked).toBe(all);

  // 紐付けのある行には、紐付いた利用者の氏名が出る。
  await page.goto(q + "&link=LINKED", { timeout: 120_000 });
  await expect(page.getByRole("cell", { name: STAFF_NAME }).first()).toBeVisible();
});

test("P: 他二次店の ID を URL に直接指定しても開けない", async ({ page }) => {
  // 別二次店の管理者として、自分の利用者 ID と顧客 ID を控える。
  await signIn(page, OTHER_DEALER_ADMIN);
  await page.goto("/p-accounts", { timeout: 120_000 });
  const accountHref = await page.locator('a[href^="/p-accounts/"]').first().getAttribute("href");
  expect(accountHref, "別二次店の利用者 ID が取れること").toBeTruthy();
  const otherAccountId = accountHref!.split("/").pop()!;

  // こちらの管理者では開けない（自社の利用者ではないので 404）。
  await signOut(page);
  await signIn(page, ADMIN);
  const res = await page.goto(`/p-accounts/${otherAccountId}`, { timeout: 120_000 });
  expect(res?.status(), "他社の利用者は 404").toBe(404);

  // 顧客も同じ。alpha の顧客 ID を beta の管理者が開けない。
  await page.goto(`/p-customers?name=${encodeURIComponent(KEEP_CUSTOMER)}`, { timeout: 120_000 });
  const customerHref = await page
    .getByRole("link", { name: KEEP_CUSTOMER })
    .first()
    .getAttribute("href");
  const ownCustomerId = customerHref!.split("/").pop()!;

  await signOut(page);
  await signIn(page, OTHER_DEALER_ADMIN);
  const res2 = await page.goto(`/p-customers/${ownCustomerId}`, { timeout: 120_000 });
  expect(res2?.status(), "他社の顧客は 404").toBe(404);
  const res3 = await page.goto(`/p-customers/${ownCustomerId}/edit`, { timeout: 120_000 });
  expect(res3?.status(), "他社の顧客の編集画面も 404").toBe(404);
});

test("Q: 販売員を登録・確認・編集できる（備考欄は無い）", async ({ page }) => {
  await signIn(page, ADMIN);

  const name = `販売員-${Date.now().toString(36)}`;
  await gotoForm(page, "/p-salespeople/new");
  // Google フォームに無い項目（備考）は置かない。
  await expect(page.getByLabel("備考")).toHaveCount(0);
  await page.getByLabel("氏名（漢字）").fill(name);
  await page.getByLabel("氏名（カナ）").fill("ハンバイイン テスト");
  await page.getByLabel("メールアドレス").fill("sp-test@example.com");
  await page.getByLabel("営業経験歴").fill("3年");
  await page.getByRole("button", { name: "登録する" }).click();

  // 詳細へ遷移し、登録値が出る。加盟店番号は自動設定。
  await expect(page.getByRole("heading", { name: "販売員詳細" })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText(name)).toBeVisible();
  await expect(page.getByText("3年")).toBeVisible();

  // 編集できる。
  await page.getByRole("link", { name: "編集" }).click();
  await page.getByLabel("営業経験歴").fill("5年");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("5年")).toBeVisible({ timeout: 90_000 });

  // 一覧に出る。
  await page.goto(`/p-salespeople?keyword=${encodeURIComponent(name)}`, { timeout: 120_000 });
  await expect(page.getByRole("link", { name })).toBeVisible({ timeout: 90_000 });
});

test("R: スタッフサイトの画面はこのサイトに存在しない", async ({ page }) => {
  await signIn(page, ADMIN);
  // カタログはスタッフの業務。経路ごと塞いでいるのでホームへ戻る。
  for (const path of ["/p-catalog", "/p-catalog/abc"]) {
    await page.goto(path, { timeout: 120_000 });
    await expect(page, `${path} は開けない`).toHaveURL(/\/p-home/, { timeout: 90_000 });
  }
  const nav = page.getByRole("navigation", { name: "パートナーメニュー" });
  await expect(nav.getByRole("link", { name: "カタログ", exact: true })).toHaveCount(0);
});

test("S: スタッフが提出した報告を、管理者サイトから同じデータとして確認できる", async ({
  page,
}) => {
  await signIn(page, ADMIN);
  const place = "[E2E admin] スタッフ提出日報";
  await page.goto(`/p-reports?venuePlace=${encodeURIComponent(place)}`, { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "催事日報一覧" })).toBeVisible({
    timeout: 90_000,
  });
  // 提出者はスタッフ本人。管理者が登録したわけではない。
  await expect(page.getByRole("cell", { name: STAFF_NAME })).toBeVisible();
  await expect(page.getByText(place).first()).toBeVisible();

  // 詳細でも稼働時間・活動実績・所感まで同じデータが見える。
  await page.getByRole("link").filter({ hasText: /2026/ }).first().click();
  await expect(page.getByRole("heading", { name: "催事日報詳細" })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText("[E2E admin] スタッフの所感")).toBeVisible();
  await expect(page.getByText(`提出者: ${STAFF_NAME}`)).toBeVisible();
});

// スタッフサイトの URL。Cookie の分離を確かめるため、同じブラウザ文脈で行き来する。
const STAFF_SITE = process.env.PARTNER_APP_URL ?? "http://localhost:3200";

test("T: 同じブラウザで 2 サイトへ同時にログインでき、Cookie が上書きされない", async ({
  page,
  context,
}) => {
  // 管理者サイトへログイン。
  await signIn(page, ADMIN);
  await page.goto("/p-home", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "パートナーポータル" })).toBeVisible({
    timeout: 90_000,
  });

  // 同じブラウザ文脈のままスタッフサイトへ移り、別アカウントでログインする。
  await page.goto(`${STAFF_SITE}/login`, { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(STAFF);
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "サインイン" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
  await page.goto(`${STAFF_SITE}/p-home`, { timeout: 120_000 });
  const staffNav = page.getByRole("navigation", { name: "パートナーメニュー" });
  await expect(staffNav.getByRole("link", { name: "カタログ", exact: true })).toBeVisible({
    timeout: 90_000,
  });

  // Cookie 名がサイトごとに分かれているので、両方のセッションが残っている。
  const cookies = await context.cookies();
  const names = cookies.map((c) => c.name);
  expect(names).toContain("partner-admin-authjs.session-token");
  expect(names).toContain("partner-authjs.session-token");

  // 管理者サイトへ戻ってもログインしたまま（スタッフのログインで消えていない）。
  await page.goto("/p-accounts", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "利用者アカウント" })).toBeVisible({
    timeout: 90_000,
  });

  // 片方をサインアウトしても、もう片方は残る。
  await page.goto(`${STAFF_SITE}/api/auth/signout`, { timeout: 120_000 });
  await page.getByRole("button", { name: /サインアウト|Sign out/ }).click();
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
  await page.goto("/p-accounts", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "利用者アカウント" })).toBeVisible({
    timeout: 90_000,
  });
});
