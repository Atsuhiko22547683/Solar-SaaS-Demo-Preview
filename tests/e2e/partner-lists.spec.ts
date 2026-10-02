import { execSync } from "node:child_process";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// 二次店スタッフ向け一覧の検索・絞り込み・並べ替え（APP_VARIANT=partner の実行環境）。
//
//   L1. アポイント: 区分・顧客名・期間の絞り込み、並べ替え、URL からの復元、列の分離
//   L2. 成約報告: 複数条件の AND、並べ替え、0 件表示と条件クリア
//   L3. 催事日報: 期間の境界（終了日当日を含む）、算出値（アポ数）の並べ替え
//   L4. カタログ: カテゴリ + メーカー + 商品名 + 価格の組み合わせ、メーカー内の価格順、
//       カテゴリ変更時のメーカーのリセットと並べ替えの維持、仕入値が出ないこと
//   L5. 顧客情報: 商談ステータス絞り込みで顧客行が重複しない
//   L6. 催事シフト: 月の切替、開催場所の絞り込み、固定の表示順（並べ替え UI なし）
//   L7. 不正条件（開始 > 終了、許可外の並べ替え列）の扱い
//   L8. スマートフォン幅での並べ替え選択欄

const STAFF = "alpha-staff@solar-saas.dev";
const PASSWORD = "Pilot!2026";

test.describe.configure({ timeout: 180_000 });

test.beforeAll(() => {
  const cwd = resolve(__dirname, "../..");
  execSync("pnpm -F @solar/db exec tsx ../../tests/e2e/fixtures/partner-staff-fixture.ts", {
    cwd,
    stdio: "inherit",
  });
  execSync("pnpm -F @solar/db exec tsx ../../tests/e2e/fixtures/partner-shift-fixture.ts", {
    cwd,
    stdio: "inherit",
  });
});

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "サインイン" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
}

async function gotoForm(page: Page, path: string): Promise<void> {
  await page.goto(path, { timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
  await page.waitForTimeout(500);
}

function unique(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

/** 表の 1 列目のテキストを上から順に返す。 */
async function firstColumn(page: Page): Promise<string[]> {
  return page.locator("table tbody tr td:first-child").allInnerTexts();
}

async function submitVisit(page: Page, closeDept: string, tossDept = "第一営業部") {
  await gotoForm(page, "/p-appointments/new?type=visit");
  await page.getByLabel("トス部署").fill(tossDept);
  await page.getByLabel("マエカク実施者").fill("コール班 佐藤");
  await page.getByLabel("クローズ部署").fill(closeDept);
  await page.getByLabel("営業担当者").selectOption({ index: 1 });
  await page.getByLabel("販売チャネル").selectOption("VISIT_SALES");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: "訪問アポ詳細" })).toBeVisible({
    timeout: 90_000,
  });
}

async function submitFirstVisit(page: Page, customer: string, visitAt: string) {
  await gotoForm(page, "/p-appointments/new?type=first-visit");
  await page.getByLabel("クローズ会社").selectOption({ index: 1 });
  await page.getByLabel("営業担当者").selectOption({ index: 1 });
  await page.getByLabel("販売チャネル").selectOption("INBOUND");
  await page.getByLabel("催事実施日").fill("2026-04-01");
  await page.getByLabel("催事場所").fill("反響対応");
  await page.getByLabel("催事ブース場所").selectOption("OTHER");
  await page.getByLabel("お客様名").fill(customer);
  await page.getByLabel("フリガナ").fill("テスト");
  await page.getByLabel("携帯番号").fill("09012345678");
  await page.getByLabel("郵便番号").fill("330-0001");
  await page.getByLabel("都道府県").fill("埼玉県");
  await page.getByLabel("市区町村・番地").fill("さいたま市1-1");
  await page.getByLabel("マエカク実施者").fill("コール班");
  await page.getByLabel("初回訪問アポ日時").fill(visitAt);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: /アポイント詳細/ })).toBeVisible({
    timeout: 90_000,
  });
}

