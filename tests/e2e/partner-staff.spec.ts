import { execSync } from "node:child_process";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// パートナースタッフサイト（APP_VARIANT=partner / http://localhost:3200）。
//
//   A. スタッフのトップ・ナビは 6 業務（管理機能は出ない）
//   B. 管理機能（販売員管理）は URL 直打ちでも拒否される
//   C. スタッフは自分の報告を登録・閲覧・訂正できる
//   D. 同じパートナー会社の別利用者が提出した報告も閲覧できる（会社全件）
//   E. 別のパートナー会社の提出物にはアクセスできない
//   F. 担当者・クローズ会社の選択で提出者・所属が変わらない
//   G. カタログを閲覧でき、仕入値は出ない
//   H. 担当顧客だけが見え、商談情報だけを更新できる
//   I. 催事シフトは会社全件を見られ、担当者で絞り込める
//   J. スタッフサイトでは、管理者ロールを持つ利用者もスタッフ範囲で動く
//
// baseURL は playwright.partner.config.ts の "staff" プロジェクトが与える。
// ADMIN（alpha-admin）はフィクスチャで DEALER_STAFF ロールも持たせてあり、
// 「同じ二次店の別利用者」としてスタッフサイトを使える。管理者業務は
// 管理者サイト（partner-admin.spec.ts）が担当する。

const STAFF = "alpha-staff@solar-saas.dev";
const ADMIN = "alpha-admin@solar-saas.dev";
// 他社役。スタッフサイトは DEALER_STAFF を持つ利用者が対象なので、
// 別二次店のスタッフを使う（beta-admin は管理者サイトの対象）。
const OTHER_DEALER_STAFF = "beta-staff@solar-saas.dev";
/** 商談編集の検証用。二次店ガンマはスコープ FULL_CLOSING（アルファは APPOINTMENT_ONLY で商談を触れない）。 */
const CLOSING_STAFF = "gamma-staff@solar-saas.dev";
const PASSWORD = "Pilot!2026";

test.describe.configure({ timeout: 180_000 });

/**
 * フィクスチャが作った「担当者と商談が明確な顧客」。スタッフのメールをキーにする。
 *
 * 閲覧範囲が自社全件になって一覧がページ分割されるため、一覧から探し当てるのではなく
 * この id を直接開いて、許可（自社・商談あり）と拒否（スコープ外）を確かめる。
 */
const FIXTURE_CUSTOMER: Record<string, string> = {};

// 日報の対象になる催事（この実行ぶん）。会場名は催事の記録なので、
// 提出者ごとに別の催事を使って一覧上で見分ける。
const REPORT_TAG = `RS-${Date.now().toString(36)}`;
const ADMIN_PLACE = `${REPORT_TAG} 会場1`;
const STAFF_PLACE = `${REPORT_TAG} 会場2`;
const ADMIN_EVENT = `2026-02-01 ${ADMIN_PLACE}`;
const STAFF_EVENT = `2026-02-28 ${STAFF_PLACE}`;

test.beforeAll(() => {
  // シード後に、スタッフの販売員リンク・担当顧客・商談を追加する（冪等）。
  // 作った id は JSON 1 行で出るので、受け取ってテストから直接使う。
  const out = execSync(
    "pnpm -F @solar/db exec tsx ../../tests/e2e/fixtures/partner-staff-fixture.ts",
    { cwd: resolve(__dirname, "../.."), encoding: "utf8" },
  );
  // 日報の対象催事（提出者ごとに別会場）。
  execSync(
    `pnpm -F @solar/db exec tsx ../../tests/e2e/fixtures/partner-report-events-fixture.ts "${REPORT_TAG}"`,
    { cwd: resolve(__dirname, "../.."), stdio: "inherit" },
  );
  for (const line of out.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      const row = JSON.parse(trimmed) as { staff?: string; customerId?: string };
      if (row.staff && row.customerId) FIXTURE_CUSTOMER[row.staff] = row.customerId;
    } catch {
      // シード以外の出力行は無視する。
    }
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

function unique(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

async function submitVisitAppointment(page: Page, closeDept: string): Promise<string> {
  await gotoForm(page, "/p-appointments/new?type=visit");
  await page.getByLabel("トス部署").fill("第一営業部");
  await page.getByLabel("マエカク実施者").fill("コール班 佐藤");
  await page.getByLabel("クローズ部署").fill(closeDept);
  await page.getByLabel("営業担当者").selectOption({ index: 1 });
  await page.getByLabel("販売チャネル").selectOption("VISIT_SALES");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: "訪問アポ詳細" })).toBeVisible({
    timeout: 90_000,
  });
  return page.url().split("/").pop()!;
}

