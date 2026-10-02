import { expect, test, type Page } from "@playwright/test";

// UI 整合性の最小検証。
//
//   A. /members がスタッフ一覧と同じ「行展開型」になっている
//      （chevron で下に開く / 同じ行をもう一度押すと閉じる / 操作は展開側）
//   B. 取引先タブは展開しても編集・削除を出さない（read-only 維持）
//   C. BIツールがサイドバーの通常導線に出ない。route 自体は残っている
//   D. コール一覧のコール状況が他一覧と同じ status 表現になっている
//
// business logic は検証対象外（既存 spec が担当）。ここは見た目と操作体系だけ。

const DEMO_EMAIL = "demo@solar-saas.demo";
const DEMO_PASSWORD = "Demo1234!";

test.describe.configure({ timeout: 180_000 });

async function signIn(page: Page): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(DEMO_EMAIL);
  await page.getByLabel("パスワード").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "サインイン" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
}

test("A: システムユーザー一覧が行展開型で、操作は展開側にある", async ({ page }) => {
  await signIn(page);
  await page.goto("/members", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "システムユーザー" })).toBeVisible({
    timeout: 90_000,
  });

  const table = page.getByRole("table");
  const rows = table.locator("tbody tr");
  const before = await rows.count();
  expect(before, "システムユーザーが 1 件以上いる").toBeGreaterThan(0);

  // 通常行には操作を出さない（情報確認に徹する）。
  await expect(rows.first().getByRole("button", { name: /編集|削除/ })).toHaveCount(0);

  // chevron で直下に展開。
  await rows
    .first()
    .getByRole("button", { name: /詳細を開く/ })
    .click();
  await expect(rows).toHaveCount(before + 1, { timeout: 90_000 });

  const banner = rows.nth(1);
  await expect(banner).toContainText("2FA");
  await expect(banner).toContainText("最終ログイン");
  await expect(banner.getByRole("button", { name: "編集" })).toBeVisible();
  await expect(banner.getByRole("button", { name: "削除" })).toBeVisible();

  // スタッフ（Salesperson）側の概念は出さない。
  await expect(banner).not.toContainText("トスアップ担当");
  await expect(banner).not.toContainText("イベント担当");

  // 同じ行をもう一度押すと閉じる。
  await rows
    .first()
    .getByRole("button", { name: /詳細を閉じる/ })
    .click();
  await expect(rows).toHaveCount(before, { timeout: 90_000 });
});

test("B: 取引先タブは展開しても read-only", async ({ page }) => {
  await signIn(page);
  await page.goto("/members?tab=dealer", { timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });

  const rows = page.getByRole("table").locator("tbody tr");
  const count = await rows.count();
  test.skip(count === 0, "取引先のシステムユーザーがいない環境ではスキップ");

  await rows.first().click();
  const banner = rows.nth(1);
  await expect(banner).toContainText("取引先のアカウントはこの画面では編集できません");
  await expect(banner.getByRole("button", { name: /編集|削除/ })).toHaveCount(0);
});

test("C: BIツールはサイドバーに出ないが、route は残っている", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard", { timeout: 120_000 });

  const nav = page.getByRole("navigation");
  await expect(nav).toBeVisible({ timeout: 90_000 });
  await expect(nav.getByText("BIツール", { exact: true })).toHaveCount(0);
  // 他のトップレベル項目は残っている（ナビ全体が壊れていないことの確認）。
  await expect(nav.getByText("顧客管理", { exact: true })).toBeVisible();

  // 機能自体は消していない — 直接 URL では開ける。
  const res = await page.goto("/bi", { timeout: 120_000 });
  expect(res?.status(), "/bi は 200 のまま").toBe(200);
});

test("D: コール一覧のコール状況が status 表現で並ぶ", async ({ page }) => {
  await signIn(page);
  await page.goto("/customers/maekaku", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "コール一覧" })).toBeVisible({ timeout: 90_000 });

  const table = page.getByRole("table");
  const rows = table.locator("tbody tr");
  await expect(rows.first()).toBeVisible({ timeout: 90_000 });

  // 4 つのコール列（3〜6 列目）は、値があれば status バッジで描かれる。
  const statuses = await page.evaluate(() => {
    const out: string[] = [];
    for (const row of Array.from(document.querySelectorAll("table tbody tr"))) {
      const tds = Array.from(row.querySelectorAll("td")).slice(2, 6);
      for (const td of tds) {
        const badge = td.querySelector("[class*='rounded-sm'][class*='inline-flex']");
        if (badge?.textContent) out.push(badge.textContent.trim());
      }
    }
    return Array.from(new Set(out));
  });
  expect(statuses.length, "コール状況が status として描かれている").toBeGreaterThan(0);
  // 既存 mapping の値域だけが出る（新しいラベルを作っていない）。
  for (const s of statuses) {
    expect(["実施済", "実施済み", "実施前", "不要", "未実施"]).toContain(s);
  }

  // 行高が揃っている（内容で行がガタつかない）。
  const heights = await page.evaluate(() =>
    Array.from(
      new Set(
        Array.from(document.querySelectorAll("table tbody tr"))
          .slice(0, 12)
          .map((r) => Math.round(r.getBoundingClientRect().height)),
      ),
    ),
  );
  expect(heights, "同一一覧内の行高は 1 種類").toHaveLength(1);
});

// --- ロール階層（OWNER > SYSTEM_ADMIN > GENERAL_USER）------------------------
//
// 「自分より上位のユーザーは登録・編集・削除できない」ことを UI と
// Server Action の両面で確認する。

