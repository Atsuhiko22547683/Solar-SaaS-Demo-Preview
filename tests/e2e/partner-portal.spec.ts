import { execSync } from "node:child_process";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// パートナースタッフサイト（APP_VARIANT=partner / http://localhost:3200）。
//
//   A. 二次店スタッフでログインでき、スタッフサイトのトップへ入る
//   B. 公開されるのはスタッフの 6 業務だけ
//      （代理店画面も、管理者サイトの画面も URL 直打ちで開けない）
//   D. 催事日報を、対象の催事・開催日を選んで登録・確認・編集・訂正できる
//   E. アポイントを登録・確認・編集できる
//   F. 他社の ID を直接指定しても 404（自社データだけ）
//   G. 未認証はログインへ送られる
//   H. 代理店アカウントは二次店サイトを利用できない
//
// 販売員管理（旧 C / S）は管理者サイトの業務なので partner-admin.spec.ts に移した。
// baseURL は playwright.partner.config.ts の "staff" プロジェクトが与える。

const DEALER_STAFF_USER = "alpha-staff@solar-saas.dev";
const OTHER_DEALER = "beta-staff@solar-saas.dev";
const AGENCY_OWNER = "owner@solar-saas.demo";
const PILOT_PASSWORD = "Pilot!2026";
const DEMO_PASSWORD = "Demo1234!";

test.describe.configure({ timeout: 180_000 });

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "サインイン" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
}

function unique(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

/**
 * 入力フォームを開く。
 *
 * 登録画面の入力欄は React の制御コンポーネントなので、hydration 前に fill すると
 * hydration 時に state 側の初期値（空文字）で上書きされ、入力が消える。
 * dev server の初回コンパイルが挟まる最初の 1 回で必ず踏むため、
 * ネットワークが落ち着いてレイアウトが確定するまで待ってから操作する。
 */
async function gotoForm(page: Page, path: string): Promise<void> {
  await page.goto(path, { timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
  await page.waitForTimeout(500);
}

test("G: 未認証は保護画面を開けない", async ({ page }) => {
  await page.goto("/p-home", { timeout: 120_000 });
  await expect(page).toHaveURL(/\/login/, { timeout: 90_000 });
});

test("A/B: スタッフはトップへ入り、公開はスタッフの 6 業務だけ", async ({ page }) => {
  await signIn(page, DEALER_STAFF_USER, PILOT_PASSWORD);
  await page.goto("/p-home", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "パートナーポータル" })).toBeVisible({
    timeout: 90_000,
  });

  // タブはスタッフの 6 業務 + トップ。
  const nav = page.getByRole("navigation", { name: "パートナーメニュー" });
  for (const label of [
    "トップ",
    "アポイント",
    "成約報告",
    "催事日報",
    "カタログ",
    "顧客情報",
    "催事シフト",
  ]) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
  }

  // 代理店側の画面は URL 直打ちでも開けない（ホームへ戻される）。
  for (const path of ["/dashboard", "/customers", "/product-catalog/pv", "/members", "/payments"]) {
    await page.goto(path, { timeout: 120_000 });
    await expect(page, `${path} は開けない`).toHaveURL(/\/p-home/, { timeout: 90_000 });
  }
  // 既存の二次店向け業務画面（商談・契約等）も出さない。
  for (const path of ["/d-dashboard", "/d-contracts", "/incentives"]) {
    await page.goto(path, { timeout: 120_000 });
    await expect(page, `${path} は開けない`).toHaveURL(/\/p-home/, { timeout: 90_000 });
  }
  // 管理者サイトの画面はこのサイトに無い（別プロセス・別 URL）。
  for (const path of ["/p-salespeople", "/p-accounts", "/p-commissions", "/p-lane-preferences"]) {
    await page.goto(path, { timeout: 120_000 });
    await expect(page, `${path} は開けない`).toHaveURL(/\/p-home/, { timeout: 90_000 });
  }
});

