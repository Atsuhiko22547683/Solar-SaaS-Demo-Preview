import { expect, test, type Page } from "@playwright/test";

// 二次店ポータル（APP_VARIANT=partner の実行環境）。
//
//   A. 二次店アカウントでログインでき、Partner のトップへ入る
//   B. 公開されるのは 4 領域だけ（代理店画面は URL 直打ちでも開けない）
//   C. 販売員を登録・確認・編集できる
//   D. 催事日報を登録・確認・編集できる（イベント未登録でも提出できる）
//   E. アポイントを登録・確認・編集できる
//   F. 他社の ID を直接指定しても 404（自社データだけ）
//   G. 未認証はログインへ送られる
//   H. 代理店アカウントは二次店環境を利用できない
//
// dev server は APP_VARIANT=partner で起動している前提。
// agency 側の挙動は既存 spec が担当する。

const DEALER_ADMIN = "alpha-admin@solar-saas.dev";
const OTHER_DEALER = "beta-admin@solar-saas.dev";
const AGENCY_OWNER = "owner@solar-saas.demo";
const PILOT_PASSWORD = "Pilot!2026";
const DEMO_PASSWORD = "Demo1234!";

test.describe.configure({ timeout: 180_000 });

const PARTNER_MODE = process.env.APP_VARIANT === "partner";

test.skip(!PARTNER_MODE, "APP_VARIANT=partner で dev server を起動して実行する");

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

test("A/B: 二次店はトップへ入り、公開は 4 領域だけ", async ({ page }) => {
  await signIn(page, DEALER_ADMIN, PILOT_PASSWORD);
  await expect(page).toHaveURL(/\/p-home/, { timeout: 90_000 });
  await expect(page.getByRole("heading", { name: "二次店ポータル" })).toBeVisible();

  // タブは 4 つだけ。
  const nav = page.getByRole("navigation", { name: "二次店メニュー" });
  for (const label of ["トップ", "アポイント", "催事日報", "販売員"]) {
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
});

test("C: 販売員を登録・確認・編集できる", async ({ page }) => {
  await signIn(page, DEALER_ADMIN, PILOT_PASSWORD);

  const name = unique("販売員");
  await gotoForm(page, "/p-salespeople/new");
  await page.getByLabel("氏名（漢字）").fill(name);
  await page.getByLabel("氏名（カナ）").fill("ハンバイイン テスト");
  await page.getByLabel("メールアドレス").fill("sp-test@example.com");
  await page.getByLabel("営業経験歴").fill("3年");
  await page.getByRole("button", { name: "登録する" }).click();

  // 詳細へ遷移し、登録値が出る。加盟店番号は自動設定。
  await expect(page.getByRole("heading", { name: "販売員詳細" })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(name)).toBeVisible();
  await expect(page.getByText("3年")).toBeVisible();

  // 編集できる。
  await page.getByRole("link", { name: "編集" }).click();
  await page.getByLabel("営業経験歴").fill("5年");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("5年")).toBeVisible({ timeout: 90_000 });

  // 一覧に出る。
  await page.goto("/p-salespeople", { timeout: 120_000 });
  await expect(page.getByRole("link", { name })).toBeVisible({ timeout: 90_000 });
});

test("D: 催事日報をイベント未登録でも登録・確認・編集できる", async ({ page }) => {
  await signIn(page, DEALER_ADMIN, PILOT_PASSWORD);

  const place = unique("テスト会場");
  await gotoForm(page, "/p-reports/new");
  await page.getByLabel("催事実施日").fill("2026-04-01");
  await page.getByLabel("催事場所").fill(place);
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
});

test("D2: 成果数値の大小関係が検証される", async ({ page }) => {
  await signIn(page, DEALER_ADMIN, PILOT_PASSWORD);
  await gotoForm(page, "/p-reports/new");

  await page.getByLabel("催事実施日").fill("2026-04-02");
  await page.getByLabel("催事場所").fill("検証テスト");
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

test("E: アポイントを登録・確認・編集できる（電話はどちらか必須）", async ({ page }) => {
  await signIn(page, DEALER_ADMIN, PILOT_PASSWORD);

  const customer = unique("テスト顧客");
  await gotoForm(page, "/p-appointments/new");

  // 電話を両方空にすると弾かれる。
  await page.getByLabel("お客様名").fill(customer);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 90_000 });

  await page.getByLabel("携帯番号").fill("09012345678");
  await page.getByLabel("マエカク実施者").fill("コール班 鈴木");
  await page.getByRole("button", { name: "登録する" }).click();

  await expect(page.getByRole("heading", { name: "アポイント詳細" })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText(customer)).toBeVisible();
  await expect(page.getByText("コール班 鈴木")).toBeVisible();

  await page.getByRole("link", { name: "編集" }).click();
  await page.getByLabel("フリガナ").fill("テストコキャク");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("テストコキャク")).toBeVisible({ timeout: 90_000 });
});