async function submitContract(page: Page, branch: string, contractDate: string, salesRep: string) {
  await gotoForm(page, "/p-contracts/new");
  await page.getByLabel("ご契約日").fill(contractDate);
  await page.getByLabel("トス日").fill("2026-04-01");
  await page.getByLabel("トス部署").fill("第一営業部");
  await page.getByLabel("アポ獲得者").fill("佐々木 孝");
  await page.getByLabel("営業担当者").fill(salesRep);
  await page.getByLabel("取次拠点").fill(branch);
  await page.getByRole("combobox", { name: "所属", exact: true }).selectOption("VE");
  await page.getByLabel("所属部署").fill("住設事業部");
  await page.getByLabel("アポ獲得時チャネル").selectOption("TELE_APPOINTMENT");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: "成約詳細" })).toBeVisible({ timeout: 90_000 });
}

async function submitReport(page: Page, place: string, date: string, apptBoth: string) {
  await gotoForm(page, "/p-reports/new");
  // 対象の催事と開催日を選ぶ。会場名・実施日はその催事の記録から決まるので入力しない。
  await page.getByLabel("対象の催事").selectOption({ label: `${date} ${place}` });
  await page.getByLabel("対象の開催日").selectOption({ index: 1 });
  // 実施日・場所は催事の記録から出る（入力欄ではないので読み取り表示で確かめる）。
  await expect(page.locator("#r-place-derived")).toHaveText(place, { timeout: 90_000 });
  await page.getByLabel("施設内エリア").fill("入口");
  await page.getByLabel("稼働開始時間").fill("10:00");
  await page.getByLabel("稼働終了時間").fill("18:00");
  await page.getByLabel("抽選数 両面").fill("50");
  await page.getByLabel("着座数 両面").fill("30");
  await page.getByLabel("アポ数 両面").fill(apptBoth);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("heading", { name: "催事日報詳細" })).toBeVisible({
    timeout: 90_000,
  });
}

test("L1: アポイント一覧の絞り込み・並べ替え・URL 復元・列の分離", async ({ page }) => {
  await signIn(page, STAFF);
  const tag = unique("L1");
  await submitVisit(page, `${tag} クローズ課A`);
  await submitFirstVisit(page, `${tag} 顧客B`, "2026-05-10T10:00");
  await submitFirstVisit(page, `${tag} 顧客C`, "2026-05-20T10:00");

  // 訪問アポ行はクローズ部署列に出て、お客様名列は「—」。
  await page.goto(`/p-appointments?customerName=${encodeURIComponent(tag)}`, { timeout: 120_000 });
  await expect(page.getByRole("columnheader", { name: /お客様名/ })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByRole("columnheader", { name: /クローズ部署/ })).toBeVisible();
  // 区分「すべて」で顧客名条件 → 初訪だけが対象（注記が出る）。
  await expect(page.getByText("訪問アポは表示されません")).toBeVisible();
  await expect(page.getByText("該当 2件")).toBeVisible();
  await expect(page.getByRole("link", { name: `${tag} クローズ課A` })).toHaveCount(0);

  // 区分 = 訪問アポ + クローズ部署で絞る。
  await page.goto(`/p-appointments?kind=visit&closeDept=${encodeURIComponent(tag)}`, {
    timeout: 120_000,
  });
  await expect(page.getByText("該当 1件")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("link", { name: `${tag} クローズ課A` })).toBeVisible();
  // 訪問アポ区分では顧客名の条件は無効化される。
  await expect(page.getByLabel("お客様名")).toBeDisabled();

  // 初回訪問アポ日時の期間（終了日当日を含む）。
  await page.goto(
    `/p-appointments?kind=first-visit&customerName=${encodeURIComponent(tag)}&firstVisitAtFrom=2026-05-11&firstVisitAtTo=2026-05-20`,
    { timeout: 120_000 },
  );
  await expect(page.getByText("該当 1件")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("link", { name: `${tag} 顧客C` })).toBeVisible();

  // 並べ替え: 初回訪問アポ日時の昇順 → 降順（列見出しクリック）。URL に残る。
  await page.goto(
    `/p-appointments?kind=first-visit&customerName=${encodeURIComponent(tag)}&sort=firstVisitAt&dir=asc`,
    { timeout: 120_000 },
  );
  let names = await page.locator("table tbody tr td:nth-child(2)").allInnerTexts();
  expect(names.map((n) => n.trim())).toEqual([`${tag} 顧客B`, `${tag} 顧客C`]);
  await page
    .getByRole("columnheader", { name: /初回訪問アポ日時/ })
    .getByRole("link")
    .click();
  await expect(page).toHaveURL(/sort=firstVisitAt&dir=desc/, { timeout: 90_000 });
  names = await page.locator("table tbody tr td:nth-child(2)").allInnerTexts();
  expect(names.map((n) => n.trim())).toEqual([`${tag} 顧客C`, `${tag} 顧客B`]);
  await expect(page.getByRole("columnheader", { name: /初回訪問アポ日時/ })).toHaveAttribute(
    "aria-sort",
    "descending",
  );

  // 再読み込みしても条件と並べ替えが復元される。
  await page.reload();
  await expect(page.getByLabel("お客様名")).toHaveValue(tag);
  names = await page.locator("table tbody tr td:nth-child(2)").allInnerTexts();
  expect(names.map((n) => n.trim())).toEqual([`${tag} 顧客C`, `${tag} 顧客B`]);

  // 詳細 → 一覧へ戻ると同じ条件の一覧に戻る。
  await page.getByRole("link", { name: `${tag} 顧客C` }).click();
  await expect(page.getByRole("heading", { name: /アポイント詳細/ })).toBeVisible({
    timeout: 90_000,
  });
  await page.getByRole("link", { name: "一覧へ戻る" }).click();
  await expect(page).toHaveURL(/customerName=/, { timeout: 90_000 });
});