test("D: 催事日報を対象の催事・開催日を選んで登録・確認・編集・訂正できる", async ({ page }) => {
  // 日報は催事の記録なので、対象にできる催事をこの実行ぶんだけ用意する。
  const tag = unique("D");
  execSync(
    `pnpm -F @solar/db exec tsx ../../tests/e2e/fixtures/partner-report-events-fixture.ts "${tag}"`,
    { cwd: resolve(__dirname, "../.."), stdio: "inherit" },
  );
  const place = `${tag} 会場1`;

  await signIn(page, DEALER_STAFF_USER, PILOT_PASSWORD);

  await gotoForm(page, "/p-reports/new");
  await page.getByLabel("対象の催事").selectOption({ label: `2026-02-01 ${place}` });
  await page.getByLabel("対象の開催日").selectOption({ index: 1 });
  // 実施日・場所は催事側の記録から決まる（入力欄ではない）。
  await expect(page.locator("#r-date-derived")).toHaveText("2026-02-01", { timeout: 90_000 });
  await expect(page.locator("#r-place-derived")).toHaveText(place);
  await page.getByLabel("施設内エリア").fill("1階エレベーター前");
  await page.getByLabel("稼働開始時間").fill("10:00");
  await page.getByLabel("稼働終了時間").fill("18:00");

  await page.getByLabel("抽選数 両面").fill("30");
  await page.getByLabel("抽選数 片面").fill("20");
  await page.getByLabel("着座数 両面").fill("10");
  await page.getByLabel("着座数 片面").fill("8");
  await page.getByLabel("アポ数 両面").fill("4");
  await page.getByLabel("アポ数 片面").fill("3");
  // 合計は入力させず算出する。
  await expect(page.getByLabel("抽選数 合計")).toHaveText("50");
  await expect(page.getByLabel("アポ数 合計")).toHaveText("7");

  await page.getByLabel("カインズPay対応数").fill("12");
  await page.getByLabel("所感").fill("テスト所感");
  await page.getByRole("button", { name: "登録する" }).click();

  await expect(page.getByRole("heading", { name: "催事日報詳細" })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText(place)).toBeVisible();
  await expect(page.getByText("テスト所感")).toBeVisible();

  // 編集できる。
  await page.getByRole("link", { name: "編集" }).click();
  await page.getByLabel("所感").fill("修正後の所感");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("修正後の所感")).toBeVisible({ timeout: 90_000 });

  // 訂正すると、元の日報は残ったまま訂正後の日報ができる（数値は二重に数えない）。
  await page.getByRole("link", { name: "訂正して再提出" }).click();
  await expect(page.getByRole("heading", { name: "催事日報を訂正" })).toBeVisible({
    timeout: 90_000,
  });
  await page.getByLabel("所感").fill("訂正後の所感");
  await page.getByRole("button", { name: "訂正して再提出" }).click();
  await expect(page.getByText("訂正として提出された日報")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("訂正後の所感")).toBeVisible();
});

test("D2: 成果数値の大小関係が検証される", async ({ page }) => {
  const tag = unique("D2");
  execSync(
    `pnpm -F @solar/db exec tsx ../../tests/e2e/fixtures/partner-report-events-fixture.ts "${tag}"`,
    { cwd: resolve(__dirname, "../.."), stdio: "inherit" },
  );

  await signIn(page, DEALER_STAFF_USER, PILOT_PASSWORD);
  await gotoForm(page, "/p-reports/new");

  await page.getByLabel("対象の催事").selectOption({ label: `2026-02-01 ${tag} 会場1` });
  await page.getByLabel("対象の開催日").selectOption({ index: 1 });
  await page.getByLabel("施設内エリア").fill("入口");
  await page.getByLabel("稼働開始時間").fill("10:00");
  await page.getByLabel("稼働終了時間").fill("18:00");
  // 着座 > 抽選 は保存させない。
  await page.getByLabel("抽選数 両面").fill("1");
  await page.getByLabel("着座数 両面").fill("9");
  await page.getByRole("button", { name: "登録する" }).click();

  await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 90_000 });
  // 保存されず登録画面に留まる。
  await expect(page).toHaveURL(/\/p-reports\/new/);
});

// 初訪アポの必須項目をまとめて埋める補助。条件付き項目（催事種別 / 対面者）は
// 販売チャネルに応じて出し分くので、チャネルを先に選ぶ。
async function fillFirstVisitRequired(page: Page, customer: string): Promise<void> {
  await page.getByLabel("クローズ会社").selectOption({ index: 1 });
  await page.getByLabel("営業担当者").selectOption({ index: 1 });
  await page.getByLabel("販売チャネル").selectOption("EVENT");
  await page.getByLabel("催事実施日").fill("2026-04-01");
  await page.getByLabel("催事場所").fill("カインズ 浦和美園店");
  await page.getByLabel("催事種別").selectOption("CAINZ");
  await page.getByLabel("催事ブース場所").selectOption("ENTRANCE");
  await page.getByLabel("お客様名").fill(customer);
  await page.getByLabel("フリガナ").fill("テストコキャク");
  await page.getByLabel("携帯番号").fill("09012345678");
  await page.getByLabel("郵便番号").fill("330-0001");
  await page.getByLabel("都道府県").fill("埼玉県");
  await page.getByLabel("市区町村・番地").fill("さいたま市浦和区1-2-3");
  await page.getByLabel("マエカク実施者").fill("コール班 鈴木");
  await page.getByLabel("初回訪問アポ日時").fill("2026-04-05T10:00");
}

