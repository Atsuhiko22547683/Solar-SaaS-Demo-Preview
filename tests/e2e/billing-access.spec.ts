import { expect, test, type Page } from "@playwright/test";

// BizOrch 利用料の支払い状態による利用制限。
//
//   A. ホームに決済状態の警告が出る（未登録 / 未払い）
//   B. サイドバーの通常機能が非活性になる（消えない）
//   C. URL 直打ちでも通常機能を開けない
//   D. オーナーには決済管理ページへの導線が出る
//   E. オーナー以外には「オーナーに依頼してください」と出る
//   F. /payments に支払い方法（ブランド + 下 4 桁）と支払い状態が出る
//   G. 支払い済みならホームに警告を出さず、通常機能を使える
//
// 決済状態は BILLING_STATUS_OVERRIDE（開発専用・production では無効）で作る。
// Stripe Sandbox のキーが無い環境でも、制限まわりの挙動を固定できるようにするため。
// Stripe 実接続そのものの確認は stripe-sandbox.spec.ts が担当する。

const OWNER = "owner@solar-saas.demo";
const GENERAL_USER = "user@solar-saas.demo";
const PASSWORD = "Demo1234!";

test.describe.configure({ timeout: 180_000 });

/** 現在の dev server がどの決済状態で動いているか。 */
const OVERRIDE = process.env.BILLING_STATUS_OVERRIDE ?? "";

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByLabel("パスワード").fill(PASSWORD);
  await page.getByRole("button", { name: "サインイン" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
}

async function openHome(page: Page): Promise<void> {
  await page.goto("/dashboard", { timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 90_000 });
}

test.describe("利用停止中（決済情報未登録 / 未払い）", () => {
  test.skip(
    OVERRIDE !== "PAYMENT_METHOD_MISSING" && OVERRIDE !== "UNPAID",
    "BILLING_STATUS_OVERRIDE=PAYMENT_METHOD_MISSING または UNPAID で dev server を起動して実行する",
  );

  const expectedTitle =
    OVERRIDE === "UNPAID" ? "お支払いが確認できていません" : "決済情報が登録されていません";

  test("A/D: オーナーのホームに警告と決済管理ページへの導線が出る", async ({ page }) => {
    await signIn(page, OWNER);
    await openHome(page);

    const alert = page.getByRole("status").filter({ hasText: expectedTitle });
    await expect(alert).toBeVisible({ timeout: 90_000 });
    await expect(alert.getByRole("link", { name: "決済管理ページへ" })).toBeVisible();

    // 決済管理へは進める。
    await alert.getByRole("link", { name: "決済管理ページへ" }).click();
    await expect(page).toHaveURL(/\/payments/, { timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "決済管理" })).toBeVisible();
  });

  test("B: サイドバーの通常機能が非活性になる（項目自体は残る）", async ({ page }) => {
    await signIn(page, OWNER);
    await openHome(page);

    const nav = page.getByRole("navigation").first();
    // 消さない。「利用停止中」だと分かる形で残す。
    await expect(nav.getByText("顧客管理", { exact: true })).toBeVisible();

    // 中を開くと、項目は並んでいるが押せない。
    await nav.getByRole("button", { name: "顧客管理" }).click();
    const child = nav.locator('[aria-disabled="true"]').filter({ hasText: "顧客一覧" }).first();
    await expect(child).toHaveAttribute("title", /決済情報の登録またはお支払いが必要です/);
    // 押せるリンクとしては存在しない。
    await expect(nav.getByRole("link", { name: "顧客一覧", exact: true })).toHaveCount(0);

    // ホームと決済管理は押せるまま。
    await expect(nav.getByRole("link", { name: "ホーム", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "決済管理", exact: true })).toBeVisible();
  });

  test("C: URL 直打ちでも通常機能を開けない", async ({ page }) => {
    await signIn(page, OWNER);

    for (const path of ["/customers", "/product-catalog/pv", "/members", "/line-events"]) {
      await page.goto(path, { timeout: 120_000 });
      await page.waitForLoadState("networkidle", { timeout: 90_000 });
      // ホームへ戻される（行き止まりにせず、理由が見える場所へ送る）。
      await expect(page, `${path} は開けない`).toHaveURL(/\/dashboard/, { timeout: 90_000 });
    }
  });

  test("H: 390 / 834 / 1440px で警告と決済管理が崩れない", async ({ page }) => {
    await signIn(page, OWNER);

    for (const width of [390, 834, 1440]) {
      await page.setViewportSize({ width, height: 900 });

      for (const path of ["/dashboard", "/payments"]) {
        await page.goto(path, { timeout: 120_000 });
        await page.waitForLoadState("networkidle", { timeout: 90_000 });
        await page.waitForTimeout(400);

        const result = await page.evaluate(() => {
          const vw = window.innerWidth;
          // 画面外へ出ている操作要素。閉じたモバイルナビ（aside）内は除く。
          const outside = Array.from(document.querySelectorAll("a,button,select")).filter((el) => {
            if (el.closest("aside")) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && (r.right > vw + 1 || r.left < -1);
          }).length;
          return {
            pageOverflow: document.documentElement.scrollWidth > vw + 1,
            outside,
          };
        });

        expect(result.pageOverflow, `${width}px ${path} に横スクロールが出ない`).toBe(false);
        expect(result.outside, `${width}px ${path} の操作要素が画面内に収まる`).toBe(0);
      }
    }
  });

  test("E: 一般ユーザーにはオーナーへの依頼だけが出る", async ({ page }) => {
    await signIn(page, GENERAL_USER);
    await openHome(page);

    const alert = page.getByRole("status").filter({ hasText: expectedTitle });
    await expect(alert).toBeVisible({ timeout: 90_000 });
    // 自分では解決できないので、決済管理への導線は出さない。
    await expect(alert.getByRole("link", { name: "決済管理ページへ" })).toHaveCount(0);
    await expect(alert).toContainText("オーナーに");

    // 決済管理は従来どおりロールで 403（利用停止とは別の理由）。
    await page.goto("/payments", { timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });
    await expect(page.getByRole("heading", { name: "決済管理" })).toHaveCount(0);

    // 通常機能も開けない。
    await page.goto("/customers", { timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 90_000 });
  });
});

test.describe("支払い済み", () => {
  test.skip(
    OVERRIDE !== "ACTIVE",
    "BILLING_STATUS_OVERRIDE=ACTIVE で dev server を起動して実行する",
  );

  test("G: ホームに警告が出ず、通常機能を使える", async ({ page }) => {
    await signIn(page, OWNER);
    await openHome(page);

    await expect(page.getByText("決済情報が登録されていません")).toHaveCount(0);
    await expect(page.getByText("お支払いが確認できていません")).toHaveCount(0);

    await page.goto("/product-catalog/pv", { timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });
    await expect(page).toHaveURL(/\/product-catalog\/pv/);
  });

  test("F: /payments に支払い方法と支払い状態が出る", async ({ page }) => {
    await signIn(page, OWNER);
    await page.goto("/payments", { timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });

    await expect(page.getByRole("heading", { name: "決済管理" })).toBeVisible({ timeout: 90_000 });
    // ブランド + 下 4 桁。カード番号そのものは決して出さない。
    await expect(page.getByText(/Visa •••• \d{4}/)).toBeVisible();
    await expect(page.getByText("支払い済み", { exact: true })).toBeVisible();

    // 「Stripeで管理」ではなく「決済管理ページ」。
    await expect(page.getByRole("button", { name: "決済管理ページ" })).toBeVisible();
    await expect(page.getByText("Stripeで管理")).toHaveCount(0);
  });
});
