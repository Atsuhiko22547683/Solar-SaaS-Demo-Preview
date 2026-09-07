import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        // 和欧混植。欧文・数字は Inter、日本語は OS 標準の日本語フェイスへ
        // 明示的にフォールバックさせる（globals.css の body と同一スタック）。
        sans: [
          "Inter",
          "Hiragino Kaku Gothic ProN",
          "Hiragino Sans",
          "Noto Sans JP",
          "Yu Gothic Medium",
          "Yu Gothic",
          "Meiryo",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        // ── Brand ──────────────────────────────────────────────────────────
        // 単一アクセント。ブランドブルーは唯一の「操作可能」を表す色で、
        // 状態色（status.*）とは役割を分ける。
        primary: {
          DEFAULT: "#0070d1",
          foreground: "#ffffff",
          pressed: "#0064b7",
          active: "#004d8d",
        },

        // ── Surfaces ───────────────────────────────────────────────────────
        // ページ地を slate-50 にティントし、カード/入力を白で浮かせる。
        "canvas-light": "#ffffff",
        page: "#f8fafc", // アプリのページ背景 (slate-50)
        "surface-soft": "#f1f5f9", // hover 行 / ソフトパネル (slate-100)
        "surface-card": "#f8fafc", // テーブルヘッダ等 (slate-50)

        // ── Text ───────────────────────────────────────────────────────────
        // 見出しは純黒ではなく slate-900。白背景に対し 17.9:1 で、
        // 純黒より締まりが出て本文 (slate-700) との段差も自然になる。
        ink: "#0f172a",
        "body-light": "#334155", // 本文 (slate-700, 10.4:1)
        "mute-light": "#64748b", // 二次テキスト (slate-500, 4.8:1 AA)
        "on-dark": "#ffffff",

        // ── Lines ──────────────────────────────────────────────────────────
        // 罫線は用途で 2 段階だけ持つ。
        //   hairline-light … 表の行区切り・カード外周（装飾的）
        //   ash-light      … 入力欄の枠（UI 部品の境界。WCAG 1.4.11 の 3:1 を満たす）
        "hairline-light": "#e2e8f0", // slate-200
        "ash-light": "#828fa1", // 白背景に対し 3.28:1

        // ── Status ─────────────────────────────────────────────────────────
        // 業務上の「状態」を表す意味色。アクセント（primary）とは独立。
        // 全色とも白背景に対して AA (4.5:1) 以上。
        danger: { DEFAULT: "#b3261e", foreground: "#ffffff" }, // 期限超過 / 破壊的操作 (6.5:1)
        caution: "#9a5b00", // 期限間近 / 要確認 (5.4:1)
        ok: "#15803d", // 完了 / 正常 (5.0:1)
        "link-light": "#0064b7",

        // ── shadcn 互換エイリアス ──────────────────────────────────────────
        // shadcn/ui 由来のコンポーネントが参照する名前。上の実体を指すだけで、
        // 新しい色は増やさない。
        background: "#ffffff",
        foreground: "#0f172a",
        border: "#e2e8f0",
        ring: "#0070d1",
        destructive: { DEFAULT: "#b3261e", foreground: "#ffffff" },
        muted: { DEFAULT: "#f1f5f9", foreground: "#64748b" },
        accent: { DEFAULT: "#f1f5f9", foreground: "#0f172a" },
        secondary: { DEFAULT: "#f1f5f9", foreground: "#0f172a" },
        card: { DEFAULT: "#ffffff", foreground: "#0f172a" },
        popover: { DEFAULT: "#ffffff", foreground: "#0f172a" },
        input: "#828fa1",
      },
      // 角丸は 1 段階を基本にする。ボタン/入力/カードで半径を変えると
      // 同じ画面の中で別々の出自の部品に見えるため、md に揃える。
      // full はアバターとページャの現在地など「円であること」に意味がある箇所のみ。
      borderRadius: {
        sm: "4px", // バッジ・チップ
        md: "6px", // ボタン・入力・カード（既定）
        lg: "8px", // モーダル・ポップオーバー
        full: "9999px",
        DEFAULT: "6px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      // 業務ツールのホバー/押下フィードバックは即時性が要る。
      // 330ms は体感で明確に遅れるため、標準的な 140ms にする。
      transitionDuration: {
        DEFAULT: "140ms",
      },
    },
  },
  plugins: [animate],
};

export default config;
