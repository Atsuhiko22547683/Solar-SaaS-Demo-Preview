// 二次店管理者が自社顧客を編集・削除するときの入力スキーマ。
//
// 「二次店ポータルで触れる列だけ」「代理店の業務項目は混ぜられない」を固定する。

import { describe, expect, it } from "vitest";

import {
  PartnerCustomerDeleteSchema,
  PartnerCustomerUpdateSchema,
} from "../src/schemas/partner-customer.js";

const base = {
  id: "c1",
  name: "山田 太郎",
  phone: "09012345678",
  status: "IN_NEGOTIATION" as const,
};

describe("PartnerCustomerUpdateSchema", () => {
  it("連絡先・住所・担当者・ステータス・備考を受け付ける", () => {
    const r = PartnerCustomerUpdateSchema.safeParse({
      ...base,
      kana: "ヤマダ タロウ",
      landlinePhone: "0480123456",
      mobilePhone: "09012345678",
      postalCode: "3600000",
      prefecture: "埼玉県",
      city: "熊谷市",
      addressLine: "1-2-3",
      tossUpSalespersonId: "sp1",
      closingSalespersonId: null,
      note: "備考",
    });
    expect(r.success).toBe(true);
  });

  it("お客様名と電話番号は必須", () => {
    expect(PartnerCustomerUpdateSchema.safeParse({ ...base, name: "  " }).success).toBe(false);
    expect(PartnerCustomerUpdateSchema.safeParse({ ...base, phone: "" }).success).toBe(false);
  });

  it("値域外の顧客ステータスは受け付けない", () => {
    expect(PartnerCustomerUpdateSchema.safeParse({ ...base, status: "UNKNOWN" }).success).toBe(
      false,
    );
  });

  it("代理店側の業務項目（契約・施工・補助金など）は混ぜられない", () => {
    for (const extra of [
      { contractAmount: 1000000 },
      { constructionStatus: "done" },
      { subsidyStatus: "applied" },
      { ownerRelationshipId: "rel-other" },
      { wholesalerId: "w-other" },
    ]) {
      expect(PartnerCustomerUpdateSchema.safeParse({ ...base, ...extra }).success).toBe(false);
    }
  });
});

describe("PartnerCustomerDeleteSchema", () => {
  it("確認用のお客様名を必ず受け取る", () => {
    expect(
      PartnerCustomerDeleteSchema.safeParse({ id: "c1", confirmName: "山田 太郎" }).success,
    ).toBe(true);
    expect(PartnerCustomerDeleteSchema.safeParse({ id: "c1" }).success).toBe(false);
    expect(PartnerCustomerDeleteSchema.safeParse({ id: "c1", confirmName: " " }).success).toBe(
      false,
    );
  });
});