test("E: 初訪アポを登録・確認・編集できる（携帯番号は必須）", async ({ page }) => {
  await signIn(page, DEALER_STAFF_USER, PILOT_PASSWORD);

  const customer = unique("テスト顧客");
  await gotoForm(page, "/p-appointments/new?type=first-visit");

  // 必須が欠けたままでは保存できない。
  await page.getByLabel("お客様名").fill(customer);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 90_000 });

  await fillFirstVisitRequired(page, customer);
  await page.getByRole("button", { name: "登録する" }).click();

  await expect(page.getByRole("heading", { name: /アポイント詳細/ })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText(customer)).toBeVisible();
  await expect(page.getByText("コール班 鈴木")).toBeVisible();
  // クローズ会社が保存され、詳細に出る（検証エラーのトーストにも同じ語が出るので厳密一致で見る）。
  await expect(page.getByText("クローズ会社", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "編集" }).click();
  await page.getByLabel("フリガナ").fill("シュウセイゴ カナ");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("シュウセイゴ カナ")).toBeVisible({ timeout: 90_000 });
});

test("E-mobile: 固定電話だけでは初訪アポを保存できない", async ({ page }) => {
  await signIn(page, DEALER_STAFF_USER, PILOT_PASSWORD);
  const customer = unique("携帯必須テスト");
  await gotoForm(page, "/p-appointments/new?type=first-visit");
  await fillFirstVisitRequired(page, customer);
  await page.getByLabel("携帯番号").fill("");
  await page.getByLabel("固定電話番号").fill("03-1234-5678");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 90_000 });
  await expect(page).toHaveURL(/\/p-appointments\/new/);
});

test("E2: 催事情報を入力・表示・編集できる", async ({ page }) => {
  await signIn(page, DEALER_STAFF_USER, PILOT_PASSWORD);

  const customer = unique("催事テスト顧客");
  const place = unique("直接入力会場");
  await gotoForm(page, "/p-appointments/new?type=first-visit");

  await fillFirstVisitRequired(page, customer);
  await page.getByLabel("催事場所").fill(place);
  await page.getByLabel("催事種別").selectOption("KOMERI");
  await page.getByLabel("催事ブース場所").selectOption("OTHER");
  // 「その他」を選んだときだけ自由記述が現れる。
  const note = page.getByLabel("ブース場所（その他の内容）");
  await expect(note).toBeVisible();
  await note.fill("1階エレベーター前");
  await page.getByRole("button", { name: "登録する" }).click();

  await expect(page.getByRole("heading", { name: /アポイント詳細/ })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText("2026/04/01")).toBeVisible();
  await expect(page.getByText(place)).toBeVisible();
  await expect(page.getByText("コメリ")).toBeVisible();
  await expect(page.getByText("1階エレベーター前")).toBeVisible();

  // 編集で変更できる。
  await page.getByRole("link", { name: "編集" }).click();
  await page.getByLabel("催事種別").selectOption("SHIMACHU");
  await page.getByLabel("催事ブース場所").selectOption("ENTRANCE");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("島忠")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("店頭入口付近")).toBeVisible();
  // 「その他」以外にしたので自由記述は表示されない。
  await expect(page.getByText("1階エレベーター前")).toHaveCount(0);
});

test("E3: 条件付き項目はチャネルに応じて出し分ける", async ({ page }) => {
  await signIn(page, DEALER_STAFF_USER, PILOT_PASSWORD);
  await gotoForm(page, "/p-appointments/new?type=first-visit");

  // 既定（未選択）では催事種別も対面者も出ない。
  await expect(page.getByLabel("催事種別")).toHaveCount(0);
  await expect(page.getByLabel("対面者")).toHaveCount(0);

  await page.getByLabel("販売チャネル").selectOption("EVENT");
  await expect(page.getByLabel("催事種別")).toBeVisible();
  await expect(page.getByLabel("対面者")).toHaveCount(0);

  await page.getByLabel("販売チャネル").selectOption("VISIT_SALES");
  await expect(page.getByLabel("催事種別")).toHaveCount(0);
  await expect(page.getByLabel("対面者")).toBeVisible();

  // ブース場所の自由記述は「その他」のときだけ。
  await page.getByLabel("催事ブース場所").selectOption("ENTRANCE");
  await expect(page.getByLabel("ブース場所（その他の内容）")).toHaveCount(0);
  await page.getByLabel("催事ブース場所").selectOption("OTHER");
  await expect(page.getByLabel("ブース場所（その他の内容）")).toBeVisible();
});

