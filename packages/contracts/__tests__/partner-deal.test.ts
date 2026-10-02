// スタッフの商談情報編集スキーマ。
//
// 「商談情報だけを受け付け、顧客基本情報・担当者・粗利は受け取らない」を表として固定する。

import { describe, expect, it } from "vitest";

import {
  PARTNER_DEAL_EDITABLE_FIELDS,
  PartnerDealUpdateSchema,
} from "../src/schemas/partner-deal.js";

const base = { id: "deal-1", status: "VISITED" };

describe("PartnerDealUpdateSchema", () => {
  it("商談情報 7 項目は受け付ける", () => {
    const r = PartnerDealUpdateSchema.safeParse({
      ...base,
      proposedProduct: "蓄電池 6.3kWh",
      proposedAmount: "1500000",
      expectedContractDate: "2026-05-01",
      lostReason: "",
      nextAction: "見積再提示",
      note: "メモ",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.proposedAmount).toBe(1500000);
      expect(r.data.lostReason).toBeUndefined();
      for (const key of PARTNER_DEAL_EDITABLE_FIELDS) {
        expect(Object.keys(r.data)).toContain(key === "lostReason" ? "id" : key);
      }
    }
  });

  it.each([
    ["assignedToUserId", "u-other"],
    ["ownerUserId", "u-other"],
    ["expectedProfit", 100],
    ["name", "山田 太郎"],
    ["phone", "09011112222"],
    ["addressLine", "どこか"],
    ["closingSalespersonId", "sp-1"],
    ["ownerRelationshipId", "rel-other"],
  ])("画面に無い項目 %s は拒否する（.strict）", (key, value) => {
    const r = PartnerDealUpdateSchema.safeParse({ ...base, [key]: value });
    expect(r.success).toBe(false);
  });

  it("ステータスは既存の値域だけ", () => {
    expect(PartnerDealUpdateSchema.safeParse({ ...base, status: "DONE" }).success).toBe(false);
    expect(PartnerDealUpdateSchema.safeParse({ ...base, status: "LOST" }).success).toBe(true);
  });

  it("提案金額は 0 以上の数値", () => {
    expect(PartnerDealUpdateSchema.safeParse({ ...base, proposedAmount: "-1" }).success).toBe(
      false,
    );
    expect(PartnerDealUpdateSchema.safeParse({ ...base, proposedAmount: "abc" }).success).toBe(
      false,
    );
    expect(PartnerDealUpdateSchema.safeParse({ ...base, proposedAmount: "" }).success).toBe(true);
  });

  it("契約予定日は不正値を弾き、空欄は未設定", () => {
    expect(PartnerDealUpdateSchema.safeParse({ ...base, expectedContractDate: "x" }).success).toBe(
      false,
    );
    const r = PartnerDealUpdateSchema.safeParse({ ...base, expectedContractDate: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.expectedContractDate).toBeUndefined();
  });
});
