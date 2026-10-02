// 決済管理（/payments）の server-side data loader。
//
// ここで扱うのは **BizOrch の利用契約**（このシステムを使っている契約者側の
// プラン / 利用料 / 契約期間 / 支払い状況）であって、太陽光顧客の決済ではない。
// Customer / Contract / ContractPayment はこの画面では一切参照しない。
//
// 責務の分け方:
//   契約プラン / 利用料 / 契約期間 … BizOrch 側（lib/config/billing.ts）
//   支払い方法 / 支払い状態 / 請求履歴 … Stripe（Sandbox）
// Stripe の Price / Product へ料金表を全面移行はしない。
//
// auth → assertCan("payment.read") → withTenant の順は他ローダーと同じ。
// payment.read は capability "payment" を持ち、オーナー専用。

import "server-only";

import { auth } from "@/auth";
import { getBillingSnapshot } from "@/lib/billing/resolve";
import { resolveBillingConfig, type BillingCycle } from "@/lib/config/billing";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getStripe } from "@/lib/stripe/client";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { BillingCard, BillingStatus } from "@/lib/billing/status";
import type { TenantPlan } from "@solar/db";

/** 決済情報（A）— 画面が表示する契約 1 件ぶん。 */
export interface SubscriptionInfo {
  /** 契約テナント名（＝この画面を見ている会社）。 */
  tenantName: string;
  /** 契約プラン。Tenant.plan の実データ。未設定なら null。 */
  plan: TenantPlan | null;
  /** 請求サイクルあたりの単価（円）。参照元は billing config。 */
  unitPrice: number | null;
  cycle: BillingCycle;
  /** 支払い方法。Stripe 固定。 */
  method: "STRIPE";
  contractStartAt: string | null;
  contractEndAt: string | null;
  nextBillingAt: string | null;
  /** Stripe から判定した支払い状態。 */
  paymentStatus: BillingStatus;
  /**
   * 表示用のカード情報。Stripe から取得した brand / 下 4 桁 / 有効期限だけで、
   * カード番号そのものは受け取らないし保存もしない。
   */
  card: BillingCard | null;
  /** Stripe Customer が未作成なら false（導線を「決済情報を登録」に変える）。 */
  hasStripeCustomer: boolean;
}

/** 決済履歴（B）— BizOrch 利用料の請求 1 件（Stripe の Invoice）。 */
export interface SubscriptionInvoice {
  id: string;
  /** 支払日（ISO）。未払いの請求はまだ支払日が無いので null。 */
  paidAt: string | null;
  /** 対象期間の表示文字列。 */
  period: string;
  /** 金額（最小通貨単位ではなく円などの表示単位に直した値）。 */
  amount: number;
  /** Stripe の invoice.status（open / paid / …）。表示名は画面側で引く。 */
  status: string;
  /** その請求に使われた支払い方法の表示文字列。取得できなければ null。 */
  method: string | null;
}

export interface PaymentPageData {
  info: SubscriptionInfo;
  invoices: SubscriptionInvoice[];
  /** Stripe に接続できていない（未設定 / 障害）。画面の注意書きに使う。 */
  stripeUnavailable: boolean;
}

async function requirePaymentCtx() {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError({
      code: "INVALID_CREDENTIALS",
      message: "Session missing — sign in is required",
    });
  }
  const ctx = await getTenantContext();
  assertCan({
    user: {
      userId: ctx.actorUserId,
      roles: session.user.roles,
      isSaasAdmin: ctx.isSaasAdmin,
      tenantId: ctx.tenantId,
      wholesalerId: ctx.wholesalerId,
      dealerId: ctx.dealerId,
      relationshipIds: ctx.relationshipIds,
    },
    action: "payment.read",
  });
  return ctx;
}

/** 通貨の最小単位から表示単位へ。JPY は元から最小単位＝円なので割らない。 */
function toDisplayAmount(amount: number, currency: string): number {
  const zeroDecimal = new Set(["jpy", "krw", "vnd", "clp"]);
  return zeroDecimal.has(currency.toLowerCase()) ? amount : amount / 100;
}

function isoOrNull(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toISOString();
}

/** "2026/04/01 〜 2026/04/30" 形式の対象期間。画面側で整形しないよう ISO 2 つを渡す。 */
function periodText(start: number | null | undefined, end: number | null | undefined): string {
  const s = isoOrNull(start);
  const e = isoOrNull(end);
  if (!s || !e) return "";
  return `${s}/${e}`;
}

/**
 * Stripe から利用料の請求履歴を取る。
 *
 * 架空の履歴は作らない。Stripe に無ければ空配列を返し、画面は
 * 「決済履歴はまだありません」と出す。
 */
async function loadInvoices(stripeCustomerId: string | null): Promise<SubscriptionInvoice[]> {
  const stripe = getStripe();
  if (!stripe || !stripeCustomerId) return [];

  try {
    const list = await stripe.invoices.list({ customer: stripeCustomerId, limit: 24 });
    return list.data.map((inv) => {
      const currency = inv.currency ?? "jpy";
      // 支払い済みなら実際に支払われた額、未払いなら請求額を出す。
      const raw = inv.status === "paid" ? inv.amount_paid : (inv.amount_due ?? inv.total ?? 0);
      return {
        id: inv.id ?? "",
        paidAt: isoOrNull(inv.status_transitions?.paid_at),
        period: periodText(inv.period_start, inv.period_end),
        amount: toDisplayAmount(raw ?? 0, currency),
        status: inv.status ?? "",
        method: null,
      };
    });
  } catch {
    // Stripe 障害時に履歴だけ落ちても画面全体は開けるようにする。
    return [];
  }
}

/**
 * 決済管理画面のデータ。
 *
 * 実データとして読むのは自テナントの `name` / `plan` / `stripeCustomerId` だけ。
 * 単価・期間は billing config、支払い方法・状態・履歴は Stripe から。
 * 無いものは null にして画面側で「未設定」と出す。架空の値は作らない。
 */
export async function getPaymentPageData(): Promise<PaymentPageData> {
  const ctx = await requirePaymentCtx();
  const billing = await getBillingSnapshot();

  const tenant = await withTenant(ctx, async (tx) =>
    ctx.tenantId
      ? tx.tenant.findUnique({
          where: { id: ctx.tenantId },
          select: { name: true, plan: true },
        })
      : null,
  );

  const plan = tenant?.plan ?? null;
  const config = resolveBillingConfig(plan);
  const invoices = await loadInvoices(billing.stripeCustomerId);

  return {
    info: {
      tenantName: tenant?.name ?? "—",
      plan,
      unitPrice: config.unitPrice ?? null,
      cycle: config.cycle,
      method: config.method,
      contractStartAt: config.contractStartAt ?? null,
      contractEndAt: config.contractEndAt ?? null,
      nextBillingAt: config.nextBillingAt ?? null,
      paymentStatus: billing.status,
      card: billing.card,
      hasStripeCustomer: billing.stripeCustomerId !== null,
    },
    invoices,
    stripeUnavailable: billing.status === "STRIPE_UNAVAILABLE",
  };
}
