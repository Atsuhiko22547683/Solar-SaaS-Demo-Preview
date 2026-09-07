import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { signIn } from "./fixtures/auth";

// E2E spec for T-03-12 — UC-01 前半 (F-017〜F-025).
//
// 3 ロールを順番に切り替えながら UC-01 を一気通貫で実行する。
//
//   Step 1  wholesaler_event_team: 場所提供元対応を新規起票
//   Step 2  wholesaler_event_team: ステータスを 条件確認中 → 実施可 → 確定 へ
//   Step 3  wholesaler_event_team: 公開済みイベント候補を詳細画面で確認
//   Step 4  dealer_admin         : 公開済み候補を閲覧 → 希望提出
//   Step 5  wholesaler_admin     : 希望状況確認 → 開催体制決定（JOINT）
//   Step 6  wholesaler_admin     : シフト割当画面でシフト 1 件追加
//
// 現行 UI への追随について:
//   デモ向けの UI 刷新で、卸業者側から
//     - PromoteForm（場所提供元対応 → イベント候補への昇格）
//     - 「希望受付を開始（公開）」（DRAFT → OPEN）
//     - VisibilityControl（取引先共有設定）
//   の導線が取り除かれた。旧 spec はこの 3 つを画面操作していたため失敗していた。
//   アプリを旧 UI に戻すのではなく、無くなった工程だけを fixture で用意し
//   （setup-uc01-candidate.ts）、画面が残っている工程は UI で検証する。
//   場所提供元対応のステータスもボタン群からインライン select へ変わったので、
//   selectOption で操作する。
//
// 前提: globalSetup が pnpm db:seed を実行済み（pilotWholesaler と dealerAlpha の
//       関係が存在し、wholesaler_event_team / wholesaler_admin / alpha-admin が
//       Pilot!2026 でサインイン可能）。
//
// 生成したデータは afterAll の cleanup-uc01-candidate.ts で必ず削除する。

// UC-01 全体で共有するランタイムデータを保持する。
let venueNegotiationId = "";
let eventCandidateId = "";
let eventCandidateStoreName = "";
let eventId = "";

// タイムスタンプを使った一意のテスト識別子（同一 DB への複数実行で衝突しない）。
const RUN_ID = Date.now();
/** 画面から起票する場所提供元対応の備考。cleanup が完全一致で消す目印。 */
const NEGOTIATION_NOTE = `UC-01 E2E ${RUN_ID}`;

const FIXTURE_DIR = resolve(__dirname, "fixtures");
const DB_DIR = resolve(__dirname, "..", "..", "packages", "db");

