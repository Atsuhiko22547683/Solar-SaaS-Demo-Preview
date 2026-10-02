// 運営管理サイトの権限。
//
// 「代理店管理者・パートナー管理者であるだけでは入れない」ことを表として固定する。
// 画面を隠すかどうかではなく、assertCan が落とすかどうかで確かめる。

import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";

const SYSTEM_ADMIN_ACTIONS = [
  "system_admin.access",
  "system_admin.company.read",
  "system_admin.company.write",
  "system_admin.user.read",
  "system_admin.user.write",
  "system_admin.operator.read",
  "system_admin.operator.write",
  "system_admin.audit.read",
  "system_admin.status.read",
] as const;

function user(roles: string[], isSaasAdmin = false) {
  return {
    userId: "u1",
    roles: roles as never,
    isSaasAdmin,
    tenantId: "t1",
    wholesalerId: "w1",
    relationshipIds: [] as string[],
  };
}

describe("運営管理サイトの権限", () => {
  it.each(SYSTEM_ADMIN_ACTIONS)("運営者（SAAS_ADMIN）は %s を通る", (action) => {
    expect(() => assertCan({ user: user(["SAAS_ADMIN"], true), action })).not.toThrow();
  });

  it.each(SYSTEM_ADMIN_ACTIONS)("代理店管理者は %s で落ちる", (action) => {
    expect(() => assertCan({ user: user(["WHOLESALER_ADMIN"]), action })).toThrow(ForbiddenError);
  });

  it.each(SYSTEM_ADMIN_ACTIONS)("パートナー管理者は %s で落ちる", (action) => {
    expect(() => assertCan({ user: user(["DEALER_ADMIN"]), action })).toThrow(ForbiddenError);
  });

  it.each(SYSTEM_ADMIN_ACTIONS)("新ロールの OWNER でも %s で落ちる", (action) => {
    expect(() => assertCan({ user: user(["OWNER"]), action })).toThrow(ForbiddenError);
  });

  it("ロールが無い利用者も落ちる", () => {
    expect(() => assertCan({ user: user([]), action: "system_admin.access" })).toThrow(
      ForbiddenError,
    );
  });

  it("既存の業務権限は運営権限の追加で変わっていない", () => {
    // 代理店管理者は自分の業務をこれまでどおり通る。
    expect(() =>
      assertCan({ user: user(["WHOLESALER_ADMIN"]), action: "customer.read" }),
    ).not.toThrow();
    // パートナー管理者はシフト配置をこれまでどおり通る。
    expect(() =>
      assertCan({ user: user(["DEALER_ADMIN"]), action: "partner_shift.write" }),
    ).not.toThrow();
    // パートナースタッフはシフト配置を通らない。
    expect(() =>
      assertCan({ user: user(["DEALER_STAFF"]), action: "partner_shift.write" }),
    ).toThrow(ForbiddenError);
  });
});
