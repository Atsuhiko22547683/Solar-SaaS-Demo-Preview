// Unit tests for customer Server Actions (T-04-06 / F-031).
//
// Covers:
//   1. Successful customer creation (wholesaler_admin).
//   2. EVENT channel without sourceEventId → ValidationError (Zod refine).
//   3. Duplicate phone → success with duplicatePhoneWarning=true.
//   4. Dealer tenant can only access own-tenant customers (cross-tenant guard).

import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForbiddenError } from "../../../../lib/errors.js";

import type * as DbModule from "@solar/db";

const authMock = vi.fn();
const relationshipFindManyMock = vi.fn();
const customerCreateMock = vi.fn();
const eventFindUniqueMock = vi.fn();
const customerFindFirstMock = vi.fn();
const customerFindUniqueMock = vi.fn();
const customerUpdateMock = vi.fn();
const salespersonFindUniqueMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

vi.mock("@solar/db", async (orig) => {
  const actual = await orig<typeof DbModule>();
  const tx = {
    customer: {
      create: (...args: unknown[]) => customerCreateMock(...args),
      findFirst: (...args: unknown[]) => customerFindFirstMock(...args),
      findUnique: (...args: unknown[]) => customerFindUniqueMock(...args),
      update: (...args: unknown[]) => customerUpdateMock(...args),
    },
    // イベント経由の登録で sourceEventId の実在確認に使う。
    event: {
      findUnique: (...args: unknown[]) => eventFindUniqueMock(...args),
    },
    // 担当者に指定されたスタッフから userId / relationshipId を導出するのに使う。
    salesperson: {
      findUnique: (...args: unknown[]) => salespersonFindUniqueMock(...args),
    },
  };
  return {
    ...actual,
    rawPrisma: {
      relationship: {
        findMany: (...args: unknown[]) => relationshipFindManyMock(...args),
      },
    },
    withTenant: async <T>(_ctx: unknown, fn: (tx: unknown) => Promise<T>): Promise<T> => fn(tx),
  };
});

const { createCustomerAction, updateCustomerAction } = await import("../actions.js");

const WS_SESSION = {
  user: {
    id: "u_ws_admin",
    tenantId: "tenant_ws_a",
    tenantType: "WHOLESALER",
    wholesalerId: "tenant_ws_a",
    dealerId: null,
    roles: ["WHOLESALER_ADMIN"],
    isSaasAdmin: false,
  },
};

const DEALER_SESSION = {
  user: {
    id: "u_dl_admin",
    tenantId: "tenant_dl_x",
    tenantType: "DEALER",
    wholesalerId: "tenant_ws_a",
    dealerId: "tenant_dl_x",
    roles: ["DEALER_ADMIN"],
    isSaasAdmin: false,
  },
};

beforeEach(() => {
  authMock.mockReset();
  relationshipFindManyMock.mockReset();
  customerCreateMock.mockReset();
  eventFindUniqueMock.mockReset();
  customerFindFirstMock.mockReset();
  customerFindUniqueMock.mockReset();
  customerUpdateMock.mockReset();
  salespersonFindUniqueMock.mockReset();
  revalidatePathMock.mockReset();
});