test("E4: 初訪 / 訪問タブを切り替えられ、URL クエリで保持される", async ({ page }) => {
  await signIn(page, DEALER_STAFF_USER, PILOT_PASSWORD);
  await gotoForm(page, "/p-appointments/new");
  // 既定は初訪アポ。
  await expect(page.getByLabel("お客様名")).toBeVisible();

  await page.getByRole("link", { name: "訪問アポ" }).click();
  await expect(page).toHaveURL(/type=visit/, { timeout: 90_000 });
  await expect(page.getByLabel("クローズ部署")).toBeVisible();
  // 訪問アポフォームに顧客情報は無い。
  await expect(page.getByLabel("お客様名")).toHaveCount(0);

  // 再読み込みしてもタブが維持される。
  await page.reload();
  await expect(page.getByLabel("クローズ部署")).toBeVisible({ timeout: 90_000 });

  await page.getByRole("link", { name: "初訪アポ" }).click();
  await expect(page).toHaveURL(/type=first-visit/, { timeout: 90_000 });
  await expect(page.getByLabel("お客様名")).toBeVisible();
});

test("E5: 訪問アポを登録・確認・編集でき、一覧でアポ区分が分かる", async ({ page }) => {
  await signIn(page, DEALER_STAFF_USER, PILOT_PASSWORD);
  const dept = unique("クローズ課");
  await gotoForm(page, "/p-appointments/new?type=visit");

  // 5 項目すべてが必須。
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 90_000 });

  await page.getByLabel("トス部署").fill("第一営業部");
  await page.getByLabel("マエカク実施者").fill("コール班 佐藤");
  await page.getByLabel("クローズ部署").fill(dept);
  await page.getByLabel("営業担当者").selectOption({ index: 1 });
  await page.getByLabel("販売チャネル").selectOption("VISIT_SALES");
  await page.getByRole("button", { name: "登録する" }).click();

  await expect(page.getByRole("heading", { name: "訪問アポ詳細" })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText(dept)).toBeVisible();
  await expect(page.getByText("コール班 佐藤")).toBeVisible();

  // 編集できる。
  await page.getByRole("link", { name: "編集" }).click();
  await page.getByLabel("トス部署").fill("第二営業部");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("第二営業部")).toBeVisible({ timeout: 90_000 });

  // 一覧にアポ区分が出る。
  await page.goto("/p-appointments", { timeout: 120_000 });
  await expect(page.getByRole("columnheader", { name: "アポ区分" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "訪問アポ" }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "初訪アポ" }).first()).toBeVisible();
});

test("K: 成約を登録・確認・編集できる（9 項目すべて必須）", async ({ page }) => {
  await signIn(page, DEALER_STAFF_USER, PILOT_PASSWORD);
  const branch = unique("取次拠点");
  await gotoForm(page, "/p-contracts/new");

  // 必須が欠けたままでは保存できない。
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 90_000 });

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
  await expect(page.getByText(branch)).toBeVisible();
  await expect(page.getByText("テレアポ")).toBeVisible();

  // 編集できる。
  await page.getByRole("link", { name: "編集" }).click();
  await page.getByLabel("所属部署").fill("不動産事業部");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("不動産事業部")).toBeVisible({ timeout: 90_000 });

  // 一覧に出る。取次拠点は列と、狭い画面用に畳んだ行の両方に出るので列のセルで見る。
  await page.goto("/p-contracts", { timeout: 120_000 });
  await expect(page.getByRole("cell", { name: branch })).toBeVisible({ timeout: 90_000 });
});

test("R: 催事日報の登録画面に加盟店番号が出る", async ({ page }) => {
  await signIn(page, DEALER_STAFF_USER, PILOT_PASSWORD);
  await gotoForm(page, "/p-reports/new");
  await expect(page.getByText(/加盟店番号/)).toBeVisible();
});

