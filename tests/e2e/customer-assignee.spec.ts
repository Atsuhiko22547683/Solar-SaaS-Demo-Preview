import { expect, test, type Page } from "@playwright/test";

// 顧客ページ「担当者」カードの担当者変更ダイアログ（トスアップ担当 / クロージング担当）の検証。
//
// 以前は 1 つの select に optgroup で自社社員と取引先を詰めていたが、
//   【所属区分】（未設定 / 自社社員 / 取引先）→【担当者】
// の 2 段階に分割した。所属区分を変えると担当者の選択肢が入れ替わり、選択済みの担当者は
// リセットされる。保存形式は従来どおり tossUpUserId / tossUpRelationshipId /
// closingUserId / closingRelationshipId の 4 列（排他）で、所属区分は保存しない。
//
// 認証は demo@solar-saas.demo / Demo1234!（WHOLESALER_ADMIN, 2FA off, seed 投入済）。
// Seed は tests/e2e/global-setup.ts で全 spec 起動前に 1 回だけ実行される。
// workers:1 + fullyParallel:false（tests/e2e/playwright.config.ts）に追従。

const DEMO_EMAIL = "demo@solar-saas.demo";
const DEMO_PASSWORD = "Demo1234!";

async function signInAsDemo(page: Page): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(DEMO_EMAIL);
  await page.getByLabel("パスワード").fill(DEMO_PASSWORD);
  const submit = page.getByRole("button", { name: "サインイン" });
  await expect(submit).toBeVisible();
  await submit.click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 120_000 });
}

/** 顧客一覧の先頭顧客の詳細（基本情報タブ）を開く。 */
async function openFirstCustomer(page: Page): Promise<void> {
  await page.goto("/customers", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "顧客一覧" })).toBeVisible({ timeout: 90_000 });
  const row = page.getByRole("button", { name: /様$/ }).first();
  await expect(row).toBeVisible({ timeout: 90_000 });
  await row.click();
  await page.waitForURL(/\/customers\/[^/]+$/, { timeout: 90_000 });
  await expect(page.getByRole("heading", { name: "担当者", exact: true })).toBeVisible({
    timeout: 90_000,
  });
}

/** 「変更」ボタンで担当者変更ダイアログを開く。 */
async function openAssigneeDialog(page: Page) {
  await page.getByRole("button", { name: "変更", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("担当者を変更")).toBeVisible({ timeout: 30_000 });
  return dialog;
}

/** 役割ごとの 2 段セレクト。id は edit-tossup-* / edit-closing-*。 */
function kindSelect(page: Page, role: "tossup" | "closing") {
  return page.locator(`#edit-${role}-kind`);
}
function personSelect(page: Page, role: "tossup" | "closing") {
  return page.locator(`#edit-${role}-select`);
}

/**
 * 取引先（会社）select。所属区分 = 取引先 のときだけ描画される。
 * 取引先は 会社 → 所属スタッフ の 2 段になったため、会社はこちらで選ぶ
 * （#edit-*-select は「担当スタッフ」側）。
 */
function dealerSelect(page: Page, role: "tossup" | "closing") {
  return page.locator(`#edit-${role}-dealer`);
}

/** 担当者 select の選択肢テキスト（先頭の「未設定」/「未登録」を除く）。 */
async function personOptions(page: Page, role: "tossup" | "closing"): Promise<string[]> {
  const texts = await personSelect(page, role).locator("option").allInnerTexts();
  return texts.map((v) => v.trim()).filter((v) => v !== "未設定" && v !== "未登録");
}

/** 取引先 select の選択肢テキスト（先頭の「未設定」を除く）。 */
async function dealerOptions(page: Page, role: "tossup" | "closing"): Promise<string[]> {
  const texts = await dealerSelect(page, role).locator("option").allInnerTexts();
  return texts.map((v) => v.trim()).filter((v) => v !== "未設定");
}

/**
 * 保存 → ダイアログが閉じるのを待ち、ページを読み込み直す。
 * 保存後の router.refresh() を待たずに開き直すと古い props で初期化されうるため、
 * リロードして必ずサーバから取り直す（= DB に永続化されていることの確認にもなる）。
 */
async function save(page: Page): Promise<void> {
  await page.getByRole("dialog").getByRole("button", { name: "保存" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 60_000 });
  await page.reload({ timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "担当者", exact: true })).toBeVisible({
    timeout: 90_000,
  });
}