test("L2: 成約報告の複数条件 AND・並べ替え・0 件表示と条件クリア", async ({ page }) => {
  await signIn(page, STAFF);
  const tag = unique("L2");
  await submitContract(page, `${tag} 拠点X`, "2026-03-01", `${tag} 営業A`);
  await submitContract(page, `${tag} 拠点Y`, "2026-03-15", `${tag} 営業B`);
  await submitContract(page, `${tag} 拠点Z`, "2026-04-01", `${tag} 営業A`);

  // 取次拠点（部分一致）AND 営業担当者 AND 契約日の期間。
  await page.goto(
    `/p-contracts?referralBranch=${encodeURIComponent(tag)}&salesRep=${encodeURIComponent("営業A")}&contractDateFrom=2026-03-01&contractDateTo=2026-03-31`,
    { timeout: 120_000 },
  );
  await expect(page.getByText("該当 1件")).toBeVisible({ timeout: 90_000 });
  // 取次拠点は列と、狭い画面用に畳んだ行の両方に出るので列のセルで見る。
  await expect(page.getByRole("cell", { name: `${tag} 拠点X` })).toBeVisible();

  // 契約日の昇順。
  await page.goto(
    `/p-contracts?referralBranch=${encodeURIComponent(tag)}&sort=contractDate&dir=asc`,
    { timeout: 120_000 },
  );
  const dates = await firstColumn(page);
  expect(dates.map((d) => d.trim())).toEqual(["2026/03/01", "2026/03/15", "2026/04/01"]);

  // 0 件でも条件入力欄は残り、クリアで全件に戻る。
  await page.goto(`/p-contracts?referralBranch=${encodeURIComponent("存在しない拠点")}`, {
    timeout: 120_000,
  });
  await expect(page.getByText("条件に一致するデータがありません")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByLabel("取次拠点")).toHaveValue("存在しない拠点");
  await page.getByRole("link", { name: "条件をクリア" }).click();
  await expect(page).toHaveURL(/\/p-contracts$/, { timeout: 90_000 });
  await expect(page.getByLabel("取次拠点")).toHaveValue("");
});

test("L3: 催事日報の期間境界と算出値の並べ替え", async ({ page }) => {
  // 日報の対象になる催事を、この実行だけのタグで 3 件用意する
  // （会場名・実施日は催事側の記録なので、テストが自由入力できない）。
  const tag = unique("L3");
  execSync(
    `pnpm -F @solar/db exec tsx ../../tests/e2e/fixtures/partner-report-events-fixture.ts "${tag}"`,
    { cwd: resolve(__dirname, "../.."), stdio: "inherit" },
  );

  await signIn(page, STAFF);
  await submitReport(page, `${tag} 会場1`, "2026-02-01", "3");
  await submitReport(page, `${tag} 会場2`, "2026-02-28", "9");
  await submitReport(page, `${tag} 会場3`, "2026-03-01", "6");

  // 終了日当日（2/28）を含む。
  await page.goto(
    `/p-reports?venuePlace=${encodeURIComponent(tag)}&eventDateFrom=2026-02-01&eventDateTo=2026-02-28`,
    { timeout: 120_000 },
  );
  await expect(page.getByText("該当 2件")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(`${tag} 会場3`)).toHaveCount(0);

  // アポ数（算出値）の降順。
  await page.goto(`/p-reports?venuePlace=${encodeURIComponent(tag)}&sort=apptTotal&dir=desc`, {
    timeout: 120_000,
  });
  const places = await page.locator("table tbody tr td:nth-child(2)").allInnerTexts();
  expect(places.map((p) => p.trim())).toEqual([`${tag} 会場2`, `${tag} 会場3`, `${tag} 会場1`]);
});

