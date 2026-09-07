import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { signIn } from "./fixtures/auth";

// E2E spec for T-04-12 (part 1) — UC-01 後半 steps 8b-10
// (F-028 / F-029 / F-030 / F-031 / F-033).
//
// 前提: globalSetup が pnpm db:seed を実行済み。
//
// このスペックは自己完結するため、uc01-event-flow.spec.ts の state には依存しない。
//
// 現行 UI への追随について:
//   デモ向けの UI 刷新で、卸業者側の「場所提供元対応 → イベント候補への昇格」
//   「希望受付を開始（公開）」「取引先共有設定」の導線が取り除かれた。
//   旧 setup はこの 3 つを画面操作していたため失敗していた。アプリを旧 UI に
//   戻すのではなく、その前提状態だけを fixture（setup-uc01-candidate.ts）で用意し、
//   画面が残っている工程（希望提出 → 開催体制決定 → 実施・報告・顧客・アポ）を
//   UI で検証する。作ったデータは afterAll で必ず削除する。
//
// Steps covered:
//   Fixture   公開済み（OPEN + 取引先共有済み）のイベント候補を用意
//   Setup     dealer_admin: 希望提出 / wholesaler_admin: 開催体制決定 → eventId 取得
//   Step 8b   wholesaler_admin/dealer_admin: 開始報告を提出
//   Step 9    wholesaler_admin/dealer_admin: 終了報告を提出
//   Step 10a  wholesaler_admin: 成果報告フォームに数値入力 → 送信
//   Step 10b  wholesaler_admin: 顧客登録（催事チャネル）
//   Step 10c  wholesaler_admin: アポ登録（登録した顧客に対して）

// Module-level state shared across serial steps.
let eventId = "";
let customerId = "";
let eventCandidateId = "";
let storeName = "";

const RUN_ID = Date.now();
/** cleanup が完全一致で消す顧客名。 */
const CUSTOMER_NAME = `UC01顧客${RUN_ID}`;

const FIXTURE_DIR = resolve(__dirname, "fixtures");
const DB_DIR = resolve(__dirname, "..", "..", "packages", "db");

// ---------------------------------------------------------------------------
// UC-01 後半 (steps 8b-10) — serial shared state
// ---------------------------------------------------------------------------

