"use client";

// App Router のグローバルエラー境界。
//
// ルートレイアウトごと落ちた場合の最後の受け皿で、自前の <html> / <body> を返す。
// @sentry/nextjs を App Router で使う場合はこのファイルが必要で、
// 無いとビルド時に pages-router の /_error フォールバックが生成され、
// 「<Html> should not be imported outside of pages/_document」で
// 本番ビルドが失敗する。
//
// 表示は最小限にする。ここに業務情報やスタックトレースは出さない
// （個人情報や内部構造を画面へ出さないため）。詳細は Sentry 側で見る。

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

import { labels } from "@/lib/i18n/labels";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const t = labels.globalError;

  return (
    <html lang="ja">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily:
              "system-ui, -apple-system, 'Segoe UI', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif",
          }}
        >
          <div style={{ maxWidth: "28rem" }}>
            <h1 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>{t.title}</h1>
            <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#4b5563" }}>{t.body}</p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: "1rem",
                height: "2.25rem",
                padding: "0 0.75rem",
                borderRadius: "0.375rem",
                border: "1px solid #d1d5db",
                background: "#fff",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              {t.retry}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