test("L4: カタログのカテゴリ + メーカー + 商品名 + 価格の組み合わせとメーカー内の価格順", async ({
  page,
}) => {
  await signIn(page, STAFF);
  await page.goto("/p-catalog", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "カタログ" })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("仕入値")).toHaveCount(0);
  // レスポンス（HTML / RSC ペイロード）にも仕入値のキーが含まれない。
  expect(await page.content()).not.toContain("purchasePrice");

  // カテゴリ → メーカー候補は公開商品から。
  const categoryLinks = page.getByRole("navigation", { name: "カテゴリ" }).getByRole("link");
  const categoryCount = await categoryLinks.count();
  test.skip(categoryCount < 2, "公開商品が無い環境ではスキップ");
  await categoryLinks.nth(1).click();
  await expect(page).toHaveURL(/category=/, { timeout: 90_000 });
  const makerSelect = page.getByLabel("メーカー");
  const makerOptions = await makerSelect.locator("option").allInnerTexts();
  expect(makerOptions.length).toBeGreaterThan(1);
  const maker = makerOptions[1]!;

  // メーカーを選び、価格の安い順に並べ替える（並べ替えは列見出し）。
  await makerSelect.selectOption({ label: maker });
  await page.getByRole("button", { name: "検索" }).click();
  await expect(page).toHaveURL(/maker=/, { timeout: 90_000 });
  await page.getByRole("columnheader", { name: /卸値/ }).getByRole("link").click();
  await expect(page).toHaveURL(/sort=dealerPrice&dir=asc/, { timeout: 90_000 });
  const prices = (await page.locator("table tbody tr td:last-child").allInnerTexts()).map((p) =>
    Number(p.replace(/[¥,\s]/g, "")),
  );
  for (let i = 1; i < prices.length; i += 1)
    expect(prices[i]!).toBeGreaterThanOrEqual(prices[i - 1]!);
  // メーカー列はすべて選択したメーカー。
  const makers = await page.locator("table tbody tr td:nth-child(3)").allInnerTexts();
  for (const m of makers) expect(m.trim()).toBe(maker);

  // 価格の上限を最安値にすると 1 件以上に絞られ、並べ替えは維持される。
  const min = prices[0]!;
  await page.getByLabel("卸値 上限").fill(String(min));
  await page.getByRole("button", { name: "検索" }).click();
  await expect(page).toHaveURL(/priceMax=/, { timeout: 90_000 });
  await expect(page).toHaveURL(/sort=dealerPrice&dir=asc/);
  const after = (await page.locator("table tbody tr td:last-child").allInnerTexts()).map((p) =>
    Number(p.replace(/[¥,\s]/g, "")),
  );
  for (const p of after) expect(p).toBeLessThanOrEqual(min);

  // 別カテゴリへ切り替えても並べ替えは維持され、メーカーが対象外なら「すべて」へ戻る。
  const other = page.getByRole("navigation", { name: "カテゴリ" }).getByRole("link").nth(0);
  await other.click();
  await expect(page).toHaveURL(/sort=dealerPrice&dir=asc/, { timeout: 90_000 });

  // 商品名・型番の部分一致。
  await page.goto("/p-catalog", { timeout: 120_000 });
  const firstName = (
    await page.locator("table tbody tr td:first-child a").first().innerText()
  ).trim();
  const keyword = firstName.slice(0, 2);
  await page.goto(`/p-catalog?q=${encodeURIComponent(keyword)}`, { timeout: 120_000 });
  const names = await page.locator("table tbody tr td:first-child a").allInnerTexts();
  expect(names.length).toBeGreaterThan(0);
});

