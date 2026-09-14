// アポイントの催事情報の解決規則。
//
// イベント選択時と直接入力時で表示が食い違わないよう、解決は 1 関数に集約している。
// その関数の表をここで固定する。

import { describe, expect, it } from "vitest";

import { boothAreaText, resolveVenueInfo } from "../venue-info.js";

const CUSTOMER_EMPTY = {
  sourceEventDate: null,
  sourceVenuePlace: null,
  sourceVenueChain: null,
  sourceBoothArea: null,
  sourceBoothAreaNote: null,
};

const CUSTOMER_DIRECT = {
  sourceEventDate: new Date("2026-04-01T00:00:00.000Z"),
  sourceVenuePlace: "群馬県 前橋みなみモール店",
  sourceVenueChain: "KOMERI" as const,
  sourceBoothArea: "OTHER" as const,
  sourceBoothAreaNote: "1階エレベーター前",
};

const EVENT = {
  scheduledDate: new Date("2026-05-10T00:00:00.000Z"),
  storeName: "カインズ 浦和美園店",
  venueChain: "CAINZ_V" as const,
  boothArea: "ENTRANCE" as const,
  boothAreaNote: null,
};

describe("resolveVenueInfo", () => {
  it("イベントを選んでいればイベント側を正とする", () => {
    const r = resolveVenueInfo(EVENT, CUSTOMER_EMPTY);
    expect(r.fromEvent).toBe(true);
    expect(r.venuePlace).toBe("カインズ 浦和美園店");
    expect(r.venueChain).toBe("CAINZ_V");
    expect(r.boothArea).toBe("ENTRANCE");
    expect(r.eventDate).toBe("2026-05-10T00:00:00.000Z");
  });

  it("両方に値があってもイベント側が勝つ（重複時の優先順位を固定）", () => {
    const r = resolveVenueInfo(EVENT, CUSTOMER_DIRECT);
    expect(r.fromEvent).toBe(true);
    expect(r.venuePlace).toBe("カインズ 浦和美園店");
    expect(r.venueChain).toBe("CAINZ_V");
  });

  it("イベント未選択なら顧客の source 列から解決する", () => {
    const r = resolveVenueInfo(null, CUSTOMER_DIRECT);
    expect(r.fromEvent).toBe(false);
    expect(r.venuePlace).toBe("群馬県 前橋みなみモール店");
    expect(r.venueChain).toBe("KOMERI");
    expect(r.boothArea).toBe("OTHER");
    expect(r.boothAreaNote).toBe("1階エレベーター前");
  });

  it("どちらも無ければすべて null", () => {
    const r = resolveVenueInfo(null, CUSTOMER_EMPTY);
    expect(r).toEqual({
      eventDate: null,
      venuePlace: null,
      venueChain: null,
      boothArea: null,
      boothAreaNote: null,
      fromEvent: false,
    });
  });

  it("催事実施日は UTC 0 時で往復し、日付がずれない", () => {
    const r = resolveVenueInfo(null, CUSTOMER_DIRECT);
    // フォームへ戻すときは ISO の日付部分をそのまま使う。
    expect(r.eventDate!.slice(0, 10)).toBe("2026-04-01");
  });
});

describe("boothAreaText", () => {
  const LABELS = {
    ENTRANCE: "入口",
    REFORM_CORNER: "リフォームコーナー",
    OTHER: "その他",
  };

  it("既定の選択肢はラベルを出す", () => {
    expect(boothAreaText({ boothArea: "ENTRANCE", boothAreaNote: null }, LABELS)).toBe("入口");
  });

  it("その他のときだけ自由記述を使う", () => {
    expect(boothAreaText({ boothArea: "OTHER", boothAreaNote: "2階催事スペース" }, LABELS)).toBe(
      "2階催事スペース",
    );
  });

  it("その他で自由記述が無ければラベルへ落とす", () => {
    expect(boothAreaText({ boothArea: "OTHER", boothAreaNote: null }, LABELS)).toBe("その他");
  });

  it("その他以外に自由記述が付いていても無視する（表示が二重にならない）", () => {
    expect(boothAreaText({ boothArea: "ENTRANCE", boothAreaNote: "混入した値" }, LABELS)).toBe(
      "入口",
    );
  });

  it("未設定なら null", () => {
    expect(boothAreaText({ boothArea: null, boothAreaNote: null }, LABELS)).toBeNull();
  });
});
