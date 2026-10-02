// Stripe SDK クライアント（server 専用）。
//
// このモジュールは **Sandbox / Test mode 専用**。`sk_live_` で始まるキーは
// 受け付けず、生成時点で必ず失敗させる。決済は取り返しがつかない操作なので、
// 「設定を間違えたら動かない」側に倒す（黙って本番へ繋がる余地を作らない）。
//
// Secret key は絶対にクライアントへ渡さない。"server-only" を import して
// client component からの取り込みをビルド時に落とす。
//
// production での本番キー運用は今回のスコープ外。将来 live を扱うときは
// ここに live 用の分岐と、環境の取り違えを防ぐ仕組みを別途足すこと。

import "server-only";

import Stripe from "stripe";

/** Sandbox の Secret key に必ず付く接頭辞。 */
const TEST_KEY_PREFIX = "sk_test_";

/**
 * Stripe のキーが設定されていない、または Test key ではない。
 *
 * 「未設定」と「設定はあるが不正」を呼び出し側で区別できるよう理由を持つ。
 * 未設定は開発環境で普通に起こる状態なので、例外にせず null で返す
 * （`getStripe()` 参照）。不正なキーだけが例外になる。
 */
export class StripeConfigError extends Error {
  readonly code = "STRIPE_CONFIG_INVALID";
}

/**
 * 設定済みの Secret key。未設定なら null。
 *
 * Test key でなければここで例外を投げる。呼び出し側が握りつぶしても
 * 本番キーで Stripe に繋がることはない。
 */
export function stripeSecretKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!key.startsWith(TEST_KEY_PREFIX)) {
    throw new StripeConfigError(
      `STRIPE_SECRET_KEY must be a Stripe test key (${TEST_KEY_PREFIX}…). ` +
        "This build only talks to the Stripe sandbox; live keys are rejected.",
    );
  }
  return key;
}

/** Stripe が設定されているか（キーがあり、かつ Test key）。 */
export function isStripeConfigured(): boolean {
  return stripeSecretKey() !== null;
}

let cached: Stripe | null = null;
let cachedKey: string | null = null;

/**
 * Stripe クライアント。未設定なら null を返す。
 *
 * 未設定でも画面は開ける必要があるため（開発環境ではキーが無いのが普通）、
 * ここでは例外にしない。呼び出し側は null を「Stripe に問い合わせできない」
 * として扱い、決済状態を ACTIVE と推定しないこと。
 */
export function getStripe(): Stripe | null {
  const key = stripeSecretKey();
  if (!key) return null;
  if (cached && cachedKey === key) return cached;
  cached = new Stripe(key, {
    // 数値の丸めや API 差分で挙動が変わらないよう、SDK 既定のバージョンに任せる。
    // タイムアウトは短めにする — 決済状態の取得が画面全体を待たせないため。
    timeout: 8_000,
    maxNetworkRetries: 1,
    appInfo: { name: "BizOrch (Solar SaaS)" },
  });
  cachedKey = key;
  return cached;
}
