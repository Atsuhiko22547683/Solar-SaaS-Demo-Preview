// BizOrch 利用料の支払い状態の判定規則。
//
// Stripe に繋がらない環境でも規則そのものを固定できるよう、判定は純関数
// （lib/billing/status.ts）に切り出してある。ここはその表。

import { describe, expect, it } from "vitest";

import {
  formatCardExpiry,
  formatCardLabel,
  isUnpaidInvoiceStatus,
  resolveBillingStatus,
  type BillingCard,
} from "../status.js";

const CARD: BillingCard = { brand: "visa", last4: "4242", expMonth: 12, expYear: 2034 };

describe("resolveBillingStatus", () => {
  it("A: Stripe Customer が無ければ決済情報未登録", () => {
    expect(
      resolveBillingStatus({
        stripeCustomerId: null,
        defaultPaymentMethod: CARD,
        invoiceStatuses: [],
      }),
    ).toBe("PAYMENT_METHOD_MISSING");
  });

  it("B: Customer はあるが既定の支払い方法が無ければ決済情報未登録", () => {
    expect(
      resolveBillingStatus({
        stripeCustomerId: "cus_1",
        defaultPaymentMethod: null,
        invoiceStatuses: ["paid"],
      }),
    ).toBe("PAYMENT_METHOD_MISSING");
  });

  it("C: 支払い方法があり未払いの請求が無ければ利用可", () => {
    expect(
      resolveBillingStatus({
        stripeCustomerId: "cus_1",
        defaultPaymentMethod: CARD,
        invoiceStatuses: ["paid", "paid", "void", "draft"],
      }),
    ).toBe("ACTIVE");
  });

  it("D: 未払いの請求があれば未払い", () => {
    for (const status of ["open", "past_due", "uncollectible"]) {
      expect(
        resolveBillingStatus({
          stripeCustomerId: "cus_1",
          defaultPaymentMethod: CARD,
          invoiceStatuses: ["paid", status],
        }),
        `${status} は未払いとして数える`,
      ).toBe("UNPAID");
    }
  });

  it("請求がまだ 1 件も無くても、支払い方法があれば利用可", () => {
    expect(
      resolveBillingStatus({
        stripeCustomerId: "cus_1",
        defaultPaymentMethod: CARD,
        invoiceStatuses: [],
      }),
    ).toBe("ACTIVE");
  });

  it("下書き・無効の請求は未払いに数えない（請求として成立していない）", () => {
    expect(isUnpaidInvoiceStatus("draft")).toBe(false);
    expect(isUnpaidInvoiceStatus("void")).toBe(false);
    expect(isUnpaidInvoiceStatus("paid")).toBe(false);
  });
});

describe("支払い方法の表示", () => {
  it("E: brand と下 4 桁があれば「Visa •••• 4242」", () => {
    expect(formatCardLabel(CARD, "カード")).toBe("Visa •••• 4242");
  });

  it("brand が取れなければ「カード •••• 4242」", () => {
    expect(formatCardLabel({ ...CARD, brand: null }, "カード")).toBe("カード •••• 4242");
    // Stripe は不明なブランドを "unknown" で返す。そのまま出さない。
    expect(formatCardLabel({ ...CARD, brand: "unknown" }, "カード")).toBe("カード •••• 4242");
  });

  it("F: 下 4 桁が無ければブランドだけ、どちらも無ければ「カード」", () => {
    expect(formatCardLabel({ ...CARD, last4: null }, "カード")).toBe("Visa");
    expect(
      formatCardLabel({ brand: null, last4: null, expMonth: null, expYear: null }, "カード"),
    ).toBe("カード");
  });

  it("カード自体が無ければ null（呼び出し側が「未登録」と出す）", () => {
    expect(formatCardLabel(null, "カード")).toBeNull();
  });

  it("有効期限は 0 埋めした MM/YYYY。欠けていれば null", () => {
    expect(formatCardExpiry({ ...CARD, expMonth: 3 })).toBe("03/2034");
    expect(formatCardExpiry({ ...CARD, expMonth: null })).toBeNull();
    expect(formatCardExpiry(null)).toBeNull();
  });
});
