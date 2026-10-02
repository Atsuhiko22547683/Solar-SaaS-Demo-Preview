// 二次店管理者が扱う利用者アカウントの入力スキーマ。
//
// 「二次店の値域しか受け付けない」「範囲外の列は混ぜられない」を表として固定する。

import { describe, expect, it } from "vitest";

import {
  PartnerAccountInviteSchema,
  PartnerAccountUpdateSchema,
} from "../src/schemas/partner-account.js";

describe("PartnerAccountInviteSchema", () => {
  it("メールアドレスと二次店の利用区分を受け付ける", () => {
    const r = PartnerAccountInviteSchema.safeParse({
      email: "staff@example.com",
      role: "DEALER_STAFF",
    });
    expect(r.success).toBe(true);
  });

  it("代理店・SaaS 運営者のロールは指定できない", () => {
    for (const role of ["WHOLESALER_ADMIN", "SAAS_ADMIN", "OWNER"]) {
      expect(PartnerAccountInviteSchema.safeParse({ email: "a@b.co", role }).success).toBe(false);
    }
  });

  it("メールアドレスの形式を検証する", () => {
    expect(
      PartnerAccountInviteSchema.safeParse({ email: "not-an-email", role: "DEALER_ADMIN" }).success,
    ).toBe(false);
  });
});

describe("PartnerAccountUpdateSchema", () => {
  it("利用区分・利用状況・販売員の紐付けを個別に変更できる", () => {
    expect(PartnerAccountUpdateSchema.safeParse({ id: "u1", status: "SUSPENDED" }).success).toBe(
      true,
    );
    expect(PartnerAccountUpdateSchema.safeParse({ id: "u1", role: "DEALER_ADMIN" }).success).toBe(
      true,
    );
    // null は「紐付けを解除」。undefined（キーなし）は「変更しない」。
    expect(PartnerAccountUpdateSchema.safeParse({ id: "u1", salespersonId: null }).success).toBe(
      true,
    );
  });

  it("画面から指定できない利用状況は受け付けない", () => {
    for (const status of ["DELETED", "INVITED"]) {
      expect(PartnerAccountUpdateSchema.safeParse({ id: "u1", status }).success).toBe(false);
    }
  });

  it("範囲外の列（氏名・メール・テナント）は混ぜられない", () => {
    expect(
      PartnerAccountUpdateSchema.safeParse({ id: "u1", name: "別名", status: "ACTIVE" }).success,
    ).toBe(false);
    expect(
      PartnerAccountUpdateSchema.safeParse({ id: "u1", tenantId: "other", status: "ACTIVE" })
        .success,
    ).toBe(false);
  });
});
