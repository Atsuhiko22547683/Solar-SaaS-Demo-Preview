// BizOrch 利用契約（システム利用料）の参照元。
//
// 「決済管理」は太陽光顧客の決済ではなく、**このシステムを利用している契約者側**の
// 利用料・契約期間・支払い状況を扱う。その表示値をここ 1 か所に集約する。
//
// 料金は将来「システム管理画面」から編集できるようにする前提なので、
// 画面コンポーネントには直書きしない。今は環境変数で上書きできる既定値を返し、
// 保存先（システム設定 / テナント課金設定）が入ったら、この resolver の中身だけを
// 差し替えれば画面側は変更不要にしてある。
//
// 契約期間・次回請求日・支払い状態を保持する既存モデルは無いため、
// 値が無いものは undefined を返す（架空の値は作らない）。画面側が「未設定」と出す。

import type { TenantPlan } from "@solar/db";

/** 料金の通貨単位。今は日本円のみ。 */
export const BILLING_CURRENCY = "JPY" as const;

/** 支払い方法。Stripe 固定（API 接続はまだ行わない）。 */
export const BILLING_METHOD = "STRIPE" as const;

/** 請求サイクル。既定は月次。 */
export type BillingCycle = "MONTHLY" | "YEARLY";

/**
 * プラン別の既定単価（円 / 請求サイクルあたり）。
 *
 * `BILLING_PRICE_<PLAN>` 環境変数で上書きできる。将来はシステム管理画面が
 * この値を保存し、`resolvePlanPrice` がそこから読むようになる。
 */
const DEFAULT_PLAN_PRICE: Record<TenantPlan, number> = {
  PILOT: 0,
  SMALL: 50_000,
  MEDIUM: 120_000,
  LARGE: 250_000,
};

function envNumber(name: string): number | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function envDate(name: string): string | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** 決済管理画面が必要とする契約情報一式。値が無い項目は undefined。 */
export interface BillingConfig {
  /** 請求サイクルあたりの単価（円）。プラン未設定なら undefined。 */
  unitPrice: number | undefined;
  cycle: BillingCycle;
  currency: typeof BILLING_CURRENCY;
  method: typeof BILLING_METHOD;
  /** 契約開始日（ISO）。保存先がまだ無いので既定は undefined。 */
  contractStartAt: string | undefined;
  /** 契約終了日（ISO）。同上。 */
  contractEndAt: string | undefined;
  /** 次回請求日（ISO）。同上。 */
  nextBillingAt: string | undefined;
}

/**
 * 契約情報を解決する。
 *
 * 引数の plan は Tenant.plan（実データ）。単価はそこから引き、
 * 期間や次回請求日は保存先が用意されるまで環境変数の任意指定のみを見る。
 */
export function resolveBillingConfig(plan: TenantPlan | null): BillingConfig {
  const cycle: BillingCycle = process.env.BILLING_CYCLE === "YEARLY" ? "YEARLY" : "MONTHLY";
  return {
    unitPrice: plan ? (envNumber(`BILLING_PRICE_${plan}`) ?? DEFAULT_PLAN_PRICE[plan]) : undefined,
    cycle,
    currency: BILLING_CURRENCY,
    method: BILLING_METHOD,
    contractStartAt: envDate("BILLING_CONTRACT_START_AT"),
    contractEndAt: envDate("BILLING_CONTRACT_END_AT"),
    nextBillingAt: envDate("BILLING_NEXT_BILLING_AT"),
  };
}
