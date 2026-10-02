// 運営管理サイトのサイト分離。
//
// Cookie 接頭辞と公開パスの表を固定する。既存 3 サイトの挙動を変えていないことも見る。

import { describe, expect, it } from "vitest";

import {
  APP_VARIANTS,
  authCookiePrefix,
  homePathForVariant,
  isPathAllowedForVariant,
  sessionCookieNames,
} from "@/lib/app-variant";

describe("運営管理サイトの分離", () => {
  it("バリアントとして登録されている", () => {
    expect(APP_VARIANTS).toContain("system-admin");
  });

  it("認証 Cookie の接頭辞が他サイトと重ならない", () => {
    const prefixes = APP_VARIANTS.map((v) => authCookiePrefix(v));
    expect(authCookiePrefix("system-admin")).toBe("system-admin-authjs");
    // 4 サイトすべて別名（同時利用できる）。
    expect(new Set(prefixes).size).toBe(APP_VARIANTS.length);
  });

  it("セッション Cookie 名も他サイトと重ならない", () => {
    const names = sessionCookieNames("system-admin");
    expect(names).toEqual([
      "system-admin-authjs.session-token",
      "__Secure-system-admin-authjs.session-token",
    ]);
    for (const other of ["agency", "partner", "partner-admin"] as const) {
      for (const n of sessionCookieNames(other)) expect(names).not.toContain(n);
    }
  });

  it("ホームは運営管理のトップ", () => {
    expect(homePathForVariant("system-admin")).toBe("/s-dashboard");
    // 既存サイトのホームは変わっていない。
    expect(homePathForVariant("agency")).toBe("/dashboard");
    expect(homePathForVariant("partner")).toBe("/p-home");
    expect(homePathForVariant("partner-admin")).toBe("/p-home");
  });

  it.each([
    "/s-dashboard",
    "/s-companies",
    "/s-companies/abc",
    "/s-users",
    "/s-operators",
    "/s-audit",
    "/s-status",
  ])("運営管理サイトは %s を開ける", (path) => {
    expect(isPathAllowedForVariant("system-admin", path)).toBe(true);
  });

  it.each([
    "/dashboard",
    "/customers",
    "/events",
    "/p-home",
    "/p-reports",
    "/tenants",
    "/d-dashboard",
  ])("運営管理サイトは業務画面 %s を開けない", (path) => {
    expect(isPathAllowedForVariant("system-admin", path)).toBe(false);
  });

  it.each(["agency", "partner", "partner-admin"] as const)(
    "%s サイトは運営管理の画面を開けない",
    (variant) => {
      for (const path of ["/s-dashboard", "/s-companies", "/s-users", "/s-audit"]) {
        expect(isPathAllowedForVariant(variant, path)).toBe(false);
      }
    },
  );

  it("既存サイトの公開範囲は変わっていない", () => {
    // 代理店は従来どおり業務画面を開ける。
    expect(isPathAllowedForVariant("agency", "/dashboard")).toBe(true);
    expect(isPathAllowedForVariant("agency", "/customers")).toBe(true);
    // 代理店は二次店画面を開けない（従来どおり）。
    expect(isPathAllowedForVariant("agency", "/p-home")).toBe(false);
    // 二次店スタッフは 6 業務 + 個人設定。
    expect(isPathAllowedForVariant("partner", "/p-home")).toBe(true);
    expect(isPathAllowedForVariant("partner", "/p-profile")).toBe(true);
    expect(isPathAllowedForVariant("partner", "/p-salespeople")).toBe(false);
  });

  it("サインイン・health は全サイトで通る", () => {
    for (const v of APP_VARIANTS) {
      expect(isPathAllowedForVariant(v, "/login")).toBe(true);
      expect(isPathAllowedForVariant(v, "/api/health")).toBe(true);
    }
  });
});
