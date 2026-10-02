// システムユーザーの 3 ロール（OWNER / SYSTEM_ADMIN / GENERAL_USER）の権限マトリクス。
//
//                   通常機能   設定   決済管理
//   オーナー            ○       ○       ○
//   システム管理者       ○       ○       ×
//   一般ユーザー         ○       ×       ×
//
// 単純な上下関係ではないので、カテゴリごとに個別に確認する。

import { describe, expect, it } from "vitest";

import { ForbiddenError } from "../../errors.js";
import { assertCan, hasCapability, type PermissionUser } from "../can.js";

import type { AppRole } from "@solar/db";

function userWith(role: AppRole): PermissionUser {
  return {
    userId: `u_${role}`,
    roles: [role],
    isSaasAdmin: false,
    tenantId: "tenant_ws_a",
    wholesalerId: "tenant_ws_a",
    relationshipIds: [],
  };
}

const owner = userWith("OWNER");
const systemAdmin = userWith("SYSTEM_ADMIN");
const generalUser = userWith("GENERAL_USER");

const SCOPE = { wholesalerId: "tenant_ws_a" };

describe("通常機能 — 3 ロールとも利用できる", () => {
  // 顧客・イベント・契約・手数料は「通常機能」なのでロールで差を付けない。
  const NORMAL_ACTIONS = [
    "customer.read",
    "event_candidate.read",
    "contract.read",
    "salesperson.read",
  ] as const;

  it.each(NORMAL_ACTIONS)("オーナーは %s を実行できる", (action) => {
    expect(() => assertCan({ user: owner, action, resource: SCOPE })).not.toThrow();
  });
  it.each(NORMAL_ACTIONS)("システム管理者は %s を実行できる", (action) => {
    expect(() => assertCan({ user: systemAdmin, action, resource: SCOPE })).not.toThrow();
  });
  it.each(NORMAL_ACTIONS)("一般ユーザーは %s を実行できる", (action) => {
    expect(() => assertCan({ user: generalUser, action, resource: SCOPE })).not.toThrow();
  });
});

describe("設定 — オーナー / システム管理者だけ", () => {
  it("オーナーは設定を開ける", () => {
    expect(() => assertCan({ user: owner, action: "settings.read" })).not.toThrow();
  });

  it("システム管理者は設定を開ける", () => {
    expect(() => assertCan({ user: systemAdmin, action: "settings.read" })).not.toThrow();
  });

  it("一般ユーザーは設定を開けない", () => {
    expect(() => assertCan({ user: generalUser, action: "settings.read" })).toThrow(ForbiddenError);
  });

  it("一般ユーザーはシステムユーザーの一覧・更新もできない", () => {
    expect(() => assertCan({ user: generalUser, action: "member.read", resource: SCOPE })).toThrow(
      ForbiddenError,
    );
    expect(() => assertCan({ user: generalUser, action: "user.update", resource: SCOPE })).toThrow(
      ForbiddenError,
    );
  });
});

// 決済管理は BizOrch の利用契約（プラン / 利用料 / 契約期間）を扱う画面なので、
// 契約名義であるオーナー専用。
describe("決済管理 — オーナーだけ", () => {
  it("オーナーは決済管理を開ける", () => {
    expect(() => assertCan({ user: owner, action: "payment.read" })).not.toThrow();
  });

  it("システム管理者は決済管理を開けない", () => {
    expect(() => assertCan({ user: systemAdmin, action: "payment.read" })).toThrow(ForbiddenError);
  });

  it("一般ユーザーは決済管理を開けない", () => {
    expect(() => assertCan({ user: generalUser, action: "payment.read" })).toThrow(ForbiddenError);
  });
});

describe("hasCapability — サイドバーの出し分けに使う判定", () => {
  it("設定", () => {
    expect(hasCapability(["OWNER"], "settings")).toBe(true);
    expect(hasCapability(["SYSTEM_ADMIN"], "settings")).toBe(true);
    expect(hasCapability(["GENERAL_USER"], "settings")).toBe(false);
  });

  it("決済管理", () => {
    expect(hasCapability(["OWNER"], "payment")).toBe(true);
    expect(hasCapability(["SYSTEM_ADMIN"], "payment")).toBe(false);
    expect(hasCapability(["GENERAL_USER"], "payment")).toBe(false);
  });

  it("旧ロールしか持たない既存ユーザーは従来どおり（カテゴリ制限なし）", () => {
    expect(hasCapability(["WHOLESALER_ADMIN"], "settings")).toBe(true);
    expect(hasCapability(["WHOLESALER_ADMIN"], "payment")).toBe(true);
  });
});
