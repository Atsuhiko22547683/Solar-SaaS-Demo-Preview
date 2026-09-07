import { expect, type Page } from "@playwright/test";

// 顧客一覧まわりの共有ヘルパー。
//
// 顧客一覧はリスト刷新で、行が「1 列目のリンク」から
// role="button" の <tr>（aria-label="<氏名>様"）へ変わった。クリックで詳細へ遷移する。
// 旧 spec が使っていた `table tbody tr:first-child td:first-child a` はもう存在しない。
//
// 「先頭行 = 直前に登録した顧客」という前提も置かない（並び順や既存データに依存する）。
// 氏名で検索して 1 件に絞り、その行を開いて URL から ID を取る。

/**
 * 顧客一覧を氏名で検索し、その顧客の詳細を開いて顧客 ID を返す。
 *
 * @param name E2E が登録した一意な氏名（RUN_ID 付きを想定）
 */
export async function openCustomerByName(page: Page, name: string): Promise<string> {
  await page.goto(`/customers?query=${encodeURIComponent(name)}`);
  await expect(page.getByRole("heading", { name: "顧客一覧" })).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");

  // 行の aria-label は `<氏名>様`（敬称の前に空白なし）。氏名だけの部分一致で引く。
  const row = page.getByRole("button", { name });
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.click();

  await page.waitForURL(/\/customers\/[A-Za-z0-9_-]+/, { timeout: 30_000 });
  const m = page.url().match(/\/customers\/([A-Za-z0-9_-]+)/);
  expect(m, `顧客詳細へ遷移しなかった: ${page.url()}`).not.toBeNull();
  return m![1]!;
}
