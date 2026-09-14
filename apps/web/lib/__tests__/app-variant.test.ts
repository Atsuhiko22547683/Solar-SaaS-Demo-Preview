// 実行バリアント（代理店 / 二次店）の公開範囲。
//
// 「画面を隠すだけ」にしないため、middleware とレイアウトが同じ純関数を見る。
// その関数の表をここで固定する。

import { describe, expect, it } from "vitest";

import {
  homePathForVariant,
  isAllowedInAgency,
  isAllowedInPartner,
  isPathAllowedForVariant,
  isPublicPath,
  resolveAppVariant,
} from "../app-variant.js";

describe("resolveAppVariant", () => {
  it("未設定・値域外は既存挙動（agency）へ倒す", () => {
    expect(resolveAppVariant(undefined)).toBe("agency");
    expect(resolveAppVariant("")).toBe("agency");
    expect(resolveAppVariant("Partner")).toBe("agency"); // 大文字は別値
    expect(resolveAppVariant("anything")).toBe("agency");
  });

  it("partner のときだけ二次店環境", () => {
    expect(resolveAppVariant("partner")).toBe("partner");
    expect(resolveAppVariant(" partner ")).toBe("partner");
  });
});

describe("partner 環境で開けるパス", () => {
  it("Partner の 4 領域は開ける", () => {
    for (const path of [
      "/p-home",
      "/p-appointments",
      "/p-appointments/new",
      "/p-appointments/abc123",
      "/p-reports",
      "/p-reports/abc123/edit",
      "/p-salespeople",
    ]) {
      expect(isAllowedInPartner(path), `${path} は開ける`).toBe(true);
    }
  });

  it("代理店側の画面はすべて閉じる", () => {
    for (const path of [
      "/dashboard",
      "/customers",
      "/customers/maekaku",
      "/contracts",
      "/product-catalog/pv",
      "/members",
      "/salespeople",
      "/payments",
      "/dealer-reports",
      // 既存の二次店向け業務画面（代理店環境に同居しているもの）も出さない。
      "/d-dashboard",
      "/d-contracts",
      "/incentives",
    ]) {
      expect(isAllowedInPartner(path), `${path} は開けない`).toBe(false);
    }
  });

  it("認証まわりとヘルスチェックは通す", () => {
    for (const path of ["/login", "/api/auth/session", "/api/health", "/invite/xyz"]) {
      expect(isAllowedInPartner(path), `${path} は通す`).toBe(true);
    }
  });

  it("ルートは通す（ロールに応じた振り分けに任せる）", () => {
    expect(isAllowedInPartner("/")).toBe(true);
  });
});

describe("agency 環境で開けるパス", () => {
  it("Partner 専用画面だけを閉じる", () => {
    expect(isAllowedInAgency("/p-home")).toBe(false);
    expect(isAllowedInAgency("/p-appointments/new")).toBe(false);
  });

  it("既存の画面は一切変えない", () => {
    for (const path of [
      "/dashboard",
      "/customers",
      "/product-catalog/pv",
      "/members",
      "/payments",
      "/d-dashboard",
      "/dealer-reports",
      "/login",
    ]) {
      expect(isAllowedInAgency(path), `${path} は従来どおり開ける`).toBe(true);
    }
  });
});

describe("isPathAllowedForVariant", () => {
  it("バリアントごとの判定と一致する", () => {
    expect(isPathAllowedForVariant("partner", "/p-home")).toBe(true);
    expect(isPathAllowedForVariant("partner", "/customers")).toBe(false);
    expect(isPathAllowedForVariant("agency", "/customers")).toBe(true);
    expect(isPathAllowedForVariant("agency", "/p-home")).toBe(false);
  });
});

describe("homePathForVariant", () => {
  it("バリアントごとのホーム", () => {
    expect(homePathForVariant("partner")).toBe("/p-home");
    expect(homePathForVariant("agency")).toBe("/dashboard");
  });
});

describe("isPublicPath", () => {
  it("保護対象の画面は公開扱いにしない", () => {
    expect(isPublicPath("/p-home")).toBe(false);
    expect(isPublicPath("/dashboard")).toBe(false);
  });
});
