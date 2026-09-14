// 催事日報の入力検証（Google フォーム「ES_日報」準拠 / docs/02 F-064）。
//
// 合計は保存しないので、算出関数と大小関係の検証をここで固定する。

import { describe, expect, it } from "vitest";

import {
  DealerEventReportCreateSchema,
  dealerReportTotals,
} from "../src/schemas/dealer-event-report.js";

const BASE = {
  eventDate: "2026-04-01",
  venuePlace: "群馬県 前橋みなみモール店",
  category: "HOUSING_EQUIPMENT" as const,
  venueChain: "CAINZ_V" as const,
  areaInFacility: "1階エレベーター前",
  startTime: "10:00",
  endTime: "18:00",
  lotteryBoth: 30,
  lotterySingle: 20,
  seatedBoth: 10,
  seatedSingle: 8,
  apptBoth: 4,
  apptSingle: 3,
};

describe("合計の算出", () => {
  it("合計 = 両面 + 片面", () => {
    expect(dealerReportTotals(BASE)).toEqual({
      lotteryTotal: 50,
      seatedTotal: 18,
      apptTotal: 7,
    });
  });
});

describe("成果数値", () => {
  it("正常な入力は通る", () => {
    const parsed = DealerEventReportCreateSchema.parse(BASE);
    expect(parsed.lotteryBoth).toBe(30);
    expect(parsed.impression).toBeUndefined();
  });

  it("0 以上の整数だけ受け付ける", () => {
    for (const bad of ["-1", "1.5", "abc", ""]) {
      expect(
        DealerEventReportCreateSchema.safeParse({ ...BASE, lotteryBoth: bad }).success,
        `${bad} は弾く`,
      ).toBe(false);
    }
    // 0 は有効な値。ファネルの大小関係に引っかからないよう下位も 0 にして確かめる。
    expect(
      DealerEventReportCreateSchema.safeParse({
        ...BASE,
        lotteryBoth: "0",
        lotterySingle: "0",
        seatedBoth: "0",
        seatedSingle: "0",
        apptBoth: "0",
        apptSingle: "0",
      }).success,
    ).toBe(true);
  });

  it("カインズPay対応数は任意。入力するなら 0 以上の整数", () => {
    expect(DealerEventReportCreateSchema.safeParse(BASE).success).toBe(true);
    expect(DealerEventReportCreateSchema.safeParse({ ...BASE, cainzPayCount: "12" }).success).toBe(
      true,
    );
    expect(DealerEventReportCreateSchema.safeParse({ ...BASE, cainzPayCount: "-3" }).success).toBe(
      false,
    );
  });
});

describe("ファネルの大小関係", () => {
  it("着座数は抽選数以下（合計）", () => {
    const r = DealerEventReportCreateSchema.safeParse({
      ...BASE,
      lotteryBoth: 5,
      lotterySingle: 5,
      seatedBoth: 6,
      seatedSingle: 6,
      apptBoth: 0,
      apptSingle: 0,
    });
    expect(r.success).toBe(false);
  });

  it("両面・片面それぞれでも判定する（合計だけ通る入力を弾く）", () => {
    // 合計は 抽選 20 >= 着座 20 で成立するが、両面だけ見ると 5 < 15 で逆転している。
    const r = DealerEventReportCreateSchema.safeParse({
      ...BASE,
      lotteryBoth: 5,
      lotterySingle: 15,
      seatedBoth: 15,
      seatedSingle: 5,
      apptBoth: 0,
      apptSingle: 0,
    });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(paths).toContain("seatedBoth");
  });

  it("アポ数は着座数以下", () => {
    expect(
      DealerEventReportCreateSchema.safeParse({
        ...BASE,
        apptBoth: 99,
      }).success,
    ).toBe(false);
  });

  it("等しい場合は通る（以下なので）", () => {
    expect(
      DealerEventReportCreateSchema.safeParse({
        ...BASE,
        seatedBoth: 30,
        seatedSingle: 20,
        apptBoth: 30,
        apptSingle: 20,
      }).success,
    ).toBe(true);
  });
});

describe("稼働時間", () => {
  it("終了が開始より前は弾く", () => {
    const r = DealerEventReportCreateSchema.safeParse({
      ...BASE,
      startTime: "18:00",
      endTime: "10:00",
    });
    expect(r.success).toBe(false);
  });

  it("同時刻は通す", () => {
    expect(
      DealerEventReportCreateSchema.safeParse({ ...BASE, startTime: "10:00", endTime: "10:00" })
        .success,
    ).toBe(true);
  });

  it("HH:MM 以外は弾く", () => {
    for (const bad of ["25:00", "9:00", "1000", ""]) {
      expect(
        DealerEventReportCreateSchema.safeParse({ ...BASE, startTime: bad }).success,
        `${bad} は弾く`,
      ).toBe(false);
    }
  });
});

describe("必須項目", () => {
  it("催事場所・施設内エリアは必須", () => {
    expect(DealerEventReportCreateSchema.safeParse({ ...BASE, venuePlace: "" }).success).toBe(
      false,
    );
    expect(DealerEventReportCreateSchema.safeParse({ ...BASE, areaInFacility: "  " }).success).toBe(
      false,
    );
  });
});