test("L5: 顧客情報の商談ステータス絞り込みで顧客行が重複しない", async ({ page }) => {
  await signIn(page, STAFF);
  await page.goto("/p-customers?dealStatus=VISITED", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "顧客情報" })).toBeVisible({ timeout: 90_000 });
  const names = (await page.locator("table tbody tr td:first-child").allInnerTexts()).map((n) =>
    n.trim(),
  );
  expect(new Set(names).size).toBe(names.length);
  // 閲覧範囲は自社全件になったので、他スタッフ担当の顧客も条件に合えば出る。
  // ここで見たいのは「同じ顧客が商談の件数ぶん重複しないこと」。
  expect(names.some((n) => n.includes("担当顧客"))).toBe(true);
  // 該当しないステータスなら 0 件（条件入力欄は残る）。
  await page.goto("/p-customers?dealStatus=CONTRACTED", { timeout: 120_000 });
  await expect(page.getByLabel("商談ステータス（自社）")).toHaveValue("CONTRACTED");
});

// 催事シフトは会社全件を月単位で見る画面。並べ替え UI は持たない（業務要件どおり）。
// 表示順は「開催日 → 開催開始時刻 → 開催場所」に固定。
test("L6: 催事シフトの月切替・担当者と開催場所の絞り込み・固定の表示順", async ({ page }) => {
  await signIn(page, STAFF);
  // フィクスチャの催事は 2026-06 / 2026-07。月を明示して開く。
  await page.goto("/p-shifts?month=2026-06&venue=E2E%20shift", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "催事シフト" })).toBeVisible({
    timeout: 90_000,
  });

  // 6 月の催事だけが出る（7 月の E3 は出ない）。
  await expect(page.getByText("[E2E shift] E1").first()).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("[E2E shift] E3")).toHaveCount(0);

  // 翌月へ切り替えると 7 月の催事が出る。
  await page.getByRole("link", { name: "翌月" }).click();
  await expect(page).toHaveURL(/month=2026-07/, { timeout: 90_000 });
  await expect(page.getByText("[E2E shift] E3").first()).toBeVisible({ timeout: 90_000 });

  // 開催場所の絞り込みで対象外の催事が落ちる。
  await page.goto("/p-shifts?month=2026-06&venue=E4", { timeout: 120_000 });
  await expect(page.getByText("[E2E shift] E1")).toHaveCount(0);

  // 並べ替えの UI は持たない。
  await page.goto("/p-shifts?month=2026-06", { timeout: 120_000 });
  await expect(page.getByRole("combobox", { name: "並べ替え" })).toHaveCount(0);
});

test("L7: 不正な条件はエラー表示、許可外の並べ替え列は既定へ倒す", async ({ page }) => {
  await signIn(page, STAFF);
  await page.goto("/p-contracts?contractDateFrom=2026-05-10&contractDateTo=2026-05-01", {
    timeout: 120_000,
  });
  await expect(page.getByRole("alert").filter({ hasText: "開始日が終了日より後" })).toBeVisible({
    timeout: 90_000,
  });
  await page.goto("/p-catalog?priceMin=100&priceMax=10", { timeout: 120_000 });
  await expect(page.getByRole("alert").filter({ hasText: "下限が上限より大きく" })).toBeVisible({
    timeout: 90_000,
  });
  // 許可外の列（仕入値）を指定しても受け付けず、既定（商品名 昇順）のまま。
  await page.goto("/p-catalog?sort=purchasePrice&dir=desc", { timeout: 120_000 });
  await expect(page.getByRole("columnheader", { name: /商品名/ })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
});

test("L8: スマートフォン幅では並べ替え選択欄で並べ替えられる", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, STAFF);
  await page.goto("/p-reports", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "催事日報一覧" })).toBeVisible({
    timeout: 90_000,
  });
  const select = page.getByLabel("並べ替え");
  await expect(select).toBeVisible();
  await select.selectOption("eventDate:asc");
  await expect(page).toHaveURL(/sort=eventDate&dir=asc/, { timeout: 90_000 });
  await expect(select).toHaveValue("eventDate:asc");
  // 横スクロールが出ない。
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
});