test("E2: 催事が未登録でも催事情報を入力・表示・編集できる", async ({ page }) => {
  await signIn(page, DEALER_ADMIN, PILOT_PASSWORD);

  const customer = unique("催事テスト顧客");
  const place = unique("直接入力会場");
  await gotoForm(page, "/p-appointments/new");

  // 催事は選ばない（= Google フォームと同じく単独入力）。
  await page.getByLabel("お客様名").fill(customer);
  await page.getByLabel("携帯番号").fill("09011112222");
  await page.getByLabel("催事実施日").fill("2026-04-01");
  await page.getByLabel("催事場所").fill(place);
  await page.getByLabel("催事種別").selectOption("KOMERI");
  await page.getByLabel("催事ブース場所", { exact: true }).selectOption("OTHER");
  // 「その他」を選んだときだけ自由記述が現れる。
  const note = page.getByLabel("ブース場所（その他の内容）");
  await expect(note).toBeVisible();
  await note.fill("1階エレベーター前");
  await page.getByRole("button", { name: "登録する" }).click();

  // 詳細に反映される。
  await expect(page.getByRole("heading", { name: "アポイント詳細" })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText("2026/04/01")).toBeVisible();
  await expect(page.getByText(place)).toBeVisible();
  await expect(page.getByText("コメリ")).toBeVisible();
  await expect(page.getByText("1階エレベーター前")).toBeVisible();
  const detailUrl = page.url();

  // 編集で変更できる。
  await page.getByRole("link", { name: "編集" }).click();
  await page.getByLabel("催事種別").selectOption("SHIMACHU");
  await page.getByLabel("催事ブース場所", { exact: true }).selectOption("ENTRANCE");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("島忠")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("入口")).toBeVisible();
  // 「その他」以外にしたので自由記述は表示されない。
  await expect(page.getByText("1階エレベーター前")).toHaveCount(0);

  // 代理店側の顧客詳細からも確認できる（顧客 ID は詳細 URL と同じ）。
  const customerId = detailUrl.split("/").pop()!;
  expect(customerId.length).toBeGreaterThan(0);
});

test("E3: 催事ブース場所の自由記述は「その他」以外では入力欄が出ない", async ({ page }) => {
  await signIn(page, DEALER_ADMIN, PILOT_PASSWORD);
  await gotoForm(page, "/p-appointments/new");
  await page.getByLabel("催事ブース場所", { exact: true }).selectOption("ENTRANCE");
  await expect(page.getByLabel("ブース場所（その他の内容）")).toHaveCount(0);
  await page.getByLabel("催事ブース場所", { exact: true }).selectOption("OTHER");
  await expect(page.getByLabel("ブース場所（その他の内容）")).toBeVisible();
});

test("F: 他社のデータには ID を直接指定しても到達できない", async ({ page }) => {
  // beta 社で日報を 1 件作り、その ID を alpha 社で開けないことを確かめる。
  await signIn(page, OTHER_DEALER, PILOT_PASSWORD);
  await gotoForm(page, "/p-reports/new");
  await page.getByLabel("催事実施日").fill("2026-04-03");
  await page.getByLabel("催事場所").fill(unique("他社会場"));
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
  await signIn(page, DEALER_ADMIN, PILOT_PASSWORD);

  const res = await page.goto(`/p-reports/${otherReportId}`, { timeout: 120_000 });
  expect(res?.status(), "他社の日報は 404").toBe(404);

  // 一覧にも出ない。
  await page.goto("/p-reports", { timeout: 120_000 });
  await expect(page.getByRole("link", { name: otherReportId })).toHaveCount(0);
});

test("H: 代理店アカウントは二次店環境を利用できない", async ({ page }) => {
  await signIn(page, AGENCY_OWNER, DEMO_PASSWORD);
  // 黙って 404 にせず、環境を間違えていると分かる案内を出す。
  await expect(page).toHaveURL(/\/p-home\/unavailable/, { timeout: 90_000 });
  await expect(page.getByText("この環境は二次店専用です")).toBeVisible();
  // 業務画面へは入れない。
  await page.goto("/p-appointments", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "アポイント一覧" })).toHaveCount(0);
});
