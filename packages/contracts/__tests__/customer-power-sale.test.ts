// 顧客詳細「売電状況」タブ (Customer.powerSaleStartDate / powerSaleNote) の
// CustomerUpdateSchema 受理・null クリア・未指定許容・改行保持・上限長を検証。
//
// このタブが持つのは売電開始日と備考の 2 項目だけで、申請 ID の独立項目は作らない
// （申請 ID は備考へ自由記述する運用）。ここでその契約を固定する。

import { describe, expect, it } from "vitest";

import { CustomerUpdateSchema } from "../src/schemas/customer.js";

describe("CustomerUpdateSchema — 売電状況 (powerSale*)", () => {
  it("売電開始日を YYYY-MM-DD で受理する", () => {
    const parsed = CustomerUpdateSchema.parse({
      id: "cust_1",
      powerSaleStartDate: "2026-07-27",
    });
    expect(parsed.powerSaleStartDate).toBe("2026-07-27");
  });

  it("備考は複数行・記号・全角を保持する（改行を潰さない）", () => {
    const note = "店舗契約→2月21日の14時〜16時の間\n電力情報施工店共有済み〇\n★申請ID：09174680";
    const parsed = CustomerUpdateSchema.parse({ id: "cust_1", powerSaleNote: note });
    expect(parsed.powerSaleNote).toBe(note);
    expect(parsed.powerSaleNote?.split("\n")).toHaveLength(3);
  });

  it("null で未設定へ戻せる（開始日・備考とも）", () => {
    const parsed = CustomerUpdateSchema.parse({
      id: "cust_1",
      powerSaleStartDate: null,
      powerSaleNote: null,
    });
    expect(parsed.powerSaleStartDate).toBeNull();
    expect(parsed.powerSaleNote).toBeNull();
  });

  it("未指定なら key ごと現れない（他項目だけの更新を壊さない）", () => {
    const parsed = CustomerUpdateSchema.parse({ id: "cust_1", name: "山田 太郎" });
    expect(parsed.powerSaleStartDate).toBeUndefined();
    expect(parsed.powerSaleNote).toBeUndefined();
  });

  it("備考は 5000 文字まで。超過は弾く", () => {
    expect(() =>
      CustomerUpdateSchema.parse({ id: "cust_1", powerSaleNote: "あ".repeat(5000) }),
    ).not.toThrow();
    expect(() =>
      CustomerUpdateSchema.parse({ id: "cust_1", powerSaleNote: "あ".repeat(5001) }),
    ).toThrow();
  });

  it("申請 ID の独立項目は持たない（備考へ記載する運用）", () => {
    const parsed = CustomerUpdateSchema.parse({
      id: "cust_1",
      // 未知キーは strip される = スキーマ上そのような項目は存在しない。
      applicationId: "09174680",
    } as Record<string, unknown>);
    expect(parsed).not.toHaveProperty("applicationId");
    expect(parsed).not.toHaveProperty("powerSaleApplicationId");
  });
});