function runFixture(script: string): string {
  return execFileSync("pnpm", ["exec", "tsx", resolve(FIXTURE_DIR, script), String(RUN_ID)], {
    cwd: DB_DIR,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
}

/**
 * 場所提供元対応の「詳細」ページか。
 * /venue-negotiations/new も同じ階層にあるので、単純な /<id> 判定だと新規画面に
 * 合致してしまう。ID が "new" のときだけ明示的に除外する。
 */
function isVenueNegotiationDetailUrl(url: URL): boolean {
  const m = url.pathname.match(/^\/venue-negotiations\/([A-Za-z0-9_-]+)$/);
  return m !== null && m[1] !== "new";
}

// ---------------------------------------------------------------------------
// UC-01 (serial — share state via module-level variables)
// ---------------------------------------------------------------------------

test.describe.serial("UC-01 event flow", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(() => {
    // 公開済み（OPEN + 取引先へ共有済み）のイベント候補を用意する。
    // この状態を作る画面が現行 UI に無いため fixture で用意している（上の注記参照）。
    const out = runFixture("setup-uc01-candidate.ts").trim().split(/\r?\n/);
    const fixture = JSON.parse(out[out.length - 1]!) as {
      candidateId: string;
      storeName: string;
    };
    eventCandidateId = fixture.candidateId;
    eventCandidateStoreName = fixture.storeName;
  });

  test.afterAll(() => {
    execFileSync(
      "pnpm",
      ["exec", "tsx", resolve(FIXTURE_DIR, "cleanup-uc01-candidate.ts"), String(RUN_ID)],
      { cwd: DB_DIR, stdio: "inherit", shell: process.platform === "win32" },
    );
  });

  // ---------------------------------------------------------------------------
  // Step 1 — wholesaler_event_team: 場所提供元対応を新規起票
  // ---------------------------------------------------------------------------

  test("step-1: wholesaler_event_team creates a venue negotiation", async ({ page }) => {
    await signIn(page, "wholesaler_event_team@solar-saas.dev");

    await page.goto("/venue-negotiations/new");
    await expect(page.getByRole("heading", { name: "対応を新規起票" })).toBeVisible({
      timeout: 30_000,
    });

    // 場所提供元を選択（seed に pilotWholesaler 配下の VenueProvider が存在する）。
    // 店舗名・住所は場所提供元を選ぶまで disabled なので、必ず先に選ぶ。
    const vpSelect = page.getByLabel("場所提供元", { exact: false });
    await expect(vpSelect).toBeVisible({ timeout: 30_000 });
    const options = await vpSelect.locator("option").all();
    const firstValue = await options[1]?.getAttribute("value");
    if (!firstValue) {
      throw new Error("No venue provider options in select — check seed data");
    }
    await vpSelect.selectOption(firstValue);

    // 実施候補日は input[type=date] の行リスト（1 行 = 1 日付）。
    // 各行は aria-label="実施候補日 <n>" を持つので、ユーザー操作に近い getByLabel で引く。
    await page.getByLabel("実施候補日 1", { exact: true }).fill("2026-12-20");

    // 備考に識別子を入れて cleanup から追跡できるようにする。
    await page.getByLabel("備考・履歴メモ").fill(NEGOTIATION_NOTE);

    await page.getByRole("button", { name: "登録" }).click();

    // 詳細ページへ遷移。詳細の h1 は場所提供元名なので固定文言では待てない。
    // 詳細ページだけが編集モードのフォーム（送信ボタン =「保存」）を描画するので、
    // それが出たことをもって遷移完了とみなす（新規画面の送信ボタンは「登録」）。
    // 送信中は同じボタンの文言が「保存中…」になり部分一致だと /new のままヒットする
    // ので、URL が new 以外の ID になるのを待ってから exact: true で確認する。
    await page.waitForURL(isVenueNegotiationDetailUrl, { timeout: 60_000 });
    await expect(page.getByRole("button", { name: "保存", exact: true })).toBeVisible({
      timeout: 60_000,
    });
    const match = page.url().match(/\/venue-negotiations\/([A-Za-z0-9_-]+)/);
    expect(match, `URL にイベント交渉 ID が含まれていない: ${page.url()}`).not.toBeNull();
    venueNegotiationId = match![1]!;
  });

  // ---------------------------------------------------------------------------
  // Step 2 — wholesaler_event_team: NOT_CONTACTED → CONDITION_REVIEW → FEASIBLE → FIXED
  // ---------------------------------------------------------------------------

  test("step-2: wholesaler_event_team advances negotiation status to FIXED", async ({ page }) => {
    expect(venueNegotiationId, "Step 1 で ID が取得できていない").toBeTruthy();
    await signIn(page, "wholesaler_event_team@solar-saas.dev");

    await page.goto(`/venue-negotiations/${venueNegotiationId}`);
    // 詳細ページの目印は編集フォームの「保存」ボタン（h1 は場所提供元名で可変）。
    // 送信中の「保存中…」に部分一致しないよう exact: true。
    await expect(page.getByRole("button", { name: "保存", exact: true })).toBeVisible({
      timeout: 30_000,
    });

    // ステータスはヘッダ右上のインライン select。選んだ瞬間に保存される
    // （旧 UI の遷移ボタン群は廃止済み）。
    const statusSelect = page.getByLabel("ステータス", { exact: true });
    await expect(statusSelect).toBeVisible({ timeout: 20_000 });

    for (const label of ["条件確認中", "実施可", "確定"]) {
      await statusSelect.selectOption({ label });
      // 選択のたびに Server Action + router.refresh() が走るので落ち着くまで待つ。
      await page.waitForLoadState("networkidle");
      await expect(statusSelect).toHaveValue(
        { 条件確認中: "CONDITION_REVIEW", 実施可: "FEASIBLE", 確定: "FIXED" }[label]!,
        { timeout: 20_000 },
      );
    }

    // 「確定」にすると単発イベント登録を促すダイアログが出る。ここでは先へ進めない。
    const laterBtn = page.getByRole("button", { name: "あとで" });
    if (await laterBtn.isVisible().catch(() => false)) {
      await laterBtn.click();
    }
  });

  // ---------------------------------------------------------------------------
  // Step 3 — wholesaler_event_team: 公開済みイベント候補を詳細画面で確認
  // ---------------------------------------------------------------------------

  test("step-3: wholesaler_event_team opens the published event candidate", async ({ page }) => {
    expect(eventCandidateId, "fixture でイベント候補が作られていない").toBeTruthy();
    await signIn(page, "wholesaler_event_team@solar-saas.dev");

    await page.goto(`/event-detail/${eventCandidateId}`);
    // 詳細ヘッダに fixture の店舗名が出ていること。
    await expect(page.getByText(eventCandidateStoreName, { exact: false }).first()).toBeVisible({
      timeout: 30_000,
    });
    // 基本情報カード（今回追加した催事種別などもここに並ぶ）。
    await expect(page.getByText("基本情報", { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  // ---------------------------------------------------------------------------
  // Step 4 — dealer_admin: 公開済み候補を閲覧 → 希望提出
  // ---------------------------------------------------------------------------

  test("step-4: dealer_admin views visible candidate and submits preference", async ({ page }) => {
    expect(eventCandidateId, "fixture でイベント候補が作られていない").toBeTruthy();
    await signIn(page, "alpha-admin@solar-saas.dev");

    await page.goto("/visible-event-candidates");
    await expect(page.getByRole("heading", { name: "公開中のイベント候補" })).toBeVisible({
      timeout: 30_000,
    });

    // fixture の店舗名を持つカードが表示されていること。
    await expect(page.getByText(eventCandidateStoreName, { exact: false })).toBeVisible({
      timeout: 20_000,
    });

    const card = page.locator("li").filter({ hasText: eventCandidateStoreName });
    const preferenceBtn = card.getByRole("link", { name: "希望提出" });
    await expect(preferenceBtn).toBeVisible({ timeout: 10_000 });
    await preferenceBtn.click();

    // S-060 希望回答フォームへ遷移。
    await page.waitForURL(/\/visible-event-candidates\/[A-Za-z0-9_-]+\/preference/, {
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: "希望回答" })).toBeVisible({ timeout: 20_000 });

    await page.locator("#pref-priority").fill("1");

    const submitBtn = page.getByRole("button", { name: "希望を提出" });
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
    await submitBtn.click();

    // 提出後はフォームが「更新」モードへ切り替わる（or 提出済み表示）。
    await expect(
      page
        .getByRole("button", { name: "希望を更新" })
        .or(page.getByText("提出済み", { exact: false })),
    ).toBeVisible({ timeout: 30_000 });
  });

  // ---------------------------------------------------------------------------
  // Step 5 — wholesaler_admin: 希望状況確認 → 開催体制決定（JOINT）
  // ---------------------------------------------------------------------------

  test("step-5: wholesaler_admin reviews preferences and decides JOINT event", async ({ page }) => {
    expect(eventCandidateId, "fixture でイベント候補が作られていない").toBeTruthy();
    await signIn(page, "wholesaler_admin@solar-saas.dev");

    // 取引先希望状況確認ページ（S-025/S-026）。ルートは /event-detail 配下。
    await page.goto(`/event-detail/${eventCandidateId}/preferences`);
    await expect(page.getByRole("heading", { name: "取引先希望状況", level: 1 })).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.getByRole("tab", { name: "取引先別" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "店舗別" })).toBeVisible();

    // Step 4 で alpha-admin が希望を提出済みなので「提出済み」表示があるはず。
    await expect(page.getByText("提出済み", { exact: false }).first()).toBeVisible({
      timeout: 10_000,
    });

    // 開催体制決定ページへ。
    await page.goto(`/event-detail/${eventCandidateId}/decide`);
    await expect(page.getByRole("heading", { name: "開催体制決定" })).toBeVisible({
      timeout: 30_000,
    });

    // JOINT モードを選択（radio は sr-only なのでラベルカードをクリックする）。
    const jointLabel = page.locator("label").filter({ has: page.locator("input[value='JOINT']") });
    await expect(jointLabel).toBeVisible({ timeout: 10_000 });
    await jointLabel.click();

    const requiredPeopleInput = page.locator("#requiredPeople-input");
    await expect(requiredPeopleInput).toBeVisible({ timeout: 10_000 });
    await requiredPeopleInput.fill("2");

    // 担当取引先チェックボックス（seed: dealerAlpha）。
    const dealerCheckboxes = page.locator("input[type='checkbox']");
    if ((await dealerCheckboxes.count()) > 0) {
      const first = dealerCheckboxes.first();
      if (!(await first.isChecked())) {
        await first.check();
      }
    }

    await page.getByRole("button", { name: "決定して通知" }).click();
    await page.getByRole("button", { name: "決定する" }).click();

    // JOINT/SELF 決定後はシフト管理ページ /events/<id>/shifts へ自動遷移する。
    await page.waitForURL(/\/events\/[A-Za-z0-9_-]+\/shifts/, { timeout: 60_000 });
    const shiftMatch = page.url().match(/\/events\/([A-Za-z0-9_-]+)\/shifts/);
    expect(shiftMatch, `シフト管理ページへ遷移しなかった: ${page.url()}`).not.toBeNull();
    eventId = shiftMatch![1]!;

    await expect(page.getByRole("heading", { name: "シフト管理", level: 1 })).toBeVisible({
      timeout: 20_000,
    });
  });

  // ---------------------------------------------------------------------------
  // Step 6 — wholesaler_admin: シフト割当画面でシフト 1 件追加
  // ---------------------------------------------------------------------------

  test("step-6: wholesaler_admin assigns one shift to the event", async ({ page }) => {
    expect(eventId, "Step 5 で Event ID が取得できていない").toBeTruthy();
    await signIn(page, "wholesaler_admin@solar-saas.dev");

    await page.goto(`/events/${eventId}/shifts`);
    await expect(page.getByRole("heading", { name: "シフト管理", level: 1 })).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.getByText("シフトがまだ割り当てられていません")).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole("button", { name: "シフトを追加" }).click();
    await expect(page.getByRole("dialog").getByText("シフトを追加")).toBeVisible({
      timeout: 10_000,
    });

    const userSelect = page.locator("#shift-user-select");
    await expect(userSelect).toBeVisible({ timeout: 10_000 });
    const userOptions = await userSelect.locator("option").all();
    const firstUserId = await userOptions[1]?.getAttribute("value");
    expect(firstUserId, "担当者候補がいない — seed データを確認してください").toBeTruthy();
    await userSelect.selectOption(firstUserId!);

    await page.locator("#shift-role-select").selectOption("LEAD");
    await page.locator("#shift-start").fill("2027-03-10T09:00");
    await page.locator("#shift-end").fill("2027-03-10T18:00");

    await page.getByRole("dialog").getByRole("button", { name: "保存" }).click();
    await page.waitForLoadState("networkidle");

    // UC-01 完了。シフト追加後もシフト管理画面に留まる。
    expect(page.url()).toContain("/shifts");
  });
});