async function submitContract(page: Page, branch: string): Promise<string> {
  await gotoForm(page, "/p-contracts/new");
  await page.getByLabel("ご契約日").fill("2026-04-10");
  await page.getByLabel("トス日").fill("2026-04-01");
  await page.getByLabel("トス部署").fill("第一営業部");
  await page.getByLabel("アポ獲得者").fill("佐々木 孝");
  await page.getByLabel("営業担当者").fill("鳥居 佑馬");
  await page.getByLabel("取次拠点").fill(branch);
  await page.getByRole("combobox", { name: "所属", exact: true }).selectOption("VE");
  await page.getByLabel("所属部署").fill("住設事業部");
  await page.getByLabel("アポ獲得時チャネル").selectOption("TELE_APPOINTMENT");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: "成約詳細" })).toBeVisible({ timeout: 90_000 });
  return page.url().split("/").pop()!;
}

/**
 * 催事日報を 1 件出す。
 *
 * 日報は「どの催事のどの開催日か」を選んでから出すので、会場名・実施日は
 * 催事の記録から決まる。呼び出し側はフィクスチャで用意した催事の
 * 表示ラベル（"YYYY-MM-DD 店舗名"）を渡す。
 */
async function submitReport(page: Page, eventLabel: string): Promise<string> {
  await gotoForm(page, "/p-reports/new");
  await page.getByLabel("対象の催事").selectOption({ label: eventLabel });
  await page.getByLabel("対象の開催日").selectOption({ index: 1 });
  await page.getByLabel("施設内エリア").fill("入口");
  await page.getByLabel("稼働開始時間").fill("10:00");
  await page.getByLabel("稼働終了時間").fill("18:00");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: "催事日報詳細" })).toBeVisible({
    timeout: 90_000,
  });
  return page.url().split("/").pop()!;
}

test("A: スタッフのトップとナビは 6 業務で、管理機能は出ない", async ({ page }) => {
  await signIn(page, STAFF);
  await expect(page).toHaveURL(/\/p-home/, { timeout: 90_000 });

  const nav = page.getByRole("navigation", { name: "パートナーメニュー" });
  for (const label of [
    "アポイント",
    "成約報告",
    "催事日報",
    "カタログ",
    "顧客情報",
    "催事シフト",
  ]) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: "販売員", exact: true })).toHaveCount(0);
  // トップのカードにも販売員管理は無い。
  await expect(page.getByRole("link", { name: "販売員を登録" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "カタログを見る" })).toBeVisible();

  // 閲覧範囲は管理者サイトと同じ（自社全件）なので、範囲の注記はスタッフ側にも出る。
  // ここでトップから離れるので、トップ画面の確認はすべて上で済ませておく。
  await page.goto("/p-reports", { timeout: 120_000 });
  await expect(
    page.getByText("自社が取り扱う内容をすべて表示しています（本人提出分に限りません）"),
  ).toBeVisible({ timeout: 90_000 });
});

