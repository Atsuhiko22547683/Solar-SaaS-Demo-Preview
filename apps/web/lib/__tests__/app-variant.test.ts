// 実行バリアント（＝どのサイトとして起動しているか）の公開範囲。
//
// 「画面を隠すだけ」にしないため、middleware とレイアウトが同じ純関数を見る。
// その関数の表をここで固定する。3 サイト（一次代理店 / 二次店スタッフ /
// 二次店管理者）で公開するパスが違うので、サイトごとに表を持つ。

import { describe, expect, it } from "vitest";

import {
  authCookiePrefix,
  homePathForVariant,
  isAllowedInAgency,
  isAllowedInPartnerSite,
  isPathAllowedForVariant,
  isPublicPath,
  partnerSiteFor,
  resolveAppVariant,
  sessionCookieNames,
} from "../app-variant.js";

describe("resolveAppVariant", () => {
  it("未設定は既存挙動（agency）へ倒す", () => {
    expect(resolveAppVariant(undefined)).toBe("agency");
    expect(resolveAppVariant("")).toBe("agency");
    expect(resolveAppVariant("   ")).toBe("agency");
  });

  it("3 サイトの値を受け付ける", () => {
    expect(resolveAppVariant("agency")).toBe("agency");
    expect(resolveAppVariant("partner")).toBe("partner");
    expect(resolveAppVariant(" partner ")).toBe("partner");
    expect(resolveAppVariant("partner-admin")).toBe("partner-admin");
  });

  it("値域外は落とす（別サイトとして起動させない）", () => {
    // "partner-admn" のような打ち間違いが一次代理店サイトとして公開されるのが
    // 最悪の失敗なので、黙って agency へ倒さない。
    for (const bad of ["Partner", "PARTNER-ADMIN", "partner-admn", "anything"]) {
      expect(() => resolveAppVariant(bad), `${bad} は拒否`).toThrow(/APP_VARIANT/);
    }
  });
});

describe("partnerSiteFor", () => {
  it("バリアントとサイト区分の対応", () => {
    expect(partnerSiteFor("partner")).toBe("STAFF");
    expect(partnerSiteFor("partner-admin")).toBe("ADMIN");
    expect(partnerSiteFor("agency")).toBeNull();
  });
});

describe("認証 Cookie 名", () => {
  it("サイトごとに接頭辞を分ける（同じブラウザで同時ログインできる）", () => {
    expect(authCookiePrefix("agency")).toBe("authjs");
    expect(authCookiePrefix("partner")).toBe("partner-authjs");
    expect(authCookiePrefix("partner-admin")).toBe("partner-admin-authjs");
  });

  it("3 サイトのセッション Cookie 名が重ならない", () => {
    const names = (["agency", "partner", "partner-admin"] as const).flatMap(sessionCookieNames);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("二次店スタッフサイトで開けるパス", () => {
  it("スタッフの 6 業務は開ける", () => {
    for (const path of [
      "/p-home",
      "/p-appointments",
      "/p-appointments/new",
      "/p-appointments/abc123",
      "/p-contracts",
      "/p-reports/abc123/edit",
      "/p-catalog",
      "/p-customers",
      "/p-shifts",
    ]) {
      expect(isAllowedInPartnerSite("STAFF", path), `${path} は開ける`).toBe(true);
    }
  });

  it("管理者サイトの画面は開けない", () => {
    for (const path of [
      "/p-salespeople",
      "/p-salespeople/new",
      "/p-accounts",
      "/p-accounts/abc123",
      "/p-commissions",
      "/p-lane-preferences",
    ]) {
      expect(isAllowedInPartnerSite("STAFF", path), `${path} は開けない`).toBe(false);
    }
  });

  it("代理店側の画面はすべて閉じる", () => {
    for (const path of ["/dashboard", "/customers", "/members", "/d-dashboard", "/incentives"]) {
      expect(isAllowedInPartnerSite("STAFF", path), `${path} は開けない`).toBe(false);
    }
  });
});

describe("二次店管理者サイトで開けるパス", () => {
  it("管理者の 9 業務は開ける", () => {
    for (const path of [
      "/p-home",
      "/p-appointments",
      "/p-contracts",
      "/p-reports",
      "/p-salespeople",
      "/p-salespeople/new",
      "/p-accounts",
      "/p-accounts/abc123",
      "/p-commissions",
      "/p-customers",
      "/p-customers/abc/edit",
      "/p-lane-preferences",
      "/p-shifts",
    ]) {
      expect(isAllowedInPartnerSite("ADMIN", path), `${path} は開ける`).toBe(true);
    }
  });

  it("スタッフ向けのカタログは開けない（管理者の業務に無い）", () => {
    expect(isAllowedInPartnerSite("ADMIN", "/p-catalog")).toBe(false);
    expect(isAllowedInPartnerSite("ADMIN", "/p-catalog/abc")).toBe(false);
  });

  it("代理店側の画面はすべて閉じる", () => {
    for (const path of ["/dashboard", "/customers", "/members", "/d-dashboard"]) {
      expect(isAllowedInPartnerSite("ADMIN", path), `${path} は開けない`).toBe(false);
    }
  });
});

describe("二次店サイト共通", () => {
  it("認証まわりとヘルスチェックは通す", () => {
    for (const path of ["/login", "/api/auth/session", "/api/health", "/invite/xyz", "/profile"]) {
      for (const site of ["STAFF", "ADMIN"] as const) {
        expect(isAllowedInPartnerSite(site, path), `${site}: ${path} は通す`).toBe(true);
      }
    }
  });

  it("ルートは通す（サイトのホームへ振り分ける）", () => {
    expect(isAllowedInPartnerSite("STAFF", "/")).toBe(true);
    expect(isAllowedInPartnerSite("ADMIN", "/")).toBe(true);
  });
});

describe("agency 環境で開けるパス", () => {
  it("Partner 専用画面だけを閉じる", () => {
    expect(isAllowedInAgency("/p-home")).toBe(false);
    expect(isAllowedInAgency("/p-appointments/new")).toBe(false);
    expect(isAllowedInAgency("/p-accounts")).toBe(false);
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
    expect(isPathAllowedForVariant("partner", "/p-accounts")).toBe(false);
    expect(isPathAllowedForVariant("partner-admin", "/p-accounts")).toBe(true);
    expect(isPathAllowedForVariant("partner-admin", "/p-catalog")).toBe(false);
    expect(isPathAllowedForVariant("agency", "/customers")).toBe(true);
    expect(isPathAllowedForVariant("agency", "/p-home")).toBe(false);
  });
});

describe("homePathForVariant", () => {
  it("サイトごとのホーム", () => {
    expect(homePathForVariant("partner")).toBe("/p-home");
    expect(homePathForVariant("partner-admin")).toBe("/p-home");
    expect(homePathForVariant("agency")).toBe("/dashboard");
  });
});

describe("isPublicPath", () => {
  it("保護対象の画面は公開扱いにしない", () => {
    expect(isPublicPath("/p-home")).toBe(false);
    expect(isPublicPath("/dashboard")).toBe(false);
  });
});
