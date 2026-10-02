// カタログ画面の金額表記。Decimal は文字列で届くので、整数円として整形する。
// "use client" も "server-only" も付けない純関数。

export function formatYen(value: string | null | undefined): string {
  if (!value) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}