test("B: 管理者サイトの画面はこのサイトに存在しない", async ({ page }) => {
  await signIn(page, STAFF);
  // 経路ごと塞いでいるので、権限エラーではなくホームへ戻る。
  for (const path of ["/p-salespeople", "/p-salespeople/new", "/p-accounts", "/p-commissions"]) {
    await page.goto(path, { timeout: 120_000 });
    await expect(page, `${path} は開けない`).toHaveURL(/\/p-home/, { timeout: 90_000 });
  }
  await expect(page.getByLabel("氏名（漢字）")).toHaveCount(0);
});

// 閲覧範囲の方針（デモ段階）:
//   所属パートナー会社が取り扱う提出物は、通常スタッフも全件閲覧できる。
//   「本人提出分のみ」は閲覧の制限には使わない（絞り込み条件としては使える）。
//   会社の外（別のパートナー会社）には出ない。
test("C/D/E: 自社の提出分は他スタッフ分も閲覧でき、他社の提出分には届かない", async ({ page }) => {
  // 管理者（同じパートナー会社の別利用者）が先に 1 件ずつ提出する。
  await signIn(page, ADMIN);
  const adminVisitId = await submitVisitAppointment(page, unique("管理者クローズ課"));
  const adminContractId = await submitContract(page, unique("管理者拠点"));
  const adminReportId = await submitReport(page, ADMIN_EVENT);
  await signOut(page);

  // スタッフ本人が提出する。
  await signIn(page, STAFF);
  const staffDept = unique("スタッフクローズ課");
  const staffVisitId = await submitVisitAppointment(page, staffDept);
  const staffBranch = unique("スタッフ拠点");
  const staffContractId = await submitContract(page, staffBranch);
  const staffPlace = STAFF_PLACE;
  const staffReportId = await submitReport(page, STAFF_EVENT);

  // 一覧には本人分も、同じ会社の別利用者（管理者）の提出分も出る。
  await page.goto("/p-appointments", { timeout: 120_000 });
  await expect(page.getByText(staffDept)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("link", { name: /管理者クローズ課/ }).first()).toBeVisible({
    timeout: 90_000,
  });
  await page.goto("/p-contracts", { timeout: 120_000 });
  // 取次拠点は列と、狭い画面用に畳んだ行（sm:hidden）の両方に出る。畳んだ行は
  // PC 幅では hidden なので、必ず列のセルで見る。
  await expect(page.getByRole("cell", { name: staffBranch })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("cell", { name: /管理者拠点/ }).first()).toBeVisible({
    timeout: 90_000,
  });
  await page.goto("/p-reports", { timeout: 120_000 });
  await expect(page.getByRole("cell", { name: staffPlace }).first()).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByRole("cell", { name: ADMIN_PLACE }).first()).toBeVisible({
    timeout: 90_000,
  });

  // 同じ会社の別利用者の提出分も詳細を開ける（閲覧は会社全件）。
  for (const path of [
    `/p-appointments/visit/${adminVisitId}`,
    `/p-contracts/${adminContractId}`,
    `/p-reports/${adminReportId}`,
  ]) {
    const res = await page.goto(path, { timeout: 120_000 });
    expect(res?.status(), `${path} は自社なので開ける`).toBe(200);
  }

  // 本人分は訂正できる。
  await gotoForm(page, `/p-appointments/visit/${staffVisitId}/edit`);
  await page.getByLabel("トス部署").fill("第二営業部");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("第二営業部")).toBeVisible({ timeout: 90_000 });

  await gotoForm(page, `/p-contracts/${staffContractId}/edit`);
  await page.getByLabel("所属部署").fill("不動産事業部");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("不動産事業部")).toBeVisible({ timeout: 90_000 });

  await gotoForm(page, `/p-reports/${staffReportId}/edit`);
  await page.getByLabel("所感").fill("スタッフ訂正");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("スタッフ訂正")).toBeVisible({ timeout: 90_000 });
  await signOut(page);

  // 別二次店の利用者からは本人分にも届かない。
  await signIn(page, OTHER_DEALER_STAFF);
  for (const path of [
    `/p-appointments/visit/${staffVisitId}`,
    `/p-contracts/${staffContractId}`,
    `/p-reports/${staffReportId}`,
  ]) {
    const res = await page.goto(path, { timeout: 120_000 });
    expect(res?.status(), `${path} は他社から 404`).toBe(404);
  }
});

