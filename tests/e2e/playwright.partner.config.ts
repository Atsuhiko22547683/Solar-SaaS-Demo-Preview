import { defineConfig, devices } from "@playwright/test";

// 二次店サイト（スタッフ / 管理者）の E2E 設定。
//
// 2 サイトは別プロセス・別 URL で動くので、同じ設定ファイルの中で
// project を 2 つに分け、それぞれ別の baseURL を見る。
// 「同じ URL にアカウントを入れ替えて入る」形では分離の検証にならないため。
//
//   staff  … APP_VARIANT=partner        http://localhost:3200
//   admin  … APP_VARIANT=partner-admin  http://localhost:3300
//
// 代理店サイト（playwright.config.ts / port 3100）とは独立して動かす。
// workers:1 + fullyParallel:false は既存方針を踏襲（docs/dev-plan.md §6）。
// シードは globalSetup で 1 回だけ実行する（2 サイトで共有）。

// ポートは package.json の dev:partner / dev:partner-admin と同じ値で固定する
// （起動コマンド側と食い違うと webServer の待ち受け先がずれるため）。
const STAFF_URL = "http://localhost:3200";
const ADMIN_URL = "http://localhost:3300";

// 招待リンクの検証で使うため、テスト実行プロセスにも各サイトの URL を渡す。
process.env.PARTNER_APP_URL ??= STAFF_URL;
process.env.PARTNER_ADMIN_APP_URL ??= ADMIN_URL;

export default defineConfig({
  testDir: ".",
  testMatch: /partner-.*\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  globalSetup: require.resolve("./global-setup"),
  // 実行後に E2E が作った行を片付ける（確認用 DB を膨らませない）。
  globalTeardown: require.resolve("./global-teardown"),

  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  },

  projects: [
    {
      name: "staff",
      testMatch: /partner-(portal|staff|lists|responsive|shots|flow|mobile-shots)\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], baseURL: STAFF_URL },
    },
    {
      name: "admin",
      testMatch: /partner-(admin|responsive|shots|flow|mobile-shots)\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], baseURL: ADMIN_URL },
    },
  ],

  // 2 サイトを同時に起動する。distDir は run-site.mjs がサイトごとに分けるので、
  // 片方の再起動がもう片方のビルド成果物を壊さない。
  webServer: [
    {
      command: "pnpm -F @solar/web dev:partner",
      url: STAFF_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
      env: { PARTNER_APP_URL: STAFF_URL, PARTNER_ADMIN_APP_URL: ADMIN_URL },
    },
    {
      command: "pnpm -F @solar/web dev:partner-admin",
      url: ADMIN_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
      env: { PARTNER_APP_URL: STAFF_URL, PARTNER_ADMIN_APP_URL: ADMIN_URL },
    },
  ],
});