const SYSTEM_ADMIN_EMAIL = "sysadmin@solar-saas.demo";
const OWNER_NAME = "デモ オーナー";
const SYSTEM_ADMIN_NAME = "デモ システム管理者";
const GENERAL_USER_NAME = "デモ 一般ユーザー";

async function signInAs(page: Page, email: string): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "サインイン" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
}

/** 氏名で行を開き、その展開バナーを返す。 */
async function openRowByName(page: Page, name: string) {
  const table = page.getByRole("table");
  const row = table.locator("tbody tr").filter({ hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 90_000 });
  const opener = row.getByRole("button", { name: /詳細を開く/ });
  if ((await opener.count()) > 0) await opener.click();
  return table.locator("tbody tr").filter({ hasText: "2FA" }).first();
}

test("E: システム管理者は上位（オーナー）を編集・削除できない", async ({ page }) => {
  await signInAs(page, SYSTEM_ADMIN_EMAIL);
  await page.goto("/members", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "システムユーザー" })).toBeVisible({
    timeout: 90_000,
  });

  // 一覧には出る（表示は可能）。
  await expect(page.getByRole("table").getByText(OWNER_NAME)).toBeVisible();

  // 展開しても操作は出さず、理由だけ出す。
  const ownerBanner = await openRowByName(page, OWNER_NAME);
  await expect(ownerBanner).toContainText("上位権限のユーザーは編集できません");
  await expect(ownerBanner.getByRole("button", { name: /編集|削除/ })).toHaveCount(0);
});

test("F: システム管理者は同階層・下位を編集できる", async ({ page }) => {
  await signInAs(page, SYSTEM_ADMIN_EMAIL);
  await page.goto("/members", { timeout: 120_000 });

  for (const name of [SYSTEM_ADMIN_NAME, GENERAL_USER_NAME]) {
    const banner = await openRowByName(page, name);
    await expect(banner.getByRole("button", { name: "編集" }), name).toBeVisible();
    await expect(banner.getByRole("button", { name: "削除" }), name).toBeVisible();
    // 開いた行を閉じてから次へ。
    const row = page.getByRole("table").locator("tbody tr").filter({ hasText: name }).first();
    await row.getByRole("button", { name: /詳細を閉じる/ }).click();
  }
});

test("G: 招待・編集のロール選択肢に上位ロールが出ない", async ({ page }) => {
  await signInAs(page, SYSTEM_ADMIN_EMAIL);
  await page.goto("/members", { timeout: 120_000 });

  // 招待ダイアログ。
  await page.getByRole("button", { name: "招待" }).click();
  const invite = page.getByRole("dialog");
  const inviteOptions = (
    await invite.getByLabel("招待ロール").locator("option").allInnerTexts()
  ).map((s) => s.trim());
  expect(inviteOptions).toEqual(["システム管理者", "一般ユーザー"]);
  await page.keyboard.press("Escape");

  // 編集ダイアログ。
  const banner = await openRowByName(page, GENERAL_USER_NAME);
  await banner.getByRole("button", { name: "編集" }).click();
  const edit = page.getByRole("dialog");
  const editOptions = (await edit.getByLabel("ロール").locator("option").allInnerTexts()).map((s) =>
    s.trim(),
  );
  expect(editOptions).toEqual(["システム管理者", "一般ユーザー"]);
});

test("H: オーナーは 3 ロールすべてを指定でき、全ユーザーを管理できる", async ({ page }) => {
  await signInAs(page, DEMO_EMAIL);
  await page.goto("/members", { timeout: 120_000 });

  await page.getByRole("button", { name: "招待" }).click();
  const invite = page.getByRole("dialog");
  const options = (await invite.getByLabel("招待ロール").locator("option").allInnerTexts()).map(
    (s) => s.trim(),
  );
  expect(options).toEqual(["オーナー", "システム管理者", "一般ユーザー"]);
  await page.keyboard.press("Escape");

  // オーナー配下では、上位ロールの相手が居ないので操作が出る。
  const banner = await openRowByName(page, OWNER_NAME);
  await expect(banner.getByRole("button", { name: "編集" })).toBeVisible();
  await expect(banner).not.toContainText("上位権限のユーザーは編集できません");
});

test("I: 上位ロールの指定は server action 側で拒否される", async ({ page }) => {
  await signInAs(page, SYSTEM_ADMIN_EMAIL);
  await page.goto("/members", { timeout: 120_000 });

  const banner = await openRowByName(page, GENERAL_USER_NAME);
  await banner.getByRole("button", { name: "編集" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 90_000 });

  // クライアント側の選択肢制限を迂回して OWNER を送る。
  // UI で隠すだけでは不十分なので、サーバー側で弾けることを確認する。
  await page.evaluate(() => {
    const select = Array.from(document.querySelectorAll('[role="dialog"] select')).find((s) =>
      s.id.startsWith("member-role"),
    ) as HTMLSelectElement;
    const option = document.createElement("option");
    option.value = "OWNER";
    option.textContent = "オーナー";
    select.appendChild(option);
    select.value = "OWNER";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await dialog.getByRole("button", { name: /^保存/ }).click();

  // 拒否されるのでダイアログは閉じない。
  await expect(dialog).toBeVisible({ timeout: 30_000 });

  // 一覧側でも昇格していない。
  await page.goto("/members", { timeout: 120_000 });
  const row = page
    .getByRole("table")
    .locator("tbody tr")
    .filter({ hasText: GENERAL_USER_NAME })
    .first();
  await expect(row, "オーナーへ昇格していない").not.toContainText("オーナー");
  await expect(row).toContainText("一般ユーザー");
});
