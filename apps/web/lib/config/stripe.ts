// Stripe ダッシュボードへのリンクだけを扱う設定モジュール。
//
// 現時点で Stripe API には接続していない（SDK / API key / webhook / checkout /
// payment intent なし）。UI から「Stripe を開く」ためのリンクを 1 か所に集約し、
// 将来 Stripe Customer ID / Payment ID を持てるようになったときに
// ここだけ差し替えれば個別決済画面へ飛ばせるようにしておく。

const DEFAULT_DASHBOARD_URL = "https://dashboard.stripe.com/";

/** Stripe ダッシュボードのベース URL。env で上書きできる。 */
export function stripeDashboardUrl(): string {
  const configured = process.env.STRIPE_DASHBOARD_URL?.trim();
  return configured && configured.length > 0 ? configured : DEFAULT_DASHBOARD_URL;
}

/**
 * 個別決済の Stripe リンク。
 *
 * 将来 Stripe の顧客 ID / 決済 ID を保存するようになったら、その値を渡すと
 * 該当ページへ直接飛べる。現在は保存していないので、呼び出し側は id を
 * 渡さずダッシュボードのトップを開く。
 */
export function stripePaymentUrl(ids?: {
  stripeCustomerId?: string | null;
  stripePaymentId?: string | null;
}): string {
  const base = stripeDashboardUrl().replace(/\/+$/, "");
  if (ids?.stripePaymentId) return `${base}/payments/${ids.stripePaymentId}`;
  if (ids?.stripeCustomerId) return `${base}/customers/${ids.stripeCustomerId}`;
  return `${base}/`;
}
