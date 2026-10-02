// 出店希望の提出フォーム入力。
//
// 業務の形（レーン × 希望順位 × 複数希望日程 × 店舗ごとの個別条件）が、そのまま
// 入力として通ることを固定する。
//
// 希望日程はレーン単位の自由記述で受け、ここで配列にする。形式違いを黙って落とさない
// （落とすと提出漏れに気付けない）。
// 個別条件は希望順位とは別の軸なので、順位へ読み替えず独立した項目として保持する。

import { describe, expect, it } from "vitest";

import { PartnerLanePreferenceSubmitSchema } from "../src/schemas/partner-lane-preference.js";

// 希望場所は店舗マスタの id で送る。名称は代理店側がマスタから確定するので送らない。
const item = { storeId: "store-1" };
const lane = (over: Record<string, unknown> = {}) => ({
  laneNo: 1,
  items: [item],
  ...over,
});
const base = (over: Record<string, unknown> = {}) => ({
  targetMonth: "2026-06",
  laneCount: 1,
  lanes: [lane()],
  ...over,
});

describe("PartnerLanePreferenceSubmitSchema", () => {
  it("対象月・希望レーン数・レーンを受け付ける", () => {
    const r = PartnerLanePreferenceSubmitSchema.safeParse(base());
    expect(r.success).toBe(true);
    expect(r.success && r.data.lanes[0]!.desiredDates).toEqual([]);
  });

  it("希望日程は改行・カンマ・読点で区切って配列にする", () => {
    const r = PartnerLanePreferenceSubmitSchema.safeParse(
      base({
        lanes: [lane({ desiredDates: "2026-06-05\n2026-06-06, 2026-06-07、2026-06-08" })],
      }),
    );
    expect(r.success).toBe(true);
    expect(r.success && r.data.lanes[0]!.desiredDates).toEqual([
      "2026-06-05",
      "2026-06-06",
      "2026-06-07",
      "2026-06-08",
    ]);
  });

  it("日付の形式違いはエラー（黙って捨てない）", () => {
    const r = PartnerLanePreferenceSubmitSchema.safeParse(
      base({ lanes: [lane({ desiredDates: "2026/06/05" })] }),
    );
    expect(r.success).toBe(false);
  });

  it("対象月の形式違いはエラー", () => {
    for (const targetMonth of ["2026-13", "2026/06", "202606", ""]) {
      expect(PartnerLanePreferenceSubmitSchema.safeParse(base({ targetMonth })).success).toBe(
        false,
      );
    }
  });

  it("レーンが 0 件ならエラー", () => {
    expect(PartnerLanePreferenceSubmitSchema.safeParse(base({ lanes: [] })).success).toBe(false);
  });

  it("レーン内の希望店舗が 0 件ならエラー", () => {
    expect(
      PartnerLanePreferenceSubmitSchema.safeParse(base({ lanes: [lane({ items: [] })] })).success,
    ).toBe(false);
  });

  it("希望場所（店舗）は必須", () => {
    // 空の店舗 id は弾く。
    expect(
      PartnerLanePreferenceSubmitSchema.safeParse(
        base({ lanes: [lane({ items: [{ storeId: "" }] })] }),
      ).success,
    ).toBe(false);
  });

  it("店舗を指さない自由記述だけの明細は受け付けない", () => {
    // 以前は venueLabel の自由記述だけで提出でき、「カインズ 大宮店」がマスタの
    // どの行を指すのか決まらなかった。店舗 id が無い明細は通さない。
    expect(
      PartnerLanePreferenceSubmitSchema.safeParse(
        base({ lanes: [lane({ items: [{ venueLabel: "カインズ 大宮店" }] })] }),
      ).success,
    ).toBe(false);
  });

  it("2 レーン・順位付き・レーンごとの希望日程を受け付ける", () => {
    // 業務の実例（1 レーン目 3 希望 / 2 レーン目 3 希望、日程はレーンごと）。
    const r = PartnerLanePreferenceSubmitSchema.safeParse({
      targetMonth: "2026-07",
      laneCount: 2,
      lanes: [
        {
          laneNo: 1,
          desiredDates: "2026-07-04, 2026-07-05, 2026-07-11, 2026-07-12",
          items: [{ storeId: "store-a1" }, { storeId: "store-a2" }, { storeId: "store-a3" }],
        },
        {
          laneNo: 2,
          desiredDates: "2026-07-18, 2026-07-19",
          items: [
            { storeId: "store-b1" },
            { storeId: "store-b2" },
            // 個別条件は順位とは別の軸。第四希望へ読み替えない。
            { storeId: "store-b3", conditionNote: "上記日程のいずれか 2 日間を希望" },
          ],
        },
      ],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.lanes).toHaveLength(2);
    // 順位は配列の位置で決まる。保存値は店舗 id。
    expect(r.data.lanes[0]!.items.map((i) => i.storeId)).toEqual([
      "store-a1",
      "store-a2",
      "store-a3",
    ]);
    expect(r.data.lanes[0]!.desiredDates).toHaveLength(4);
    // 個別条件は順位（配列の位置）とは独立して保持される。
    expect(r.data.lanes[1]!.items[2]!.conditionNote).toBe("上記日程のいずれか 2 日間を希望");
    expect(r.data.lanes[1]!.items).toHaveLength(3);
  });

  it("依頼先代理店は任意（取引先が 1 社なら省略できる）", () => {
    expect(PartnerLanePreferenceSubmitSchema.safeParse(base()).success).toBe(true);
    const r = PartnerLanePreferenceSubmitSchema.safeParse(base({ relationshipId: "rel-1" }));
    expect(r.success && r.data.relationshipId).toBe("rel-1");
  });

  it("希望レーン数は明細数から導出せず、申告値をそのまま保持する", () => {
    // 「2 レーン希望だが 1 レーンぶんしか店舗が決まっていない」を表せるようにする。
    const r = PartnerLanePreferenceSubmitSchema.safeParse(base({ laneCount: 2 }));
    expect(r.success && r.data.laneCount).toBe(2);
    expect(r.success && r.data.lanes).toHaveLength(1);
  });
});
