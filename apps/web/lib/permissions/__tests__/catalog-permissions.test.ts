// 製品カタログ（商品マスタ）の操作権限。
//
// 正式仕様: OWNER / SYSTEM_ADMIN / GENERAL_USER の 3 ロールとも
// 閲覧・登録・編集・削除・有効無効切替ができる。製品カタログは通常業務機能で、
// 設定 / 決済管理のような capability ゲートを掛けない。
//
// 「システムユーザー管理の階層（OWNER > SYSTEM_ADMIN > GENERAL_USER）」は
// ユーザー管理専用のもので、商品管理には適用しない — その取り違えを防ぐため、
// 3 ロールを同じ表で回して差が出ないことを固定する。

import { describe, expect, it } from "vitest";

import { TenantIsolationError } from "../../errors.js";
import { assertCan, type PermissionUser } from "../can.js";

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

const SCOPE = { wholesalerId: "tenant_ws_a" };

/** カタログ画面の Server Action が使うアクションキー。 */
const CATALOG_ACTIONS = [
  "product.read",
  "product.create",
  "product.update",
  "product.retire",
  "product.set_active",
] as const;

const SYSTEM_ROLES: AppRole[] = ["OWNER", "SYSTEM_ADMIN", "GENERAL_USER"];

describe("製品カタログ — システムユーザー 3 ロールとも同じ権限", () => {
  for (const role of SYSTEM_ROLES) {
    it.each(CATALOG_ACTIONS)(`${role} は %s を実行できる`, (action) => {
      expect(() => assertCan({ user: userWith(role), action, resource: SCOPE })).not.toThrow();
    });
  }

  it("一般ユーザーでも登録・編集・削除・有効無効切替がすべて通る", () => {
    // 設定・決済管理は使えないロールだが、商品管理は通常業務機能なので通る。
    const generalUser = userWith("GENERAL_USER");
    for (const action of CATALOG_ACTIONS) {
      expect(() => assertCan({ user: generalUser, action, resource: SCOPE })).not.toThrow();
    }
  });
});

describe("製品カタログ — テナント境界は 3 ロールとも越えられない", () => {
  it.each(SYSTEM_ROLES)("%s は他テナントの商品を操作できない", (role) => {
    expect(() =>
      assertCan({
        user: userWith(role),
        action: "product.set_active",
        resource: { wholesalerId: "tenant_ws_b" },
      }),
    ).toThrow(TenantIsolationError);
  });
});

describe("製品カタログ — 二次店は書き込めない", () => {
  const dealer: PermissionUser = {
    userId: "u_dealer",
    roles: ["DEALER_ADMIN"],
    isSaasAdmin: false,
    tenantId: "tenant_dealer_a",
    dealerId: "tenant_dealer_a",
    relationshipIds: ["rel_1"],
  };

  it("二次店は商品を閲覧できる（契約明細の商品ピッカーで使う）", () => {
    expect(() => assertCan({ user: dealer, action: "product.read" })).not.toThrow();
  });

  it.each(["product.create", "product.update", "product.retire", "product.set_active"] as const)(
    "二次店は %s を実行できない",
    (action) => {
      expect(() => assertCan({ user: dealer, action })).toThrow();
    },
  );
});
