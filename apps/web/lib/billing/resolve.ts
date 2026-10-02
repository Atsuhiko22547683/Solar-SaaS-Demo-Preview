// Stripe から決済状態を取り、BillingSnapshot にまとめる（server 専用）。
//
// 判定規則そのものは status.ts の純関数が持つ。ここは I/O だけ:
//   1. 自テナントの stripeCustomerId を DB から引く（session 由来の tenantId が正。
//      クライアントから渡された id は一切信用しない）
//   2. Stripe から Customer / Subscription / Invoice を取る
//   3. status.ts に渡して status を決める
//
// キャッシュ:
//   画面遷移のたびに Stripe を叩かないよう、テナント単位で短い TTL（60 秒）を持つ。
//   支払い直後に「未払い」が残り続けないよう TTL は短くし、決済導線から戻ったときは
//   invalidateBillingSnapshot() で明示的に捨てる。
//   直近の正常値は少し長め（10 分）に別で保持し、Stripe が一時的に落ちたときの
//   フォールバックに使う（§37 の「障害で即ロックしない」ため）。
//   プロセス内メモリなので、インスタンスを増やすときは共有ストアへ移すこと。

import "server-only";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { getStripe, StripeConfigError } from "@/lib/stripe/client";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import { resolveBillingStatus, type BillingCard, type BillingSnapshot } from "./status";

import type Stripe from "stripe";

const FRESH_TTL_MS = 60_000;
const LAST_GOOD_TTL_MS = 10 * 60_000;

interface CacheEntry {
  snapshot: BillingSnapshot;
  fetchedAt: number;
}

const fresh = new Map<string, CacheEntry>();
const lastGood = new Map<string, CacheEntry>();

/** 決済状態が変わる操作（Customer 作成 / 決済管理ページからの復帰）の後に呼ぶ。 */
export function invalidateBillingSnapshot(tenantId: string): void {
  fresh.delete(tenantId);
}

/**
 * 開発時に決済状態を強制する逃げ道。
 *
 * Stripe のサンドボックスを用意しなくても、利用停止時の画面（ホームの警告 /
 * ナビの非活性 / URL 直打ちの遮断）をローカルと E2E で確認できるようにする。
 * production では一切効かない — 本番の課金判定を環境変数で曲げられないようにする。
 */
function overriddenStatus(): BillingSnapshot | null {
  if (process.env.NODE_ENV === "production") return null;
  const raw = process.env.BILLING_STATUS_OVERRIDE?.trim();
  if (!raw) return null;
  const allowed = ["ACTIVE", "PAYMENT_METHOD_MISSING", "UNPAID", "STRIPE_UNAVAILABLE"] as const;
  const match = allowed.find((v) => v === raw);
  if (!match) return null;
  return {
    status: match,
    // ACTIVE を強制したときだけ、支払い方法の表示も確認できるようダミーを返す。
    // Stripe のテストカード 4242… の下 4 桁で、実在のカードではない。
    card: match === "ACTIVE" ? { brand: "visa", last4: "4242", expMonth: 12, expYear: 2034 } : null,
    stripeCustomerId: match === "PAYMENT_METHOD_MISSING" ? null : "cus_local_override",
    unavailableReason: match === "STRIPE_UNAVAILABLE" ? "NOT_CONFIGURED" : null,
  };
}

