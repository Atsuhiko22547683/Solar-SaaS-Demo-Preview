import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

// イベント候補の「催事種別 / ブース場所 / 商材種別」の登録 → 再読込確認。
//
// ブース場所の自由記述（boothAreaNote）は「その他」を選んだときだけ入力欄が出て、
// 別の種別に戻すと保存されないこと（サーバ側でも null に正規化される）も見る。
//
// 登録した候補は afterAll で必ず削除する（実行のたびに一覧へ積み上げない）。

const DEMO_EMAIL = "demo@solar-saas.demo";
const DEMO_PASSWORD = "Demo1234!";

const RUN_ID = Date.now();
/** cleanup が完全一致で消す店舗名。 */
const STORE_NAME = `E2E催事基本情報${RUN_ID}`;

const FIXTURE_DIR = resolve(__dirname, "fixtures");
const DB_DIR = resolve(__dirname, "..", "..", "packages", "db");

let candidateId = "";

/**
 * イベント候補の「詳細」ページか。
 * /event-detail/new も同じ階層にあるので、単純な /<id> 判定だと新規画面に合致する。
 * ID が "new" のときだけ明示的に除外する。
 */
function isCandidateDetailUrl(url: URL): boolean {
  const m = url.pathname.match(/^\/event-detail\/([A-Za-z0-9_-]+)$/);
  return m !== null && m[1] !== "new";
}

async function signInAsDemo(page: Page): Promise<void> {
  await page.goto("/login", { timeout: 120_000 });
  await page.getByLabel("メールアドレス").fill(DEMO_EMAIL);
  await page.getByLabel("パスワード").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "サインイン" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 120_000 });
}

test.describe.serial("イベント候補の催事種別 / ブース場所 / 商材種別", () => {
  test.describe.configure({ timeout: 240_000 });

  test.afterAll(() => {
    execFileSync(
      "pnpm",
      ["exec", "tsx", resolve(FIXTURE_DIR, "cleanup-e2e-event-candidate.ts"), String(RUN_ID)],
      { cwd: DB_DIR, stdio: "inherit", shell: process.platform === "win32" },
    );
  });

  test("シナリオ1: ブース場所「その他」のときだけ自由記述欄が出る", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/event-detail/new", { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "イベント候補を新規登録" })).toBeVisible({
      timeout: 90_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });

    const boothArea = page.getByLabel("ブース場所", { exact: true });
    const note = page.getByLabel("ブース場所（その他の内容）", { exact: true });

    // 未設定 / 定型の選択肢では自由記述欄を出さない。
    await expect(note).toHaveCount(0);
    await boothArea.selectOption("ENTRANCE");
    await expect(note).toHaveCount(0);

    // 「その他」を選んだときだけ出す。
    await boothArea.selectOption("OTHER");
    await expect(note).toBeVisible({ timeout: 20_000 });

    // 別の種別に戻すと再び隠れる。
    await boothArea.selectOption("REFORM_CORNER");
    await expect(note).toHaveCount(0);
  });

  test("シナリオ2: 3 項目を入力して登録でき、再読込後も保持される", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/event-detail/new", { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "イベント候補を新規登録" })).toBeVisible({
      timeout: 90_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });

    await page.getByLabel("店舗名", { exact: false }).fill(STORE_NAME);
    await page.getByLabel("対象年月（YYYY-MM）", { exact: false }).fill("2027-05");
    await page.getByLabel("実施予定日", { exact: false }).fill("2027-05-20");
    await page.getByLabel("回答期限", { exact: false }).fill("2027-05-01T10:00");

    await page.getByLabel("催事種別", { exact: true }).selectOption("SHIMACHU");
    await page.getByLabel("商材種別", { exact: true }).selectOption("HOUSING_EQUIPMENT");
    await page.getByLabel("ブース場所", { exact: true }).selectOption("OTHER");
    await page
      .getByLabel("ブース場所（その他の内容）", { exact: true })
      .fill("園芸コーナー横 特設スペース");

    await page.getByRole("button", { name: "登録", exact: true }).click();

    // 登録すると詳細ページへ遷移する。
    await page.waitForURL(isCandidateDetailUrl, { timeout: 90_000 });
    const m = page.url().match(/\/event-detail\/([A-Za-z0-9_-]+)/);
    expect(m, `詳細ページへ遷移しなかった: ${page.url()}`).not.toBeNull();
    candidateId = m![1]!;
    expect(candidateId).not.toBe("new");

    // 再読込しても 3 項目が保持されていること。
    // 検証対象は詳細ページ左上の「基本情報」カードで、これはページ内で最初の定義リスト。
    // 同ページ下部のアポ一覧（デモデータ）にも同じ文言のバッジが出るため、
    // 「基本情報カード内の dt に続く dd」を明示的に指して引く。
    await page.reload();
    const basicInfo = page.locator("dl").first();
    const fieldValue = (label: string) =>
      basicInfo.locator("div", { has: page.getByText(label, { exact: true }) }).locator("dd");

    await expect(fieldValue("催事種別")).toHaveText("島忠", { timeout: 60_000 });
    await expect(fieldValue("商材種別")).toHaveText("住設設備", { timeout: 20_000 });
    // 「その他」は自由記述を併記して表示する。
    await expect(fieldValue("ブース場所")).toHaveText("その他（園芸コーナー横 特設スペース）", {
      timeout: 20_000,
    });
  });

  test("シナリオ3: 3 項目とも未設定のまま登録できる", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/event-detail/new", { timeout: 120_000 });
    await expect(page.getByRole("heading", { name: "イベント候補を新規登録" })).toBeVisible({
      timeout: 90_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 90_000 });

    await page.getByLabel("店舗名", { exact: false }).fill(`${STORE_NAME}未設定`);
    await page.getByLabel("対象年月（YYYY-MM）", { exact: false }).fill("2027-06");
    await page.getByLabel("実施予定日", { exact: false }).fill("2027-06-20");
    await page.getByLabel("回答期限", { exact: false }).fill("2027-06-01T10:00");

    await page.getByRole("button", { name: "登録", exact: true }).click();
    await page.waitForURL(isCandidateDetailUrl, { timeout: 90_000 });

    // 未設定は「—」で表示される（値が落ちてもエラーにならない）。
    await page.reload();
    await expect(page.getByText("催事種別", { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("ブース場所", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("商材種別", { exact: true })).toBeVisible({ timeout: 20_000 });
  });
});