test("F: 初訪アポで担当者・クローズ会社を選んでも、提出者はスタッフ本人のまま", async ({
  page,
}) => {
  await signIn(page, STAFF);
  const customer = unique("スタッフ顧客");
  await gotoForm(page, "/p-appointments/new?type=first-visit");
  await page.getByLabel("クローズ会社").selectOption({ index: 1 });
  // 営業担当者は本人ではない販売員（index 1 = 一覧の先頭）を選ぶ。
  await page.getByLabel("営業担当者").selectOption({ index: 1 });
  await page.getByLabel("販売チャネル").selectOption("INBOUND");
  await page.getByLabel("催事実施日").fill("2026-04-01");
  await page.getByLabel("催事場所").fill("反響対応");
  await page.getByLabel("催事ブース場所").selectOption("OTHER");
  await page.getByLabel("お客様名").fill(customer);
  await page.getByLabel("フリガナ").fill("スタッフコキャク");
  await page.getByLabel("携帯番号").fill("09012345678");
  await page.getByLabel("郵便番号").fill("330-0001");
  await page.getByLabel("都道府県").fill("埼玉県");
  await page.getByLabel("市区町村・番地").fill("さいたま市浦和区1-2-3");
  await page.getByLabel("マエカク実施者").fill("コール班 鈴木");
  await page.getByLabel("初回訪問アポ日時").fill("2026-04-05T10:00");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: /アポイント詳細/ })).toBeVisible({
    timeout: 90_000,
  });
  const id = page.url().split("/").pop()!;

  // 本人提出分として一覧・編集に出る（提出者 = 本人。担当者の選択に左右されない）。
  await page.goto("/p-appointments", { timeout: 120_000 });
  await expect(page.getByRole("link", { name: customer })).toBeVisible({ timeout: 90_000 });
  await gotoForm(page, `/p-appointments/${id}/edit`);
  await expect(page.getByLabel("お客様名")).toHaveValue(customer);

  // 所属二次店が変わっていないこと（管理者サイトの一覧に自社全件として出ること）は、
  // 別サイトの話なので partner-admin.spec.ts が確認する。
});

test("G: カタログを閲覧でき、仕入値は出ず、管理操作は無い", async ({ page }) => {
  await signIn(page, STAFF);
  await page.goto("/p-catalog", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "カタログ" })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("仕入値")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /登録|編集|削除/ })).toHaveCount(0);

  const first = page.getByRole("table").locator("tbody tr").first().getByRole("link").first();
  if ((await first.count()) > 0) {
    await first.click();
    await expect(page.getByRole("heading", { name: "商品詳細" })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByText("卸値")).toBeVisible();
    await expect(page.getByText("仕入値")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /編集|削除|保存/ })).toHaveCount(0);
  }
});

