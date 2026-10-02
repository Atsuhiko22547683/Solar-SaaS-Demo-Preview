// 二次店ポータルの管理者 / スタッフ権限。
//
// 「販売員管理は管理者だけ」「報告・閲覧系はどちらも」をアクション単位で固定する。
// 行単位の所有者条件（本人提出分のみ）は requirePartnerContext 側の責務なので、
// ここではロール × アクションの可否だけを見る。

import { describe, expect, it } from "vitest";

import { ForbiddenError } from "../../errors.js";
import { canUsePartnerSite, partnerRoleForSite } from "../../partner/role.js";
import { assertCan, type PermissionUser } from "../can.js";

function dealerUser(role: "DEALER_ADMIN" | "DEALER_STAFF"): PermissionUser {
  return {
    userId: "u-1",
    roles: [role],
    isSaasAdmin: false,
    tenantId: "dealer-alpha",
    wholesalerId: "w-a",
    dealerId: "dealer-alpha",
    relationshipIds: ["rel-a-alpha"],
  };
}

const ADMIN_ONLY = [
  "partner_salesperson.read",
  "partner_salesperson.write",
  // 二次店管理者側の 9 業務で増えたアクション。スタッフからは 403 のままにする。
  "partner_user.read",
  "partner_user.write",
  "partner_commission.read",
  "partner_customer.write",
  "partner_customer.delete",
  "partner_lane_preference.read",
] as const;
const BOTH = [
  "partner_salesperson.options",
  "partner_appointment.read",
  "partner_appointment.write",
  "partner_visit_appointment.read",
  "partner_visit_appointment.write",
  "partner_contract_report.read",
  "partner_contract_report.write",
  "partner_event_report.read",
  "partner_event_report.write",
  "partner_catalog.read",
  "partner_customer.read",
  "partner_deal.write",
  "partner_shift.read",
] as const;

describe("二次店スタッフの権限", () => {
  it.each(ADMIN_ONLY)("%s はスタッフに拒否される（管理者は可）", (action) => {
    expect(() => assertCan({ user: dealerUser("DEALER_STAFF"), action })).toThrow(ForbiddenError);
    expect(() => assertCan({ user: dealerUser("DEALER_ADMIN"), action })).not.toThrow();
  });

  it.each(BOTH)("%s は管理者・スタッフの両方が使える", (action) => {
    expect(() => assertCan({ user: dealerUser("DEALER_STAFF"), action })).not.toThrow();
    expect(() => assertCan({ user: dealerUser("DEALER_ADMIN"), action })).not.toThrow();
  });

  it("代理店ロールは二次店ポータルのアクションを使えない", () => {
    const agency: PermissionUser = {
      userId: "u-w",
      roles: ["WHOLESALER_ADMIN"],
      isSaasAdmin: false,
      tenantId: "w-a",
      wholesalerId: "w-a",
      relationshipIds: [],
    };
    for (const action of [...ADMIN_ONLY, ...BOTH]) {
      expect(() => assertCan({ user: agency, action })).toThrow(ForbiddenError);
    }
  });
});

describe("partnerRoleForSite（サイト + ロールで決める）", () => {
  it("スタッフサイトはスタッフロールが対象。管理者ロールだけでは対象外", () => {
    expect(partnerRoleForSite("STAFF", ["DEALER_STAFF"])).toBe("STAFF");
    // 管理者ロールしか持たない利用者は、スタッフサイトの利用対象ではない。
    // ここで "ADMIN" を返すと、スタッフサイトが自社全件を表示してしまう。
    expect(partnerRoleForSite("STAFF", ["DEALER_ADMIN"])).toBeNull();
  });

  it("管理者サイトは管理者ロールが対象。スタッフロールだけでは対象外", () => {
    expect(partnerRoleForSite("ADMIN", ["DEALER_ADMIN"])).toBe("ADMIN");
    expect(partnerRoleForSite("ADMIN", ["DEALER_STAFF"])).toBeNull();
  });

  it("両方のロールを持つ利用者は、開いているサイトの区分で動く", () => {
    const both = ["DEALER_STAFF", "DEALER_ADMIN"];
    expect(partnerRoleForSite("STAFF", both)).toBe("STAFF");
    expect(partnerRoleForSite("ADMIN", both)).toBe("ADMIN");
  });

  it("二次店ロールを持たない利用者はどちらのサイトも対象外", () => {
    for (const roles of [[], ["WHOLESALER_ADMIN"], ["SAAS_ADMIN"]]) {
      expect(canUsePartnerSite("STAFF", roles)).toBe(false);
      expect(canUsePartnerSite("ADMIN", roles)).toBe(false);
    }
  });
});
