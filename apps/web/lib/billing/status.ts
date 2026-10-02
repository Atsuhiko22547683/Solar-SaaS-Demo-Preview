// BizOrch 利用料の支払い状態（BillingAccessStatus）と、その判定ロジック。
//
// 「この会社が BizOrch を使える状態か」を決める唯一の場所。各画面・各ガードは
// ここが返す 1 つの status を見るだけで、Stripe のオブジェクトを直接解釈しない。
//
// このファイルは純関数だけを置く（Stripe SDK も DB も import しない）。
// I/O は resolve.ts が担当し、ここはその結果を受け取って判定する。
// そうすることで、Stripe に繋がらない環境でも判定規則そのものをテストできる。

/**
 * 利用可否。
 *
 *   ACTIVE                 … 支払い方法があり、未払いも無い。通常利用できる。
 *   PAYMENT_METHOD_MISSING … 決済情報が未登録。
 *   UNPAID                 … 支払い方法はあるが、未払いの請求がある。
 *   STRIPE_UNAVAILABLE     … Stripe に問い合わせできない（未設定 / API 障害）。
 *                            「支払い済み」とは見なさない。扱いは access.ts 参照。
 */
export type BillingStatus = "ACTIVE" | "PAYMENT_METHOD_MISSING" | "UNPAID" | "STRIPE_UNAVAILABLE";

/** Stripe に問い合わせできない理由。UI では出し分けないが、運用調査で要る。 */
export type BillingUnavailableReason = "NOT_CONFIGURED" | "API_ERROR";

/**
 * 表示用のカード情報。BizOrch は保存せず、毎回 Stripe から取得した値を渡す。
 * カード番号そのものは扱わない（brand / last4 / 有効期限まで）。
 */
export interface BillingCard {
  /** "visa" 等の Stripe の brand をそのまま。取得できなければ null。 */
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}

/** 判定に必要な入力（Stripe のオブジェクトから必要な形だけ抜いたもの）。 */
export interface BillingInput {
  /** Tenant に保存済みの Stripe Customer ID。未作成なら null。 */
  stripeCustomerId: string | null;
  /**
   * 既定の支払い方法。Stripe 公式の解決順
   * （subscription.default_payment_method → customer.invoice_settings
   * .default_payment_method）で解決済みのものを渡す。無ければ null。
   */
  defaultPaymentMethod: BillingCard | { brand: null; last4: null } | null;
  /** Customer に紐づく請求のうち、支払いが完了していないものの status 一覧。 */
  invoiceStatuses: string[];
}

/**
 * 未払いとみなす Invoice の status（Stripe 公式の値）。
 *
 *   open          … 発行済みで未払い
 *   past_due      … 支払期日を過ぎた
 *   uncollectible … 回収不能として計上された
 *
 * draft（下書き）と void（無効化）は請求として成立していないので未払いに数えない。
 * paid は当然除く。Subscription.status だけで支払い済みと推定しない
 * （active でも当月の請求が open のまま、という状態があり得るため）。
 */
const UNPAID_INVOICE_STATUSES = new Set(["open", "past_due", "uncollectible"]);

export function isUnpaidInvoiceStatus(status: string): boolean {
  return UNPAID_INVOICE_STATUSES.has(status);
}

/**
 * 利用可否の判定（純関数）。
 *
 * 順序に意味がある: 決済情報が無ければ未払いを見るまでもないので先に返す。
 */
export function resolveBillingStatus(input: BillingInput): BillingStatus {
  // Stripe Customer 自体がまだ無い＝決済情報の登録がこれから。
  if (!input.stripeCustomerId) return "PAYMENT_METHOD_MISSING";
  // Customer はあるが既定の支払い方法が無い。
  if (!input.defaultPaymentMethod) return "PAYMENT_METHOD_MISSING";
  if (input.invoiceStatuses.some(isUnpaidInvoiceStatus)) return "UNPAID";
  return "ACTIVE";
}

/** 画面が受け取る決済状態の一式。 */
export interface BillingSnapshot {
  status: BillingStatus;
  /** 表示用のカード。取得できていなければ null。 */
  card: BillingCard | null;
  /** Stripe Customer ID。未作成なら null（UI には出さない、導線の分岐に使う）。 */
  stripeCustomerId: string | null;
  /** STRIPE_UNAVAILABLE のときだけ入る。 */
  unavailableReason: BillingUnavailableReason | null;
}

// ---------------------------------------------------------------------------
// 表示ヘルパー
// ---------------------------------------------------------------------------

/**
 * Stripe の brand コードを表示名へ。
 *
 * ここは UI 文言ではなくブランドの固有名詞なので labels.ts には置かない
 * （日本語化する対象ではない）。未知の brand はそのまま返す。
 */
const BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  jcb: "JCB",
  diners: "Diners Club",
  discover: "Discover",
  unionpay: "UnionPay",
};

export function brandLabel(brand: string | null): string | null {
  if (!brand) return null;
  const key = brand.trim().toLowerCase();
  if (key.length === 0 || key === "unknown") return null;
  return BRAND_LABELS[key] ?? brand;
}

/**
 * 支払い方法の表示文字列を組み立てる。
 *
 *   brand + last4 … "Visa •••• 4242"
 *   last4 のみ    … "<cardWord> •••• 4242"
 *   どちらも無い   … "<cardWord>"（カードだと分かる場合）
 *   カード自体無し … null（呼び出し側が「未登録」と出す）
 *
 * `cardWord` は日本語 UI 文言なので labels.ts から渡す（ここで直書きしない）。
 */
export function formatCardLabel(card: BillingCard | null, cardWord: string): string | null {
  if (!card) return null;
  const brand = brandLabel(card.brand);
  const head = brand ?? cardWord;
  if (!card.last4) return head;
  return `${head} •••• ${card.last4}`;
}

/** "12/2029" 形式の有効期限。欠けていれば null。 */
export function formatCardExpiry(card: BillingCard | null): string | null {
  if (!card?.expMonth || !card.expYear) return null;
  return `${String(card.expMonth).padStart(2, "0")}/${card.expYear}`;
}
