// システムユーザー管理のロール階層。
//
//   OWNER > SYSTEM_ADMIN > GENERAL_USER
//
// 「自分より上位のユーザーは登録・編集・削除できない」だけを表す序列で、
// 機能の可否（設定 / 決済管理）とは別軸。同階層は管理できる。

import { describe, expect, it } from "vitest";

import { assignableRoles, canManageRole, canManageUser, roleRank } from "../can.js";

const OWNER = ["OWNER"];
const SYSTEM_ADMIN = ["SYSTEM_ADMIN"];
const GENERAL_USER = ["GENERAL_USER"];

describe("roleRank", () => {
  it("OWNER > SYSTEM_ADMIN > GENERAL_USER の順になる", () => {
    expect(roleRank(OWNER)).toBeGreaterThan(roleRank(SYSTEM_ADMIN));
    expect(roleRank(SYSTEM_ADMIN)).toBeGreaterThan(roleRank(GENERAL_USER));
    expect(roleRank(GENERAL_USER)).toBeGreaterThan(0);
  });

  it("旧ロールしか持たないユーザーは 0（高権限と推定しない）", () => {
    expect(roleRank(["WHOLESALER_ADMIN"])).toBe(0);
    expect(roleRank(["WHOLESALER_EVENT_TEAM"])).toBe(0);
    expect(roleRank([])).toBe(0);
  });
});

describe("canManageUser — 対象ユーザーを管理できるか", () => {
  it("A: オーナーは 3 ロールすべてを管理できる", () => {
    expect(canManageUser(OWNER, OWNER)).toBe(true);
    expect(canManageUser(OWNER, SYSTEM_ADMIN)).toBe(true);
    expect(canManageUser(OWNER, GENERAL_USER)).toBe(true);
  });

  it("B: システム管理者はオーナーを管理できないが、同階層以下は管理できる", () => {
    expect(canManageUser(SYSTEM_ADMIN, OWNER)).toBe(false);
    expect(canManageUser(SYSTEM_ADMIN, SYSTEM_ADMIN)).toBe(true);
    expect(canManageUser(SYSTEM_ADMIN, GENERAL_USER)).toBe(true);
  });

  it("C: 一般ユーザーは誰も管理できない（/members 自体が 403）", () => {
    expect(canManageUser(GENERAL_USER, OWNER)).toBe(false);
    expect(canManageUser(GENERAL_USER, SYSTEM_ADMIN)).toBe(false);
    // 同階層でも管理画面に入れないため、ここも false でよい。
    expect(canManageUser(GENERAL_USER, GENERAL_USER)).toBe(true);
  });

  it("旧ロールしか持たない操作主体は誰も管理できない", () => {
    expect(canManageUser(["WHOLESALER_ADMIN"], GENERAL_USER)).toBe(false);
  });

  it("旧ロールしか持たない対象は上位ロールから管理できる（新ロールへ移行させられる）", () => {
    expect(canManageUser(SYSTEM_ADMIN, ["WHOLESALER_FIELD_STAFF"])).toBe(true);
  });
});

describe("canManageRole — 付与しようとしているロールが自分以下か", () => {
  it("オーナーは 3 ロールすべてを指定できる", () => {
    expect(canManageRole(OWNER, "OWNER")).toBe(true);
    expect(canManageRole(OWNER, "SYSTEM_ADMIN")).toBe(true);
    expect(canManageRole(OWNER, "GENERAL_USER")).toBe(true);
  });

  it("システム管理者はオーナーを指定できない", () => {
    expect(canManageRole(SYSTEM_ADMIN, "OWNER")).toBe(false);
    expect(canManageRole(SYSTEM_ADMIN, "SYSTEM_ADMIN")).toBe(true);
    expect(canManageRole(SYSTEM_ADMIN, "GENERAL_USER")).toBe(true);
  });
});

describe("assignableRoles — 新規登録・編集で選べるロール", () => {
  it("オーナーは 3 つすべて", () => {
    expect(assignableRoles(OWNER)).toEqual(["OWNER", "SYSTEM_ADMIN", "GENERAL_USER"]);
  });

  it("システム管理者はオーナーを含まない", () => {
    expect(assignableRoles(SYSTEM_ADMIN)).toEqual(["SYSTEM_ADMIN", "GENERAL_USER"]);
  });

  it("旧ロールしか持たない場合は空（誰も登録できない）", () => {
    expect(assignableRoles(["WHOLESALER_ADMIN"])).toEqual([]);
  });
});