test.describe("顧客 担当者変更ダイアログ（所属区分 → 担当者）", () => {
  test.describe.configure({ timeout: 180_000 });

  test("シナリオ1: 所属区分 = 自社社員 なら自社ユーザーだけが候補に出る", async ({ page }) => {
    await signInAsDemo(page);
    await openFirstCustomer(page);
    await openAssigneeDialog(page);

    // 2 段構成になっている（1 つの長い select ではない）。
    await expect(kindSelect(page, "tossup")).toBeVisible();
    await expect(personSelect(page, "tossup")).toBeVisible();
    await expect(kindSelect(page, "closing")).toBeVisible();
    await expect(personSelect(page, "closing")).toBeVisible();

    // 所属区分の選択肢は 未設定 / 自社社員 / 取引先 の 3 つ。
    await expect(kindSelect(page, "tossup").locator("option")).toHaveText([
      "未設定",
      "自社社員",
      "取引先",
    ]);

    await kindSelect(page, "tossup").selectOption("user");
    const own = await personOptions(page, "tossup");
    expect(own.length, "自社ユーザーが 1 件以上").toBeGreaterThan(0);

    // 取引先（会社名）は自社側の候補に混ざらない。
    // 取引先は 会社 → 担当スタッフ の 2 段なので、会社は dealerSelect 側で見る。
    await kindSelect(page, "closing").selectOption("dealer");
    const dealerNames = await dealerOptions(page, "closing");
    expect(dealerNames.length, "取引先が 1 件以上").toBeGreaterThan(0);
    for (const name of dealerNames) {
      expect(own, `取引先「${name}」は自社候補に出ない`).not.toContain(name);
    }
  });

  test("シナリオ2: 所属区分 = 取引先 なら取引先だけが候補に出る", async ({ page }) => {
    await signInAsDemo(page);
    await openFirstCustomer(page);
    await openAssigneeDialog(page);

    await kindSelect(page, "tossup").selectOption("user");
    const own = await personOptions(page, "tossup");

    await kindSelect(page, "tossup").selectOption("dealer");
    const dealerNames = await dealerOptions(page, "tossup");

    expect(dealerNames.length).toBeGreaterThan(0);
    // 区分を切り替えると候補集合が完全に入れ替わる。
    for (const name of dealerNames) {
      expect(own).not.toContain(name);
    }

    // 会社を選ぶまで担当スタッフ select は空（会社名がスタッフ候補に混ざらない）。
    await expect(personSelect(page, "tossup")).toBeDisabled();
    await dealerSelect(page, "tossup").selectOption({ label: dealerNames[0]! });
    await expect(personSelect(page, "tossup")).toBeEnabled();
    const staffNames = await personOptions(page, "tossup");
    for (const name of staffNames) {
      expect(dealerNames, `スタッフ「${name}」に会社名が混ざらない`).not.toContain(name);
    }
  });

  test("シナリオ3: 所属区分を変えると担当者の選択がリセットされる", async ({ page }) => {
    await signInAsDemo(page);
    await openFirstCustomer(page);
    await openAssigneeDialog(page);

    await kindSelect(page, "tossup").selectOption("user");
    const own = await personOptions(page, "tossup");
    await personSelect(page, "tossup").selectOption({ label: own[0]! });
    await expect(personSelect(page, "tossup")).not.toHaveValue("");

    // 取引先へ切り替え → 自社ユーザーが選ばれたままにならない。
    // 取引先は 会社 → 担当スタッフ の 2 段で、会社未選択のうちはスタッフを選べない。
    await kindSelect(page, "tossup").selectOption("dealer");
    await expect(dealerSelect(page, "tossup"), "取引先は未選択へ戻る").toHaveValue("");
    await expect(personSelect(page, "tossup"), "担当スタッフは未設定へ戻る").toHaveValue("");
    await expect(personSelect(page, "tossup")).toBeDisabled();

    // 逆方向も同じ。
    const dealerNames = await dealerOptions(page, "tossup");
    await dealerSelect(page, "tossup").selectOption({ label: dealerNames[0]! });
    await expect(dealerSelect(page, "tossup")).not.toHaveValue("");
    await kindSelect(page, "tossup").selectOption("user");
    await expect(personSelect(page, "tossup")).toHaveValue("");
    await expect(dealerSelect(page, "tossup"), "自社では取引先 select 自体が消える").toHaveCount(0);

    // 所属区分 = 未設定 のときは担当者 select を無効化する。
    await kindSelect(page, "tossup").selectOption("unset");
    await expect(personSelect(page, "tossup")).toBeDisabled();
  });

  test("シナリオ4: 自社担当者を保存し、再編集で所属区分と担当者が復元される", async ({ page }) => {
    await signInAsDemo(page);
    await openFirstCustomer(page);
    await openAssigneeDialog(page);

    await kindSelect(page, "tossup").selectOption("user");
    const own = await personOptions(page, "tossup");
    const picked = own[0]!;
    await personSelect(page, "tossup").selectOption({ label: picked });
    await save(page);

    // カード上の表示にも反映される。
    await expect(page.getByText(picked).first()).toBeVisible({ timeout: 60_000 });

    // 再度開くと 自社社員 / その担当者 が初期表示される（所属区分は DB に持たず復元）。
    await openAssigneeDialog(page);
    await expect(kindSelect(page, "tossup")).toHaveValue("user");
    const selected = await personSelect(page, "tossup").locator("option:checked").innerText();
    expect(selected.trim()).toBe(picked);
  });

  test("シナリオ5: 取引先担当を保存し、再編集で所属区分と担当者が復元される", async ({ page }) => {
    await signInAsDemo(page);
    await openFirstCustomer(page);
    await openAssigneeDialog(page);

    await kindSelect(page, "tossup").selectOption("dealer");
    const dealerNames = await dealerOptions(page, "tossup");
    const picked = dealerNames[0]!;
    await dealerSelect(page, "tossup").selectOption({ label: picked });
    await save(page);

    // 会社だけ選んだ場合、個人スタッフは「未登録」のまま復元される
    // （勝手にスタッフを選ばない）。
    await openAssigneeDialog(page);
    await expect(kindSelect(page, "tossup")).toHaveValue("dealer");
    const selected = await dealerSelect(page, "tossup").locator("option:checked").innerText();
    expect(selected.trim()).toBe(picked);
    await expect(personSelect(page, "tossup")).toHaveValue("");
  });

  test("シナリオ6: トスアップ = 取引先 / クロージング = 自社 を独立して保存できる", async ({
    page,
  }) => {
    await signInAsDemo(page);
    await openFirstCustomer(page);
    await openAssigneeDialog(page);

    await kindSelect(page, "tossup").selectOption("dealer");
    const dealerNames = await dealerOptions(page, "tossup");
    const dealerPick = dealerNames[0]!;
    await dealerSelect(page, "tossup").selectOption({ label: dealerPick });

    await kindSelect(page, "closing").selectOption("user");
    const own = await personOptions(page, "closing");
    const userPick = own[0]!;
    await personSelect(page, "closing").selectOption({ label: userPick });

    await save(page);

    // 再編集すると両方が別々の所属区分で復元される。
    await openAssigneeDialog(page);
    await expect(kindSelect(page, "tossup")).toHaveValue("dealer");
    await expect(kindSelect(page, "closing")).toHaveValue("user");
    expect((await dealerSelect(page, "tossup").locator("option:checked").innerText()).trim()).toBe(
      dealerPick,
    );
    expect((await personSelect(page, "closing").locator("option:checked").innerText()).trim()).toBe(
      userPick,
    );
  });

  test("シナリオ7: キャンセルすると変更が保存されない", async ({ page }) => {
    await signInAsDemo(page);
    await openFirstCustomer(page);

    // 先に既知の状態（トスアップ = 自社の先頭ユーザー）にしておく。
    await openAssigneeDialog(page);
    await kindSelect(page, "tossup").selectOption("user");
    const own = await personOptions(page, "tossup");
    const baseline = own[0]!;
    await personSelect(page, "tossup").selectOption({ label: baseline });
    await save(page);

    // 取引先へ変更してキャンセル。
    await openAssigneeDialog(page);
    await kindSelect(page, "tossup").selectOption("dealer");
    const dealerNames = await dealerOptions(page, "tossup");
    await dealerSelect(page, "tossup").selectOption({ label: dealerNames[0]! });
    await page.getByRole("dialog").getByRole("button", { name: "キャンセル" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // 開き直すと保存済みの値のまま（編集途中の状態を持ち越さない）。
    await openAssigneeDialog(page);
    await expect(kindSelect(page, "tossup")).toHaveValue("user");
    expect((await personSelect(page, "tossup").locator("option:checked").innerText()).trim()).toBe(
      baseline,
    );
  });

  test("シナリオ8: 未設定へ戻せる", async ({ page }) => {
    await signInAsDemo(page);
    await openFirstCustomer(page);

    await openAssigneeDialog(page);
    await kindSelect(page, "tossup").selectOption("unset");
    await kindSelect(page, "closing").selectOption("unset");
    await save(page);

    await openAssigneeDialog(page);
    await expect(kindSelect(page, "tossup")).toHaveValue("unset");
    await expect(kindSelect(page, "closing")).toHaveValue("unset");
    await expect(personSelect(page, "tossup")).toBeDisabled();
    await expect(personSelect(page, "closing")).toBeDisabled();
  });
});
