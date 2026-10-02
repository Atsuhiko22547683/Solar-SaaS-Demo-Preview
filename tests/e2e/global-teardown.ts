// Playwright globalTeardown — 実行のあと、E2E が作った行を確認用 DB から片付ける。
//
// spec は実行ごとに乱数つきの名前で顧客・催事・日報を作るので、片付けないと
// 確認用 DB が膨らんで画面間の関連を追えなくなる。
// シードが作る行（基本シード・旧デモ・最小デモ）と由来不明の行は触らない。
//
// 片付けに失敗してもテスト結果は変えない（後片付けが本体を落とさないようにする）。

import { execSync } from "node:child_process";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "..", "..");

export default async function globalTeardown(): Promise<void> {
  if (process.env.E2E_KEEP_DATA === "1") {
    console.info("[e2e] E2E_KEEP_DATA=1 のため後片付けを行いません");
    return;
  }
  try {
    execSync("pnpm -F @solar/db demo:purge-e2e", {
      cwd: REPO_ROOT,
      stdio: "inherit",
      env: process.env,
    });
  } catch (e) {
    console.warn(`[e2e] 後片付けに失敗しました（テスト結果には影響しません）: ${String(e)}`);
  }
}
