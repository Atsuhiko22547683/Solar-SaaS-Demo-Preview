// 支払い状態による利用制限のルール。
//
// 「ナビでは押せないのに URL 直打ちだと開ける」を防ぐため、レイアウトのガードと
// サイドバーの非活性判定は同じ関数を使う。その関数の表をここで固定する。

import { describe, expect, it } from "vitest";

import {
  isBillingBlocked,
  isNavHrefAllowedWhileBlocked,
  isPathAllowedWhileBlocked,
} from "../access.js";

import type { BillingStatus } from "../status.js";

describe("isBillingBlocked", () => {
  it("決済情報未登録・未払いは利用停止", () => {
    expect(isBillingBlocked("PAYMENT_METHOD_MISSING")).toBe(true);
    expect(isBillingBlocked("UNPAID")).toBe(true);
  });

  it("支払い済みは通常利用", () => {
    expect(isBillingBlocked("ACTIVE")).toBe(false);
  });

  it("Stripe に問い合わせできないときは止めない（障害の巻き添えで業務を止めない）", () => {
    // ACTIVE と同一視しているわけではない。ホームに警告は出す。
    expect(isBillingBlocked("STRIPE_UNAVAILABLE")).toBe(false);
  });
});

describe("利用停止中に開ける画面", () => {
  it("ホームと決済管理だけ開ける", () => {
    expect(isPathAllowedWhileBlocked("/dashboard")).toBe(true);
    expect(isPathAllowedWhileBlocked("/payments")).toBe(true);
  });

  it("通常機能はすべて開けない", () => {
    for (const path of [
      "/customers",
      "/customers/maekaku",
      "/events",
      "/line-events",
      "/product-catalog/pv",
      "/members",
      "/salespeople",
      "/commissions",
      "/contracts",
    ]) {
      expect(isPathAllowedWhileBlocked(path), `${path} は開けない`).toBe(false);
    }
  });

  it("許可パスの下位ページも開ける", () => {
    expect(isPathAllowedWhileBlocked("/payments/history")).toBe(true);
  });

  it("前方一致で別画面を巻き込まない", () => {
    // "/payments" 許可が "/payments-foo" まで通してしまわないこと。
    expect(isPathAllowedWhileBlocked("/payments-export")).toBe(false);
    expect(isPathAllowedWhileBlocked("/dashboard-legacy")).toBe(false);
  });

  it("ナビの判定はパスの判定と一致する", () => {
    for (const href of ["/dashboard", "/payments", "/customers", "/product-catalog/pv"]) {
      expect(isNavHrefAllowedWhileBlocked(href)).toBe(isPathAllowedWhileBlocked(href));
    }
  });
});

describe("ロール別の到達範囲", () => {
  // 決済管理は既存どおりオーナー専用（payment capability）。ここでは
  // 「利用停止中にどこまで行けるか」だけを、ロールの可否と組み合わせて確認する。
  function reachable(status: BillingStatus, canPayment: boolean, path: string): boolean {
    if (isBillingBlocked(status) && !isPathAllowedWhileBlocked(path)) return false;
    if (path.startsWith("/payments")) return canPayment;
    return true;
  }

  it("オーナーは支払い済みなら通常機能を使える", () => {
    expect(reachable("ACTIVE", true, "/customers")).toBe(true);
    expect(reachable("ACTIVE", true, "/payments")).toBe(true);
  });

  it("オーナーは利用停止中でもホームと決済管理へ行ける", () => {
    for (const status of ["PAYMENT_METHOD_MISSING", "UNPAID"] as const) {
      expect(reachable(status, true, "/dashboard")).toBe(true);
      expect(reachable(status, true, "/payments")).toBe(true);
      expect(reachable(status, true, "/customers")).toBe(false);
    }
  });

  it("オーナー以外は利用停止中はホームだけ（決済管理はロールで 403）", () => {
    for (const status of ["PAYMENT_METHOD_MISSING", "UNPAID"] as const) {
      expect(reachable(status, false, "/dashboard")).toBe(true);
      expect(reachable(status, false, "/payments")).toBe(false);
      expect(reachable(status, false, "/product-catalog/pv")).toBe(false);
    }
  });
});