/** Stripe の PaymentMethod から表示用のカード情報だけ抜く。 */
function toCard(pm: Stripe.PaymentMethod | null): BillingCard | null {
  if (!pm) return null;
  // カード以外（銀行口座等）は今回の表示対象外。card 型のときだけ詳細を返す。
  if (pm.type !== "card" || !pm.card)
    return { brand: null, last4: null, expMonth: null, expYear: null };
  return {
    brand: pm.card.brand ?? null,
    last4: pm.card.last4 ?? null,
    expMonth: pm.card.exp_month ?? null,
    expYear: pm.card.exp_year ?? null,
  };
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/**
 * 既定の支払い方法を Stripe 公式の解決順で引く。
 *
 *   1. subscription.default_payment_method
 *   2. customer.invoice_settings.default_payment_method
 *
 * Stripe は請求時にこの順で支払い方法を選ぶ。順序を自前で決めず、
 * 実際に課金される支払い方法と画面の表示を一致させる。
 * （3 番目の customer.default_source は旧 Card オブジェクト向けで、
 * 今回の SetupIntent / Billing Portal 経由の登録では使われないため見ない。）
 */
async function findDefaultPaymentMethod(
  stripe: Stripe,
  customer: Stripe.Customer,
  subscription: Stripe.Subscription | null,
): Promise<Stripe.PaymentMethod | null> {
  const pmId =
    idOf(subscription?.default_payment_method) ??
    idOf(customer.invoice_settings?.default_payment_method);
  if (!pmId) return null;
  return stripe.paymentMethods.retrieve(pmId);
}

async function fetchSnapshot(
  stripe: Stripe,
  stripeCustomerId: string | null,
): Promise<BillingSnapshot> {
  if (!stripeCustomerId) {
    return {
      status: "PAYMENT_METHOD_MISSING",
      card: null,
      stripeCustomerId: null,
      unavailableReason: null,
    };
  }

  const customer = await stripe.customers.retrieve(stripeCustomerId);
  // 削除済み Customer は決済情報が無いのと同じ扱い。
  if (customer.deleted) {
    return {
      status: "PAYMENT_METHOD_MISSING",
      card: null,
      stripeCustomerId,
      unavailableReason: null,
    };
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 10,
  });
  // 課金の基準になるのは「いま生きている」サブスクリプション。
  const activeSubscription =
    subscriptions.data.find((s) => s.status === "active" || s.status === "trialing") ?? null;

  const [paymentMethod, invoices] = await Promise.all([
    findDefaultPaymentMethod(stripe, customer, activeSubscription),
    // 未払いだけを数える。draft / void は請求として成立していないので対象外。
    stripe.invoices.list({ customer: stripeCustomerId, limit: 100 }),
  ]);

  const card = toCard(paymentMethod);
  const status = resolveBillingStatus({
    stripeCustomerId,
    defaultPaymentMethod: card,
    invoiceStatuses: invoices.data.map((inv) => inv.status ?? ""),
  });

  return { status, card, stripeCustomerId, unavailableReason: null };
}

/**
 * 自テナントの決済状態。
 *
 * tenantId はセッション由来のものだけを使う（クライアントから受け取らない）。
 * Stripe Customer も自テナントに保存された ID だけを見るので、他テナントの
 * Customer を覗く経路が無い。
 */
export async function getBillingSnapshot(): Promise<BillingSnapshot> {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError({
      code: "INVALID_CREDENTIALS",
      message: "Session missing — sign in is required",
    });
  }
  const ctx = await getTenantContext();
  const tenantId = ctx.tenantId;
  if (!tenantId) {
    return {
      status: "STRIPE_UNAVAILABLE",
      card: null,
      stripeCustomerId: null,
      unavailableReason: "NOT_CONFIGURED",
    };
  }

  const override = overriddenStatus();
  if (override) return override;

  const cached = fresh.get(tenantId);
  if (cached && Date.now() - cached.fetchedAt < FRESH_TTL_MS) return cached.snapshot;

  let stripe: Stripe | null;
  try {
    stripe = getStripe();
  } catch (err) {
    // 本番キーが設定されている等、設定自体が不正。ここで Stripe を使わない。
    if (err instanceof StripeConfigError) {
      return {
        status: "STRIPE_UNAVAILABLE",
        card: null,
        stripeCustomerId: null,
        unavailableReason: "NOT_CONFIGURED",
      };
    }
    throw err;
  }

  if (!stripe) {
    // キー未設定。支払い済みとは扱わないが、決済起因のロックもしない
    // （access.ts の isBillingBlocked が STRIPE_UNAVAILABLE を止めない）。
    return {
      status: "STRIPE_UNAVAILABLE",
      card: null,
      stripeCustomerId: null,
      unavailableReason: "NOT_CONFIGURED",
    };
  }

  const stripeCustomerId = await withTenant(ctx, async (tx) => {
    const tenant = await tx.tenant.findUnique({
      where: { id: tenantId },
      select: { stripeCustomerId: true },
    });
    return tenant?.stripeCustomerId ?? null;
  });

  try {
    const snapshot = await fetchSnapshot(stripe, stripeCustomerId);
    const entry: CacheEntry = { snapshot, fetchedAt: Date.now() };
    fresh.set(tenantId, entry);
    lastGood.set(tenantId, entry);
    return snapshot;
  } catch {
    // Stripe が落ちている / タイムアウト。直近の正常値がまだ新しければそれを使い、
    // 一時障害で全利用者を止めない。無ければ STRIPE_UNAVAILABLE。
    // どちらの経路でも「ACTIVE と推定する」ことはしない。
    const good = lastGood.get(tenantId);
    if (good && Date.now() - good.fetchedAt < LAST_GOOD_TTL_MS) return good.snapshot;
    return {
      status: "STRIPE_UNAVAILABLE",
      card: null,
      stripeCustomerId,
      unavailableReason: "API_ERROR",
    };
  }
}
