// サイト（一次代理店 / 二次店スタッフ / 二次店管理者 / 運営管理）ごとに Next を起動する。
//
// 4 サイトは同じコードベースから別プロセスとして動く。プロセスごとに違うのは
//   - APP_VARIANT      … 公開する画面・Cookie 接頭辞・サイト区分
//   - NEXT_DIST_DIR    … ビルド成果物とキャッシュの置き場
//   - ポート
// の 3 つだけ。distDir を分けないと、同じ .next を複数プロセスが書き合って
// 片方の再起動がもう片方を壊す（dev のホットリロードでも起きる）。
//
// 使い方:
//   node scripts/run-site.mjs <agency|partner|partner-admin|system-admin> <dev|build|start> [...next args]
//
// 環境変数を先に決めてから next を起動するので、npm スクリプト側で
// OS ごとの env 設定の書き分け（cross-env 等）が要らない。

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const VARIANTS = new Set(["agency", "partner", "partner-admin", "system-admin"]);

/** サイトごとのビルド出力先。既定サイト（agency）は従来どおり .next。 */
const DIST_DIRS = {
  agency: ".next",
  partner: ".next-partner",
  "partner-admin": ".next-partner-admin",
  "system-admin": ".next-system-admin",
};

const [variant, command, ...rest] = process.argv.slice(2);

if (!VARIANTS.has(variant)) {
  console.error(
    `run-site: サイト区分が不正です: "${variant ?? ""}"。${[...VARIANTS].join(" / ")} のいずれかを指定してください。`,
  );
  process.exit(1);
}
if (!command) {
  console.error("run-site: next のコマンド（dev / build / start）を指定してください。");
  process.exit(1);
}

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = resolve(
  webRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next",
);

const child = spawn(nextBin, [command, ...rest], {
  cwd: webRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    APP_VARIANT: variant,
    NEXT_DIST_DIR: DIST_DIRS[variant],
  },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