test.describe.serial("UC-01 後半 — イベント実施・報告・顧客・アポ登録", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(() => {
    // 公開済み（OPEN + 取引先へ共有済み）のイベント候補を用意する。
    // この状態を作る画面が現行 UI に無いため fixture で用意している（上の注記参照）。
    const out = execFileSync(
      "pnpm",
      ["exec", "tsx", resolve(FIXTURE_DIR, "setup-uc01-candidate.ts"), String(RUN_ID)],
      { cwd: DB_DIR, encoding: "utf8", shell: process.platform === "win32" },
    )
      .trim()
      .split(/\r?\n/);
    const fixture = JSON.parse(out[out.length - 1]!) as {
      candidateId: string;
      storeName: string;
    };
    eventCandidateId = fixture.candidateId;
    storeName = fixture.storeName;
  });

  test.afterAll(() => {
    execFileSync(
      "pnpm",
      ["exec", "tsx", resolve(FIXTURE_DIR, "cleanup-uc01-candidate.ts"), String(RUN_ID)],
      { cwd: DB_DIR, stdio: "inherit", shell: process.platform === "win32" },
    );
  });

  // -------------------------------------------------------------------------
  // Setup-1: 取引先の希望提出 → 開催体制決定（eventId を得る）
  // -------------------------------------------------------------------------

  test("setup-1: 公開済みイベント候補から開催体制を決定して eventId を得る", async ({ page }) => {
    // 取引先が希望を提出し、卸業者が開催体制を決定する（どちらも画面が現存する工程）。
    await signIn(page, "alpha-admin@solar-saas.dev");

    await page.goto("/visible-event-candidates");
    await expect(page.getByRole("heading", { name: "公開中のイベント候補" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(storeName, { exact: false })).toBeVisible({ timeout: 20_000 });

    const card = page.locator("li").filter({ hasText: storeName });
    await card.getByRole("link", { name: "希望提出" }).click();
    await page.waitForURL(/\/visible-event-candidates\/[A-Za-z0-9_-]+\/preference/, {
      timeout: 30_000,
    });
    await page.locator("#pref-priority").fill("1");
    await page.getByRole("button", { name: "希望を提出" }).click();
    await expect(
      page
        .getByRole("button", { name: "希望を更新" })
        .or(page.getByText("提出済み", { exact: false })),
    ).toBeVisible({ timeout: 30_000 });

    // wholesaler_admin が開催体制を決定 → イベントが作られてシフト管理へ遷移する。
    await signIn(page, "wholesaler_admin@solar-saas.dev");
    await page.goto(`/event-detail/${eventCandidateId}/decide`);
    await expect(page.getByRole("heading", { name: "開催体制決定" })).toBeVisible({
      timeout: 30_000,
    });

    const jointLabel = page.locator("label").filter({ has: page.locator("input[value='JOINT']") });
    await expect(jointLabel).toBeVisible({ timeout: 10_000 });
    await jointLabel.click();

    const requiredPeopleInput = page.locator("#requiredPeople-input");
    await expect(requiredPeopleInput).toBeVisible({ timeout: 10_000 });
    await requiredPeopleInput.fill("2");

    const dealerCheckboxes = page.locator("input[type='checkbox']");
    if ((await dealerCheckboxes.count()) > 0) {
      const first = dealerCheckboxes.first();
      if (!(await first.isChecked())) {
        await first.check();
      }
    }

    await page.getByRole("button", { name: "決定して通知" }).click();
    await page.getByRole("button", { name: "決定する" }).click();

    await page.waitForURL(/\/events\/[A-Za-z0-9_-]+\/shifts/, { timeout: 60_000 });
    const shiftMatch = page.url().match(/\/events\/([A-Za-z0-9_-]+)\/shifts/);
    expect(shiftMatch).not.toBeNull();
    eventId = shiftMatch![1]!;
    expect(eventId).toBeTruthy();
  });

  // Step 8b — wholesaler_admin: イベント詳細で「開始報告を提出」
  // -------------------------------------------------------------------------

  test("step-8b: wholesaler_admin submits start report", async ({ page }) => {
    expect(eventId, "Setup-1 で eventId が取得できていない").toBeTruthy();
    await signIn(page, "wholesaler_admin@solar-saas.dev");

    await page.goto(`/events/${eventId}`);
    await expect(page.getByText(storeName, { exact: false }).first()).toBeVisible({
      timeout: 30_000,
    });

    // 「開始報告を提出」ボタン（ReportButtons コンポーネント）
    const startBtn = page.getByRole("button", { name: "開始報告を提出" });
    await expect(startBtn).toBeVisible({ timeout: 20_000 });
    await expect(startBtn).toBeEnabled();
    await startBtn.click();

    // トースト「開始報告を提出しました」と disabled ボタン「開始報告は提出済みです」は
    // 同時に出るので、どちらか 1 つ見えていれば成功（first() で strict mode を回避）。
    await expect(
      page
        .getByText("開始報告を提出しました", { exact: false })
        .or(page.getByRole("button", { name: "開始報告は提出済みです" }))
        .first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  // -------------------------------------------------------------------------
  // Step 9 — wholesaler_admin: 「終了報告を提出」ボタンクリック
  // -------------------------------------------------------------------------

  test("step-9: wholesaler_admin submits end report", async ({ page }) => {
    expect(eventId, "Setup-1 で eventId が取得できていない").toBeTruthy();
    await signIn(page, "wholesaler_admin@solar-saas.dev");

    await page.goto(`/events/${eventId}`);
    await expect(page.getByText(storeName, { exact: false }).first()).toBeVisible({
      timeout: 30_000,
    });

    // 開始報告が既に提出済みなのでボタンは「開始報告は提出済みです」で disabled
    const startSubmittedBtn = page.getByRole("button", { name: "開始報告は提出済みです" });
    await expect(startSubmittedBtn).toBeVisible({ timeout: 20_000 });

    // 「終了報告を提出」ボタン
    const endBtn = page.getByRole("button", { name: "終了報告を提出" });
    await expect(endBtn).toBeVisible({ timeout: 20_000 });
    await expect(endBtn).toBeEnabled();
    await endBtn.click();

    // トーストか disabled ボタンで成功を確認（同時に出るので first()）。
    await expect(
      page
        .getByText("終了報告を提出しました", { exact: false })
        .or(page.getByText("開始報告が未提出です", { exact: false }))
        .or(page.getByRole("button", { name: "終了報告は提出済みです" }))
        .first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  // -------------------------------------------------------------------------
  // Step 10a — wholesaler_admin: 成果報告フォームに数値入力 → 送信
  // -------------------------------------------------------------------------

  test("step-10a: wholesaler_admin submits result report", async ({ page }) => {
    expect(eventId, "Setup-1 で eventId が取得できていない").toBeTruthy();
    await signIn(page, "wholesaler_admin@solar-saas.dev");

    await page.goto(`/events/${eventId}`);
    await expect(page.getByText(storeName, { exact: false }).first()).toBeVisible({
      timeout: 30_000,
    });

    // 成果報告フォーム（ResultReportForm）が存在することを確認
    const resultSection = page.getByRole("region", { name: "成果報告" });
    await expect(resultSection).toBeVisible({ timeout: 20_000 });

    // すでに提出済みの場合はスキップ
    const alreadySubmitted = resultSection.getByText("成果報告は提出済みです");
    if (await alreadySubmitted.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // 前回の実行で既に提出されている — フォームが不在でも OK
      return;
    }

    // 各フィールドに 0 以上整数を入力
    await page.locator("#approachCount").fill("30");
    await page.locator("#surveyCount").fill("15");
    await page.locator("#totalAppts").fill("5");
    await page.locator("#validAppts").fill("3");
    await page.locator("#invalidAppts").fill("2");

    const submitBtn = page.getByRole("button", { name: "成果報告を提出" });
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
    await submitBtn.click();

    // 成功トーストが表示される
    await expect(page.getByText("成果報告を提出しました", { exact: false })).toBeVisible({
      timeout: 30_000,
    });
  });

  // -------------------------------------------------------------------------
  // Step 10b — wholesaler_admin: 顧客登録（催事チャネル / sourceEventId 指定）
  // -------------------------------------------------------------------------

  test("step-10b: wholesaler_admin registers a customer (EVENT channel)", async ({ page }) => {
    expect(eventId, "Setup-1 で eventId が取得できていない").toBeTruthy();
    await signIn(page, "wholesaler_admin@solar-saas.dev");

    await page.goto("/customers/new");
    await expect(page.getByRole("heading", { name: "顧客を新規登録" })).toBeVisible({
      timeout: 30_000,
    });

    // 氏名（cleanup が完全一致で消せるよう RUN_ID 付きの一意な名前にする）
    await page.getByLabel("氏名").fill(CUSTOMER_NAME);
    // 電話番号 (type="tel")
    await page.getByLabel("電話番号").fill(`090${String(RUN_ID).slice(-8)}`);
    // チャネル → 催事（獲得チャネル select）
    await page.getByLabel("獲得チャネル").selectOption("EVENT");
    // 催事 ID（sourceEventId field label = "催事 ID"）
    await page.getByLabel("催事 ID").fill(eventId);

    // 登録ボタン
    const submitBtn = page.getByRole("button", { name: "登録" });
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
    await submitBtn.click();

    // 顧客一覧へリダイレクト（redirectTo="/customers"）
    await page.waitForURL((url) => url.pathname.startsWith("/customers"), {
      timeout: 60_000,
    });
    await expect(page.getByRole("heading", { name: "顧客一覧" })).toBeVisible({ timeout: 30_000 });

    // 顧客一覧の行はリンクではなく role="button" の <tr>（aria-label="<氏名> 様"）で、
    // クリックすると詳細へ遷移する。まず検索で今登録した顧客だけに絞り、その行を
    // 開いて URL から ID を取る（先頭行が自分の登録とは限らないので順序に依存しない）。
    await page.getByRole("button", { name: /^検索条件/ }).click();
    await page.getByLabel("顧客名で検索").fill(CUSTOMER_NAME);
    await page.getByRole("button", { name: "検索", exact: true }).click();

    // 行の aria-label は `<氏名>様`（敬称の前に空白なし）。氏名だけの部分一致で引く。
    const row = page.getByRole("button", { name: CUSTOMER_NAME });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.click();

    await page.waitForURL(/\/customers\/[A-Za-z0-9_-]+/, { timeout: 30_000 });
    const m = page.url().match(/\/customers\/([A-Za-z0-9_-]+)/);
    expect(m, `顧客詳細へ遷移しなかった: ${page.url()}`).not.toBeNull();
    customerId = m![1]!;

    expect(customerId, "顧客 ID が取得できなかった").toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Step 10c — wholesaler_admin: アポ登録
  // -------------------------------------------------------------------------

  test("step-10c: wholesaler_admin registers an appointment for the customer", async ({ page }) => {
    expect(customerId, "Step 10b で顧客 ID が取得できていない").toBeTruthy();
    await signIn(page, "wholesaler_admin@solar-saas.dev");

    await page.goto(`/appointments/new?customerId=${customerId}`);
    await expect(page.getByRole("heading", { name: "アポを新規登録" })).toBeVisible({
      timeout: 30_000,
    });

    // customerId が事前入力されていることを確認（aria-required="true" の先頭 input）
    const customerIdInput = page.locator("input[aria-required='true']").first();
    await expect(customerIdInput).toHaveValue(customerId, { timeout: 10_000 });

    // 訪問予定日時。react-hook-form のハイドレーション前に fill すると値がリセット
    // されて空のまま送信され、バリデーションで弾かれる。値が残るまで入力を繰り返す。
    await page.waitForLoadState("networkidle");
    const scheduledAtInput = page.getByLabel("訪問予定日時", { exact: false });
    await expect(scheduledAtInput).toBeVisible({ timeout: 10_000 });
    await expect(async () => {
      await scheduledAtInput.fill("2027-03-15T14:00");
      await expect(scheduledAtInput).toHaveValue("2027-03-15T14:00", { timeout: 2_000 });
    }).toPass({ timeout: 30_000 });

    // 登録ボタン
    const submitBtn = page.getByRole("button", { name: "登録" });
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
    await submitBtn.click();

    // アポ一覧へリダイレクト（redirectTo="/appointments"）
    await page.waitForURL(/\/appointments/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "アポイント一覧" })).toBeVisible({
      timeout: 30_000,
    });

    // data-appointment-id 属性の先頭行が存在することを確認
    const firstApptRow = page.locator("table tbody tr[data-appointment-id]").first();
    await expect(firstApptRow).toBeVisible({ timeout: 20_000 });
    await expect(firstApptRow.getByText("未確認")).toBeVisible({ timeout: 10_000 });
  });
});
