import { expect, test } from "@playwright/test";

import { signIn } from "../fixtures/auth";

// E2E spec for /masters — エリア・場所管理（旧「マスタ管理」ハブ）。
//
// 現行仕様は 2 タブ構成（エリア設定 / 場所提供元）。
//   - 取引先の管理は「設定 > 取引先管理」(/masters/relationships) へ責務分離済み。
//     このハブに取引先一覧タブは無い。
//   - 施工業者 / インセンティブ率 / キャンセル期限 / 年度開始月 は独立画面へ移動済みで、
//     それぞれ専用 spec（installers / incentive-rates / wholesaler-settings）が担当する。
//
// タブ切替は shadcn Tabs (Radix) なので独立 URL への遷移は発生しない
// （同じ /masters 配下で role=tabpanel の data-state が切り替わる）。
//
// Seed は `tests/e2e/global-setup.ts` で全 spec 起動前に 1 回だけ実行される。

test.describe.configure({ timeout: 90_000 });

test("wholesaler_admin sees the 2 tabs and can switch panels on the area/venue hub", async ({
  page,
}) => {
  await signIn(page, "wholesaler_admin@solar-saas.dev");

  await page.goto("/masters");
  await expect(page.getByRole("heading", { name: "エリア・場所管理", level: 1 })).toBeVisible();

  // 2 タブのトリガーが描画されている (role=tab)。
  for (const label of ["エリア設定", "場所提供元"]) {
    await expect(page.getByRole("tab", { name: label })).toBeVisible();
  }

  // 取引先一覧タブは削除済み（設定 > 取引先管理へ分離）。
  await expect(page.getByRole("tab", { name: "取引先一覧" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "取引先関係" })).toHaveCount(0);
  // 旧ハブに同居していた他マスタのタブも無い。
  for (const gone of ["施工業者", "インセンティブ率", "キャンセル期限", "年度開始月"]) {
    await expect(page.getByRole("tab", { name: gone })).toHaveCount(0);
  }

  // 既定は「エリア設定」タブ。
  await expect(page.getByRole("tab", { name: "エリア設定" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  // 場所提供元タブへ切替 → パネルが入れ替わる。
  await page.getByRole("tab", { name: "場所提供元" }).click();
  await expect(page.getByRole("tab", { name: "場所提供元" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("link", { name: "一覧画面を開く" }).first()).toBeVisible();
});

test("取引先管理は設定メニューから /masters/relationships へ遷移できる", async ({ page }) => {
  await signIn(page, "wholesaler_admin@solar-saas.dev");

  // 設定配下のページから始めるとアコーディオンが開いた状態で描画される。
  await page.goto("/masters");
  await page.waitForLoadState("networkidle");

  const link = page.getByRole("link", { name: "取引先管理" }).first();
  await expect(link).toBeVisible({ timeout: 30_000 });
  await link.click();

  await page.waitForURL(/\/masters\/relationships/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "取引先一覧", level: 1 })).toBeVisible({
    timeout: 30_000,
  });
});