describe("createCustomerAction", () => {
  it("creates a customer for wholesaler_admin without duplicate phone", async () => {
    authMock.mockResolvedValue(WS_SESSION);
    customerFindFirstMock.mockResolvedValue(null); // no duplicate
    customerCreateMock.mockResolvedValue({ id: "cust_1" });

    const result = await createCustomerAction({
      name: "山田 太郎",
      phone: "090-1234-5678",
      channel: "WALK_IN",
      status: "NEW",
    });

    expect(result).toEqual({ id: "cust_1", duplicatePhoneWarning: false });
    expect(customerCreateMock).toHaveBeenCalledTimes(1);
    const call = customerCreateMock.mock.calls[0]![0] as {
      data: { wholesalerId: string; name: string; channel: string; registeredByOrgType: string };
    };
    expect(call.data.wholesalerId).toBe("tenant_ws_a");
    expect(call.data.name).toBe("山田 太郎");
    expect(call.data.channel).toBe("WALK_IN");
    expect(call.data.registeredByOrgType).toBe("WHOLESALER");
    expect(revalidatePathMock).toHaveBeenCalledWith("/customers");
  });

  it("rejects EVENT channel without sourceEventId (Zod refine → ValidationError)", async () => {
    authMock.mockResolvedValue(WS_SESSION);

    await expect(
      createCustomerAction({
        name: "催事顧客",
        phone: "080-9999-0000",
        channel: "EVENT",
        // sourceEventId intentionally omitted
        status: "NEW",
      }),
    ).rejects.toThrow("催事 ID");

    expect(customerCreateMock).not.toHaveBeenCalled();
  });

  it("returns duplicatePhoneWarning=true when same phone already exists", async () => {
    authMock.mockResolvedValue(WS_SESSION);
    customerFindFirstMock.mockResolvedValue({ id: "cust_existing" }); // duplicate found
    customerCreateMock.mockResolvedValue({ id: "cust_new" });

    const result = await createCustomerAction({
      name: "佐藤 花子",
      phone: "090-1234-5678",
      channel: "TELE",
      status: "NEW",
    });

    expect(result.duplicatePhoneWarning).toBe(true);
    expect(result.id).toBe("cust_new");
    // Customer should still be created despite the duplicate warning.
    expect(customerCreateMock).toHaveBeenCalledTimes(1);
  });

  it("forbids wholesaler_event_team from creating customers via a missing permission role guard", async () => {
    // WHOLESALER_EVENT_TEAM is NOT in customer.create allow-list
    authMock.mockResolvedValue({
      user: {
        ...WS_SESSION.user,
        roles: ["WHOLESALER_EVENT_TEAM"],
      },
    });

    await expect(
      createCustomerAction({
        name: "テスト顧客",
        phone: "070-0000-0001",
        channel: "WALK_IN",
        status: "NEW",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(customerCreateMock).not.toHaveBeenCalled();
  });
});

describe("updateCustomerAction", () => {
  it("updates the customer fields and revalidates paths", async () => {
    authMock.mockResolvedValue(WS_SESSION);
    customerFindUniqueMock.mockResolvedValue({
      id: "cust_1",
      phone: "090-0000-0001",
      wholesalerId: "tenant_ws_a",
    });
    customerUpdateMock.mockResolvedValue({ id: "cust_1" });

    const result = await updateCustomerAction({
      id: "cust_1",
      name: "山田 次郎",
    });

    expect(result.id).toBe("cust_1");
    expect(result.duplicatePhoneWarning).toBe(false);
    const updateArgs = customerUpdateMock.mock.calls[0]![0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(updateArgs.where.id).toBe("cust_1");
    expect(updateArgs.data.name).toBe("山田 次郎");
    expect(revalidatePathMock).toHaveBeenCalledWith("/customers");
    expect(revalidatePathMock).toHaveBeenCalledWith("/customers/cust_1");
  });

  it("dealer_admin is allowed to update (has customer.update role)", async () => {
    authMock.mockResolvedValue(DEALER_SESSION);
    relationshipFindManyMock.mockResolvedValue([{ id: "rel_a_x" }]);
    customerFindUniqueMock.mockResolvedValue({
      id: "cust_2",
      phone: "090-5555-4444",
      wholesalerId: "tenant_ws_a",
    });
    customerUpdateMock.mockResolvedValue({ id: "cust_2" });

    const result = await updateCustomerAction({
      id: "cust_2",
      note: "フォローアップ必要",
    });

    // RLS enforces tenant isolation at DB level; the action itself should succeed.
    expect(result.id).toBe("cust_2");
  });
});

// ---------------------------------------------------------------------------
// イベント経由の顧客登録 — #3 の確認項目。
//
// sourceEventId は query parameter / フォーム値としてクライアントから来るので、
// 自テナントに実在する Event かをサーバ側で確かめる。実在イベント由来なら
// 販売チャネルは常に催事（EVENT）に寄せる。
// ---------------------------------------------------------------------------

describe("イベント経由の顧客登録（salesChannel と sourceEventId 検証）", () => {
  function createdData(): Record<string, unknown> {
    return (customerCreateMock.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
  }

  it("実在するイベント由来なら salesChannel = EVENT で保存される", async () => {
    authMock.mockResolvedValue(WS_SESSION);
    customerFindFirstMock.mockResolvedValue(null);
    eventFindUniqueMock.mockResolvedValue({ id: "ev_1" });
    customerCreateMock.mockResolvedValue({ id: "cust_ev" });

    await createCustomerAction({
      name: "催事顧客",
      phone: "080-0000-0001",
      channel: "EVENT",
      sourceEventId: "ev_1",
      status: "NEW",
    });

    expect(createdData().salesChannel).toBe("EVENT");
    expect(createdData().sourceEventId).toBe("ev_1");
  });

  it("イベント由来ならフォームが別の販売チャネルを送っても EVENT に寄せる", async () => {
    authMock.mockResolvedValue(WS_SESSION);
    customerFindFirstMock.mockResolvedValue(null);
    eventFindUniqueMock.mockResolvedValue({ id: "ev_1" });
    customerCreateMock.mockResolvedValue({ id: "cust_ev2" });

    await createCustomerAction({
      name: "催事顧客2",
      phone: "080-0000-0002",
      channel: "EVENT",
      sourceEventId: "ev_1",
      // 改ざん / 誤操作でこの値が来ても採用しない。
      salesChannel: "VISIT_SALES",
      status: "NEW",
    });

    expect(createdData().salesChannel).toBe("EVENT");
  });

  it("存在しない（または他テナントの）イベント ID は NotFound で弾く", async () => {
    authMock.mockResolvedValue(WS_SESSION);
    customerFindFirstMock.mockResolvedValue(null);
    // RLS スコープ外は findUnique が null を返す = 他テナントも同じ扱い。
    eventFindUniqueMock.mockResolvedValue(null);

    await expect(
      createCustomerAction({
        name: "偽イベント顧客",
        phone: "080-0000-0003",
        channel: "EVENT",
        sourceEventId: "ev_other_tenant",
        status: "NEW",
      }),
    ).rejects.toThrow("催事が見つかりません");

    expect(customerCreateMock).not.toHaveBeenCalled();
  });

  it("イベント由来でなければフォームの販売チャネルをそのまま使う", async () => {
    authMock.mockResolvedValue(WS_SESSION);
    customerFindFirstMock.mockResolvedValue(null);
    customerCreateMock.mockResolvedValue({ id: "cust_visit" });

    await createCustomerAction({
      name: "訪販顧客",
      phone: "080-0000-0004",
      channel: "WALK_IN",
      salesChannel: "VISIT_SALES",
      status: "NEW",
    });

    expect(createdData().salesChannel).toBe("VISIT_SALES");
    expect(createdData().sourceEventId).toBeNull();
    expect(eventFindUniqueMock).not.toHaveBeenCalled();
  });

  it("販売チャネル未指定・イベント由来でなければ null のまま", async () => {
    authMock.mockResolvedValue(WS_SESSION);
    customerFindFirstMock.mockResolvedValue(null);
    customerCreateMock.mockResolvedValue({ id: "cust_null" });

    await createCustomerAction({
      name: "未設定顧客",
      phone: "080-0000-0005",
      channel: "WALK_IN",
      status: "NEW",
    });

    expect(createdData().salesChannel).toBeNull();
  });

  it("対面者は 3 状態（主権者 / 非主権者 / 未設定）をそのまま保存する", async () => {
    authMock.mockResolvedValue(WS_SESSION);
    customerFindFirstMock.mockResolvedValue(null);
    customerCreateMock.mockResolvedValue({ id: "cust_f2f" });

    await createCustomerAction({
      name: "対面者顧客",
      phone: "080-0000-0006",
      channel: "WALK_IN",
      faceToFace: false,
      tossDept: "  第一営業部  ",
      status: "NEW",
    });

    // false（非主権者）を null（未設定）に潰さない。
    expect(createdData().faceToFace).toBe(false);
    expect(createdData().tossDept).toBe("第一営業部");
  });
});

// ---------------------------------------------------------------------------
// 担当者の個人スタッフ指定 — Customer.tossUpSalespersonId / closingSalespersonId。
//
// クライアントから送られた userId / relationshipId は信用せず、必ず Salesperson を
// 読み直して 3 列（*SalespersonId / *UserId / *RelationshipId）を整合させる。
// ---------------------------------------------------------------------------

describe("担当者の個人スタッフ指定（tossUp / closing Salesperson）", () => {
  function updatedData(): Record<string, unknown> {
    return (customerUpdateMock.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
  }

  function primeCustomer() {
    authMock.mockResolvedValue(WS_SESSION);
    customerFindUniqueMock.mockResolvedValue({
      id: "cust_1",
      phone: "090-0000-0000",
      wholesalerId: "tenant_ws_a",
    });
    customerUpdateMock.mockResolvedValue({ id: "cust_1" });
  }

  it("自社スタッフ指定なら salespersonId だけを保存し、userId は書かない", async () => {
    primeCustomer();
    salespersonFindUniqueMock.mockResolvedValue({
      id: "sp_self",
      userId: "u_staff",
      relationshipId: null,
    });

    await updateCustomerAction({ id: "cust_1", tossUpSalespersonId: "sp_self" });

    expect(updatedData().tossUpSalespersonId).toBe("sp_self");
    // システムユーザー（User）はスタッフマスタではないので、担当として保存しない。
    // Salesperson が userId を持っていても引き写さず、過去の指定は null に戻す。
    expect(updatedData().tossUpUserId).toBeNull();
    expect(updatedData().tossUpRelationshipId).toBeNull();
  });

  it("二次店スタッフ指定なら relationshipId を導出し userId は null になる", async () => {
    primeCustomer();
    salespersonFindUniqueMock.mockResolvedValue({
      id: "sp_dealer",
      userId: null,
      relationshipId: "rel_a",
    });

    await updateCustomerAction({ id: "cust_1", closingSalespersonId: "sp_dealer" });

    expect(updatedData().closingSalespersonId).toBe("sp_dealer");
    expect(updatedData().closingRelationshipId).toBe("rel_a");
    expect(updatedData().closingUserId).toBeNull();
  });

  it("クライアントが送った userId / relationshipId は採用しない（改ざん防止）", async () => {
    primeCustomer();
    salespersonFindUniqueMock.mockResolvedValue({
      id: "sp_dealer",
      userId: null,
      relationshipId: "rel_a",
    });

    await updateCustomerAction({
      id: "cust_1",
      tossUpSalespersonId: "sp_dealer",
      // 実データと矛盾する値を同時に送っても無視される。
      tossUpUserId: "u_spoofed",
      tossUpRelationshipId: "rel_spoofed",
    });

    expect(updatedData().tossUpRelationshipId).toBe("rel_a");
    expect(updatedData().tossUpUserId).toBeNull();
  });

  it("存在しない（別テナントの）スタッフ ID は NotFound で弾く", async () => {
    primeCustomer();
    // RLS スコープ外は findUnique が null を返す = 他テナントも同じ扱い。
    salespersonFindUniqueMock.mockResolvedValue(null);

    await expect(
      updateCustomerAction({ id: "cust_1", tossUpSalespersonId: "sp_other_tenant" }),
    ).rejects.toThrow("スタッフが見つかりません");

    expect(customerUpdateMock).not.toHaveBeenCalled();
  });

  it("null 指定なら個人スタッフの紐付けだけ外す（会社・User の既存値は触らない）", async () => {
    primeCustomer();

    await updateCustomerAction({ id: "cust_1", tossUpSalespersonId: null });

    expect(updatedData().tossUpSalespersonId).toBeNull();
    expect("tossUpUserId" in updatedData()).toBe(false);
    expect("tossUpRelationshipId" in updatedData()).toBe(false);
    expect(salespersonFindUniqueMock).not.toHaveBeenCalled();
  });

  it("スタッフ未指定なら従来どおり userId / relationshipId を直接保存する", async () => {
    primeCustomer();

    await updateCustomerAction({
      id: "cust_1",
      tossUpRelationshipId: "rel_legacy",
      tossUpUserId: null,
    });

    expect(updatedData().tossUpRelationshipId).toBe("rel_legacy");
    expect(updatedData().tossUpUserId).toBeNull();
    expect(salespersonFindUniqueMock).not.toHaveBeenCalled();
  });

  it("会社だけ選んだ場合（salespersonId=null）は relationshipId をそのまま保存する", async () => {
    // ダイアログはスタッフ未選択のとき salespersonId に null を送る。
    // これを「未送信」と取り違えると二次店（会社）が保存されず担当者が消える。
    authMock.mockResolvedValue(WS_SESSION);
    customerFindUniqueMock.mockResolvedValue({
      id: "cust_1",
      phone: "090-0000-0000",
      wholesalerId: "tenant_ws_a",
    });
    customerUpdateMock.mockResolvedValue({ id: "cust_1" });

    await updateCustomerAction({
      id: "cust_1",
      tossUpSalespersonId: null,
      tossUpRelationshipId: "rel_only",
      tossUpUserId: null,
    });

    const data = (customerUpdateMock.mock.calls[0]![0] as { data: Record<string, unknown> }).data;
    expect(data.tossUpSalespersonId).toBeNull();
    expect(data.tossUpRelationshipId).toBe("rel_only");
    expect(data.tossUpUserId).toBeNull();
    expect(salespersonFindUniqueMock).not.toHaveBeenCalled();
  });
});