// 閲覧範囲は自社（所属パートナー会社）が取り扱う顧客の全件。
// 「本人担当分だけ」は閲覧の制限ではなく絞り込み条件として扱う。
// 更新できるのは商談情報だけ、という既存ルールは変わらない。
test("H: 自社の顧客が見え、商談情報だけを更新できる", async ({ page }) => {
  await signIn(page, CLOSING_STAFF);
  // 一覧は自社全件でページ分割されるので、探し当てずに対象を直接開く。
  // この顧客はフィクスチャが作った「自社・本人担当・商談あり」の 1 件。
  const customerId = FIXTURE_CUSTOMER[CLOSING_STAFF];
  expect(customerId, "フィクスチャの顧客 id が取れていること").toBeTruthy();
  await page.goto(`/p-customers/${customerId}`, { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "顧客・商談" })).toBeVisible({ timeout: 90_000 });

  // 顧客基本情報の編集導線は無い。
  await expect(page.getByText("基本情報はこの画面では変更できません")).toBeVisible();
  await expect(page.getByLabel("お客様名")).toHaveCount(0);

  await page.getByRole("link", { name: "商談を編集" }).first().click();
  await expect(page.getByRole("heading", { name: "商談情報を編集" })).toBeVisible({
    timeout: 90_000,
  });
  // フォームには商談項目だけ（氏名・住所・担当者の欄は無い）。
  await expect(page.getByLabel("お客様名")).toHaveCount(0);
  await expect(page.getByLabel("営業担当者")).toHaveCount(0);
  const nextAction = unique("次回アクション");
  await page.getByLabel("次回アクション").fill(nextAction);
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText(nextAction)).toBeVisible({ timeout: 90_000 });
});

test("H2: スコープが APPOINTMENT_ONLY の二次店では商談を更新できない（既存ルール）", async ({
  page,
}) => {
  await signIn(page, STAFF);
  // アルファ（スコープ APPOINTMENT_ONLY）の、担当者と商談が明確な顧客を直接開く。
  const customerId = FIXTURE_CUSTOMER[STAFF];
  expect(customerId, "フィクスチャの顧客 id が取れていること").toBeTruthy();
  await page.goto(`/p-customers/${customerId}`, { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "顧客・商談" })).toBeVisible({ timeout: 90_000 });
  await page.getByRole("link", { name: "商談を編集" }).first().click();
  await page.getByLabel("次回アクション").fill("スコープ外");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("このスコープでは商談の更新はできません").first()).toBeVisible({
    timeout: 90_000,
  });
});

// 催事シフトは会社全件を見られる（誰がどこに入っているかを把握するため）。
// スタッフサイトは閲覧のみで、配置（割当の作成・変更）の導線は出ない。
test("I: 催事シフトを閲覧でき、配置の導線は出ない", async ({ page }) => {
  await signIn(page, STAFF);
  await page.goto("/p-shifts", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "催事シフト" })).toBeVisible({
    timeout: 90_000,
  });
  // 月と表示方法の切替はある。
  await expect(page.getByRole("link", { name: "当月" })).toBeVisible();
  await expect(page.getByRole("link", { name: "カレンダー" })).toBeVisible();
  // 配置（管理者だけの操作）の導線は出ない。
  await expect(page.getByRole("link", { name: "配置する" })).toHaveCount(0);
  // URL を直打ちしても配置はできない。/p-shifts 配下なので middleware は通すが、
  // 画面のガードと Server Action の両方が管理者サイト限定で止める。
  await page.goto("/p-shifts/assign", { timeout: 120_000 });
  await expect(page.getByText("この機能はパートナー管理者のみ利用できます")).toBeVisible({
    timeout: 90_000,
  });
});

test("J: 管理者ロールを持つ利用者も、スタッフサイトではスタッフ範囲で動く", async ({ page }) => {
  await signIn(page, ADMIN);
  await page.goto("/p-home", { timeout: 120_000 });
  // タブはスタッフの 6 業務。管理者タブは出ない。
  const nav = page.getByRole("navigation", { name: "パートナーメニュー" });
  await expect(nav.getByRole("link", { name: "カタログ", exact: true })).toBeVisible();
  for (const label of ["販売員", "アカウント", "手数料", "出店希望"]) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toHaveCount(0);
  }
  // 閲覧範囲は両サイトで同じ（自社全件）。違うのは実行できる操作。
  await page.goto("/p-reports", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "催事日報一覧" })).toBeVisible({
    timeout: 90_000,
  });
  // 管理者サイト専用の画面には、このサイトからは入れない。
  const res = await page.goto("/p-salespeople", { timeout: 120_000 });
  expect(res?.url()).toContain("/p-home");
});
