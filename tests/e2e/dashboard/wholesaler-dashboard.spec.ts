import { expect, test } from "@playwright/test";

import { signIn } from "../fixtures/auth";

// E2E spec — 卸業者ホーム (S-018)。
//
// ホームは「実績の閲覧」ではなく「対応待ちの拾い上げ」を目的に構成している。
// 最上段に要対応キュー（取引先希望提出状況 / マエカク未対応 / 未読通知）、
// 続いて今週の催事、最後に当月成績サマリという順序。
// 集計値そのものはシード内容に依存するため、ここでは構造と遷移導線のみ検証する。

test.describe.configure({ timeout: 90_000 });

// Seed は `tests/e2e/global-setup.ts` で 1 回だけ実行される。

test("wholesaler_admin sees the work queue and summary sections on the dashboard", async ({
  page,
}) => {
  await signIn(page, "wholesaler_admin@solar-saas.dev");

  await page.goto("/dashboard");
  // 見出しはサイドバーの項目名と一致させている（どちらも「ホーム」）。
  await expect(page.getByRole("heading", { name: "ホーム", level: 1 })).toBeVisible();

  // 要対応キューの 3 項目。
  await expect(page.getByRole("heading", { name: "取引先希望提出状況", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "マエカク未対応", level: 3 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "未読通知", level: 3 })).toBeVisible();

  // セクション見出し。
  await expect(page.getByRole("heading", { name: "要対応", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "今週の催事", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "当月成績サマリ", level: 2 })).toBeVisible();

  // 各セクションの遷移リンク。
  await expect(page.getByRole("link", { name: "通知一覧を開く" })).toBeVisible();
  await expect(page.getByRole("link", { name: "イベント体制決定画面を開く" })).toBeVisible();
  await expect(page.getByRole("link", { name: "マエカク一覧を開く" })).toBeVisible();
  await expect(page.getByRole("link", { name: "月次レポートを開く" })).toBeVisible();
});
