// パートナー業務の一気通貫フローの検証。
//
// 前提は「**代理店 1 社 × 複数パートナー会社**」。複数代理店からの受注・代理店切替・
// 代理店をまたぐ配置は対象外。スタッフの時間重複は、同じ代理店が主催する複数催事で確認する。
//
// 対象サイト:
//   staff プロジェクト … http://localhost:3200（パートナースタッフ）
//   admin プロジェクト … http://localhost:3300（パートナー管理者）
//
// テストデータは prisma/seed-demo-single-agency.ts が投入した "[DEMO]" 付きの行。
// 催事は「今日」に 2 件（時間が重なる）あり、当月・翌月にも用意されている。
//
// expect には明示的な timeout を付ける。dev サーバーは初回アクセスでルートを
// コンパイルするため、既定の 5 秒では足りずに落ちることがある。

import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ timeout: 240_000 });

const T = 90_000;
const PASSWORD = "Pilot!2026";
const ADMIN = "alpha-admin@solar-saas.dev";
const STAFF = "alpha-staff@solar-saas.dev";
/** 別のパートナー会社（会社境界の確認用）。 */
const OTHER_ADMIN = "demo-b-admin@solar-saas.dev";

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "サインイン" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
}

/** 当月 'YYYY-MM'（デモデータと同じ算出）。 */
function thisMonth(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}
/** 翌月。出店希望・相談はこちら（基本シードが当月の明細を入れ替えるため）。 */
function nextMonth(): string {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth() + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// パートナー管理者サイト
// ---------------------------------------------------------------------------
test.describe("パートナー管理者サイト", () => {
  test.skip(() => test.info().project.name !== "admin", "管理者サイト専用");

  test("① 2 レーン・順位付き・複数日程・個別条件の提出を確認できる", async ({ page }) => {
    await signIn(page, ADMIN);
    await page.goto("/p-lane-preferences", { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "出店希望" })).toBeVisible({ timeout: T });

    await page.getByRole("link", { name: nextMonth() }).first().click();
    await page.waitForURL(
      (u) => u.pathname.startsWith("/p-lane-preferences/") && !u.pathname.endsWith("/new"),
      { timeout: T },
    );

    await expect(page.getByRole("heading", { name: "1レーン目" })).toBeVisible({ timeout: T });
    await expect(page.getByRole("heading", { name: "2レーン目" })).toBeVisible({ timeout: T });
    // 店舗名は回答本文や確定済み催事名にも出るので、明細の完全一致で見る。
    await expect(page.getByText("前橋みなみモール店", { exact: true })).toBeVisible({
      timeout: T,
    });
    await expect(page.getByText("沼津店", { exact: true })).toBeVisible({ timeout: T });
    // 個別条件は希望順位とは別に出る（第四希望へ読み替えていない）。
    await expect(page.getByText(/個別条件.*いずれか 2 日間を希望/)).toBeVisible({ timeout: T });
    await expect(page.getByText(/希望日程:/).first()).toBeVisible({ timeout: T });
  });

  test("② 代理店の回答と確定した開催が同じ画面で確認できる", async ({ page }) => {
    await signIn(page, ADMIN);
    await page.goto("/p-lane-preferences", { timeout: 120_000 });
    await page.getByRole("link", { name: nextMonth() }).first().click();
    await page.waitForURL(
      (u) => u.pathname.startsWith("/p-lane-preferences/") && !u.pathname.endsWith("/new"),
      { timeout: T },
    );

    await expect(page.getByRole("heading", { name: "代理店とのやり取り" })).toBeVisible({
      timeout: T,
    });
    // 提出の記録と代理店の回答が残っている。
    await expect(page.getByText("提出").first()).toBeVisible({ timeout: T });
    // 正規表現にすると "[DEMO]" が文字クラスとして解釈されるので、文字列で指定する。
    await expect(
      page.getByText(
        "[DEMO] 1 レーン目は前橋みなみモール店で確保できました。2 レーン目は調整中です。",
      ),
    ).toBeVisible({ timeout: T });
    // 確定した開催（同じ対象月・同じ代理店）。
    await expect(page.getByRole("heading", { name: "確定した開催" })).toBeVisible({ timeout: T });
    await expect(page.getByText("[DEMO] 前橋みなみモール店")).toBeVisible({ timeout: T });
  });

  test("③ 提出フォームに代理店の選択欄は無く、依頼先が読み取り専用で出る", async ({ page }) => {
    await signIn(page, ADMIN);
    await page.goto("/p-lane-preferences/new", { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "希望を提出する" })).toBeVisible({ timeout: T });
    // 依頼先代理店は表示のみ（select は出さない）。
    await expect(page.getByText("依頼先代理店")).toBeVisible({ timeout: T });
    await expect(page.getByRole("combobox", { name: "依頼先代理店" })).toHaveCount(0);
    await expect(page.getByText("株式会社サンライズソーラー").first()).toBeVisible({ timeout: T });
  });

  test("④ 場所確保の相談と返信を確認できる", async ({ page }) => {
    await signIn(page, ADMIN);
    await page.goto("/p-consultations", { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "場所確保の相談" })).toBeVisible({ timeout: T });
    await expect(page.getByRole("cell", { name: "群馬県東部", exact: true }).first()).toBeVisible({
      timeout: T,
    });
    // 正規表現にすると "[DEMO]" が文字クラスとして解釈されるので、文字列で指定する。
    await page
      .getByRole("link", { name: "[DEMO] 群馬県東部でのブース確保のご相談" })
      .first()
      .click();
    await page.waitForURL((u) => u.pathname.startsWith("/p-consultations/"), { timeout: T });
    await expect(
      page.getByText("[DEMO] 太田の店舗に打診しました。来週中に回答します。"),
    ).toBeVisible({ timeout: T });
  });

  test("⑤ 催事シフトを一覧とカレンダーで見られ、月を切り替えられる", async ({ page }) => {
    await signIn(page, ADMIN);
    await page.goto("/p-shifts", { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "催事シフト" })).toBeVisible({ timeout: T });
    // 今日の催事が当月表示に出る。
    await expect(page.getByText("[DEMO] カインズ 大宮店").first()).toBeVisible({ timeout: T });

    await page.getByRole("link", { name: "カレンダー" }).click();
    await page.waitForURL(/view=calendar/, { timeout: T });
    await expect(page.getByRole("grid", { name: "カレンダー" })).toBeVisible({ timeout: T });

    await page.getByRole("link", { name: "翌月" }).click();
    await expect(page).toHaveURL(/month=/, { timeout: T });
  });

  test("⑥ 予定時間を残したまま実績時間が記録されている", async ({ page }) => {
    await signIn(page, ADMIN);
    await page.goto("/p-shifts", { timeout: 120_000 });
    await expect(page.getByText(/予定 10:00〜18:00/).first()).toBeVisible({ timeout: T });
    // 実績は別に表示される（予定は上書きされない）。
    await page.getByRole("link", { name: "翌月" }).click();
    await expect(page.getByText(/実績 11:00〜17:00/).first()).toBeVisible({ timeout: T });
  });

  test("⑦ 配置画面で、時間が重なるスタッフを選べない（同じ代理店の 2 催事）", async ({ page }) => {
    await signIn(page, ADMIN);
    await page.goto(`/p-shifts/assign?month=${thisMonth()}`, { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "スタッフを配置する" })).toBeVisible({
      timeout: T,
    });
    // 対象を選ぶまではスタッフを選ばせない。
    await expect(page.getByText("先に対象の催事・開催日を選んでください")).toBeVisible({
      timeout: T,
    });

    // 今日の 2 件目（ベイシア 川越店）を選ぶ。1 件目に入っているスタッフは選べなくなる。
    const target = page
      .getByRole("listitem")
      .filter({ hasText: "[DEMO] ベイシア 川越店" })
      .getByRole("checkbox")
      .first();
    await target.check();
    await expect(page.getByText("配置するスタッフ")).toBeVisible({ timeout: T });
    // 加藤 健太 は同じ時間帯にカインズ大宮店へ入っているので選べない。
    const busy = page
      .getByRole("listitem")
      .filter({ hasText: "加藤 健太" })
      .getByRole("checkbox")
      .first();
    await expect(busy).toBeDisabled({ timeout: T });
    await expect(page.getByText("（同時刻に別の催事へ配置済み）").first()).toBeVisible({
      timeout: T,
    });
  });

  test("⑧ ゲストスタッフを区別して扱える", async ({ page }) => {
    await signIn(page, ADMIN);
    await page.goto("/p-salespeople", { timeout: 120_000 });
    await expect(page.getByRole("link", { name: "[DEMO] 来栖 ゲスト" })).toBeVisible({
      timeout: T,
    });
  });

  test("⑨ 別のパートナー会社のデータは見えない（会社境界）", async ({ page }) => {
    await signIn(page, OTHER_ADMIN);
    await page.goto("/p-shifts", { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "催事シフト" })).toBeVisible({ timeout: T });
    // A 社担当の催事は出ない。B 社担当の催事だけ出る。
    await expect(page.getByText("[DEMO] カインズ 大宮店")).toHaveCount(0);
    await page.goto("/p-customers", { timeout: 120_000 });
    // 管理者サイトの顧客一覧は「自社顧客」。
    await expect(page.getByRole("heading", { name: "自社顧客" })).toBeVisible({ timeout: T });
    await expect(page.getByText("[DEMO] 山田 花子")).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// パートナースタッフサイト
// ---------------------------------------------------------------------------
test.describe("パートナースタッフサイト", () => {
  test.skip(() => test.info().project.name !== "staff", "スタッフサイト専用");

  test("⑩ トップに今週の本人シフトと週の切替が出る", async ({ page }) => {
    await signIn(page, STAFF);
    await page.goto("/p-home", { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: /今週の催事シフト/ })).toBeVisible({
      timeout: T,
    });
    await expect(page.getByRole("link", { name: "先週" })).toBeVisible({ timeout: T });
    await expect(page.getByRole("link", { name: "来週" })).toBeVisible({ timeout: T });
    // 今日の催事が本人のシフトとして出る（開催場所・時刻・役割）。
    await expect(page.getByText("[DEMO] カインズ 大宮店").first()).toBeVisible({ timeout: T });
    await expect(page.getByRole("link", { name: "この催事からアポ登録" }).first()).toBeVisible({
      timeout: T,
    });
    await expect(page.getByRole("link", { name: "催事シフトをすべて見る" })).toBeVisible({
      timeout: T,
    });
  });

  test("⑪ 催事からアポ登録すると、催事の情報が初期入力される", async ({ page }) => {
    await signIn(page, STAFF);
    await page.goto("/p-home", { timeout: 120_000 });
    await page.getByRole("link", { name: "この催事からアポ登録" }).first().click();
    await page.waitForURL((u) => u.pathname === "/p-appointments/new", { timeout: T });

    await expect(page.getByRole("heading", { name: "この催事からの登録" })).toBeVisible({
      timeout: T,
    });
    // 催事場所・依頼元代理店・所属会社が出る。
    await expect(page.getByText("[DEMO] カインズ 大宮店").first()).toBeVisible({ timeout: T });
    await expect(page.getByText("株式会社サンライズソーラー").first()).toBeVisible({ timeout: T });
    // 催事場所は初期入力されている。
    await expect(page.getByLabel("催事場所")).toHaveValue(/カインズ 大宮店/, { timeout: T });
  });

  test("⑫ 催事を指定しないアポ登録では対象催事を選ばせる", async ({ page }) => {
    await signIn(page, STAFF);
    await page.goto("/p-appointments/new", { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "どの催事からの登録ですか" })).toBeVisible({
      timeout: T,
    });
    // 今日の催事が候補に出る。
    await expect(page.getByRole("link", { name: /カインズ 大宮店/ }).first()).toBeVisible({
      timeout: T,
    });
  });

  test("⑬ 会社全件の顧客が見え、商談履歴が積み上がる", async ({ page }) => {
    await signIn(page, STAFF);
    await page.goto("/p-customers", { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "顧客情報" })).toBeVisible({ timeout: T });
    await page
      .getByRole("link", { name: /\[DEMO\] 山田 花子/ })
      .first()
      .click();
    await page.waitForURL((u) => u.pathname.startsWith("/p-customers/"), { timeout: T });

    await expect(page.getByRole("heading", { name: "商談履歴" })).toBeVisible({ timeout: T });
    await expect(page.getByText("1回目")).toBeVisible({ timeout: T });
    await expect(page.getByText("2回目")).toBeVisible({ timeout: T });
    // 契約済への変更と成約報告の提出は別物である旨が出る。
    await expect(page.getByText(/「契約済」への変更と、成約報告の提出は別の操作です/)).toBeVisible({
      timeout: T,
    });
  });

  test("⑭ スタッフサイトには管理者専用の業務が出ない", async ({ page }) => {
    await signIn(page, STAFF);
    await page.goto("/p-lane-preferences", { timeout: 120_000 });
    await expect(page).toHaveURL(/\/p-home/, { timeout: T });
    await page.goto("/p-consultations", { timeout: 120_000 });
    await expect(page).toHaveURL(/\/p-home/, { timeout: T });
  });

  test("⑮ 別のパートナー会社の顧客は見えない（会社境界）", async ({ page }) => {
    await signIn(page, STAFF);
    await page.goto("/p-customers", { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "顧客情報" })).toBeVisible({ timeout: T });
    await expect(page.getByText("[DEMO] B社 顧客")).toHaveCount(0);
  });
});