test("F: 他社のデータには ID を直接指定しても到達できない", async ({ page }) => {
  // beta 社で日報を 1 件作り、その ID を alpha 社で開けないことを確かめる。
  // 日報は催事を選んで出すので、beta 社担当の催事を用意する。
  const otherTag = unique("F他社");
  execSync(
    `pnpm -F @solar/db exec tsx ../../tests/e2e/fixtures/partner-report-events-fixture.ts "${otherTag}" beta-staff@solar-saas.dev`,
    { cwd: resolve(__dirname, "../.."), stdio: "inherit" },
  );

  await signIn(page, OTHER_DEALER, PILOT_PASSWORD);
  await gotoForm(page, "/p-reports/new");
  await page.getByLabel("対象の催事").selectOption({ label: `2026-02-01 ${otherTag} 会場1` });
  await page.getByLabel("対象の開催日").selectOption({ index: 1 });
  await page.getByLabel("施設内エリア").fill("入口");
  await page.getByLabel("稼働開始時間").fill("10:00");
  await page.getByLabel("稼働終了時間").fill("18:00");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: "催事日報詳細" })).toBeVisible({
    timeout: 90_000,
  });
  const otherReportUrl = page.url();
  const otherReportId = otherReportUrl.split("/").pop()!;

  // 別の二次店でログインし直す。
  await page.goto("/api/auth/signout", { timeout: 120_000 });
  await signIn(page, DEALER_STAFF_USER, PILOT_PASSWORD);

  const res = await page.goto(`/p-reports/${otherReportId}`, { timeout: 120_000 });
  expect(res?.status(), "他社の日報は 404").toBe(404);

  // 一覧にも出ない。
  await page.goto("/p-reports", { timeout: 120_000 });
  await expect(page.getByRole("link", { name: otherReportId })).toHaveCount(0);
});

test("F2: 訪問アポ・成約も他社の ID を直接指定しては開けない", async ({ page }) => {
  // beta 社で訪問アポと成約を 1 件ずつ作り、その ID を alpha 社で開けないことを見る。
  await signIn(page, OTHER_DEALER, PILOT_PASSWORD);

  await gotoForm(page, "/p-appointments/new?type=visit");
  await page.getByLabel("トス部署").fill("他社トス部署");
  await page.getByLabel("マエカク実施者").fill("他社 コール");
  await page.getByLabel("クローズ部署").fill(unique("他社クローズ課"));
  await page.getByLabel("営業担当者").selectOption({ index: 1 });
  await page.getByLabel("販売チャネル").selectOption("INBOUND");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: "訪問アポ詳細" })).toBeVisible({
    timeout: 90_000,
  });
  const otherVisitId = page.url().split("/").pop()!;

  await gotoForm(page, "/p-contracts/new");
  await page.getByLabel("ご契約日").fill("2026-05-10");
  await page.getByLabel("トス日").fill("2026-05-01");
  await page.getByLabel("トス部署").fill("他社トス部署");
  await page.getByLabel("アポ獲得者").fill("他社 獲得");
  await page.getByLabel("営業担当者").fill("他社 営業");
  await page.getByLabel("取次拠点").fill(unique("他社拠点"));
  await page.getByRole("combobox", { name: "所属", exact: true }).selectOption("PS");
  await page.getByLabel("所属部署").fill("他社部署");
  await page.getByLabel("アポ獲得時チャネル").selectOption("REFERRAL");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: "成約詳細" })).toBeVisible({ timeout: 90_000 });
  const otherContractId = page.url().split("/").pop()!;

  // 別の二次店でログインし直す。
  await page.goto("/api/auth/signout", { timeout: 120_000 });
  await signIn(page, DEALER_STAFF_USER, PILOT_PASSWORD);

  const visitRes = await page.goto(`/p-appointments/visit/${otherVisitId}`, { timeout: 120_000 });
  expect(visitRes?.status(), "他社の訪問アポは 404").toBe(404);
  const contractRes = await page.goto(`/p-contracts/${otherContractId}`, { timeout: 120_000 });
  expect(contractRes?.status(), "他社の成約は 404").toBe(404);

  // 一覧にも出ない。
  await page.goto("/p-contracts", { timeout: 120_000 });
  await expect(page.getByRole("link", { name: otherContractId })).toHaveCount(0);
});

test("H: 代理店アカウントは二次店サイトを利用できない", async ({ page }) => {
  await signIn(page, AGENCY_OWNER, DEMO_PASSWORD);
  // 初回はルートのコンパイル待ちが長いので、goto で遷移完了まで待つ。
  await page.goto("/p-home", { timeout: 120_000 });
  // 黙って 404 にせず、サイトを間違えていると分かる案内を出す。
  await expect(page.getByText("このサイトはパートナー会社専用です")).toBeVisible({
    timeout: 90_000,
  });
  // タブも業務画面も出ない。
  await expect(page.getByRole("navigation", { name: "パートナーメニュー" })).toHaveCount(0);
  await page.goto("/p-appointments", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "アポイント一覧" })).toHaveCount(0);
});
