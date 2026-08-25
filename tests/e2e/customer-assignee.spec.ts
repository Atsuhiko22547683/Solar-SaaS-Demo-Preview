import { expect, test, type Page } from "@playwright/test";

// 顧客ページ「担当者」カードの担当者変更ダイアログ（トスアップ担当 / クロージング担当）の検証。
//
// 以前は 1 つの select に optgroup で自社社員と二次店を詰めていたが、
//   【所属区分】（未設定 / 自社社員 / 二次店）→【担当者】
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

/** 担当者 select の選択肢テキスト（先頭の「未設定」を除く）。 */
async function personOptions(page: Page, role: "tossup" | "closing"): Promise<string[]> {
  const texts = await personSelect(page, role).locator("option").allInnerTexts();
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

    // 所属区分の選択肢は 未設定 / 自社社員 / 二次店 の 3 つ。
    await expect(kindSelect(page, "tossup").locator("option")).toHaveText([
      "未設定",
      "自社社員",
      "二次店",
    ]);

    await kindSelect(page, "tossup").selectOption("user");
    const own = await personOptions(page, "tossup");
    expect(own.length, "自社ユーザーが 1 件以上").toBeGreaterThan(0);

    // 二次店（会社名）は自社側の候補に混ざらない。
    await kindSelect(page, "closing").selectOption("dealer");
    const dealerNames = await personOptions(page, "closing");
    expect(dealerNames.length, "二次店が 1 件以上").toBeGreaterThan(0);
    for (const name of dealerNames) {
      expect(own, `二次店「${name}」は自社候補に出ない`).not.toContain(name);
    }
  });

  test("シナリオ2: 所属区分 = 二次店 なら二次店だけが候補に出る", async ({ page }) => {
    await signInAsDemo(page);
    await openFirstCustomer(page);
    await openAssigneeDialog(page);

    await kindSelect(page, "tossup").selectOption("user");
    const own = await personOptions(page, "tossup");

    await kindSelect(page, "tossup").selectOption("dealer");
    const dealerNames = await personOptions(page, "tossup");

    expect(dealerNames.length).toBeGreaterThan(0);
    // 区分を切り替えると候補集合が完全に入れ替わる。
    for (const name of dealerNames) {
      expect(own).not.toContain(name);
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

    // 二次店へ切り替え → 自社ユーザーが選ばれたままにならない。
    await kindSelect(page, "tossup").selectOption("dealer");
    await expect(personSelect(page, "tossup"), "担当者は未設定へ戻る").toHaveValue("");

    // 逆方向も同じ。
    const dealerNames = await personOptions(page, "tossup");
    await personSelect(page, "tossup").selectOption({ label: dealerNames[0]! });
    await expect(personSelect(page, "tossup")).not.toHaveValue("");
    await kindSelect(page, "tossup").selectOption("user");
    await expect(personSelect(page, "tossup")).toHaveValue("");

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

  test("シナリオ5: 二次店担当を保存し、再編集で所属区分と担当者が復元される", async ({ page }) => {
    await signInAsDemo(page);
    await openFirstCustomer(page);
    await openAssigneeDialog(page);

    await kindSelect(page, "tossup").selectOption("dealer");
    const dealerNames = await personOptions(page, "tossup");
    const picked = dealerNames[0]!;
    await personSelect(page, "tossup").selectOption({ label: picked });
    await save(page);

    await openAssigneeDialog(page);
    await expect(kindSelect(page, "tossup")).toHaveValue("dealer");
    const selected = await personSelect(page, "tossup").locator("option:checked").innerText();
    expect(selected.trim()).toBe(picked);
  });

  test("シナリオ6: トスアップ = 二次店 / クロージング = 自社 を独立して保存できる", async ({
    page,
  }) => {
    await signInAsDemo(page);
    await openFirstCustomer(page);
    await openAssigneeDialog(page);

    await kindSelect(page, "tossup").selectOption("dealer");
    const dealerNames = await personOptions(page, "tossup");
    const dealerPick = dealerNames[0]!;
    await personSelect(page, "tossup").selectOption({ label: dealerPick });

    await kindSelect(page, "closing").selectOption("user");
    const own = await personOptions(page, "closing");
    const userPick = own[0]!;
    await personSelect(page, "closing").selectOption({ label: userPick });

    await save(page);

    // 再編集すると両方が別々の所属区分で復元される。
    await openAssigneeDialog(page);
    await expect(kindSelect(page, "tossup")).toHaveValue("dealer");
    await expect(kindSelect(page, "closing")).toHaveValue("user");
    expect((await personSelect(page, "tossup").locator("option:checked").innerText()).trim()).toBe(
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

    // 二次店へ変更してキャンセル。
    await openAssigneeDialog(page);
    await kindSelect(page, "tossup").selectOption("dealer");
    const dealerNames = await personOptions(page, "tossup");
    await personSelect(page, "tossup").selectOption({ label: dealerNames[0]! });
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
