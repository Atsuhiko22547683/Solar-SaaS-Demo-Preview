// 一覧共通の URL クエリ解釈と並べ替え規約。
//
// 許可リスト外の並べ替え・不正な範囲・日付境界・未設定値の扱いを表として固定する。

import { describe, expect, it } from "vitest";

import {
  comparator,
  dateOnlyBounds,
  dateRange,
  dateTimeBounds,
  numberRange,
  oneOf,
  page,
  paginate,
  sort,
  sortHref,
  withParams,
} from "../list-query.js";

describe("sort（許可リスト）", () => {
  const allowed = ["name", "createdAt"] as const;
  const fallback = { field: "createdAt" as const, direction: "desc" as const };

  it("許可された列と方向を受け付ける", () => {
    expect(sort({ sort: "name", dir: "asc" }, allowed, fallback)).toEqual({
      field: "name",
      direction: "asc",
    });
  });

  it("許可リスト外の列名（任意の DB 列名）は既定へ倒す", () => {
    expect(sort({ sort: "purchasePrice", dir: "asc" }, allowed, fallback)).toEqual(fallback);
    expect(sort({ sort: "id; drop table", dir: "asc" }, allowed, fallback)).toEqual(fallback);
  });

  it("方向が不正なら既定列は既定方向、それ以外は昇順", () => {
    expect(sort({ sort: "createdAt", dir: "x" }, allowed, fallback)).toEqual(fallback);
    expect(sort({ sort: "name", dir: "x" }, allowed, fallback)).toEqual({
      field: "name",
      direction: "asc",
    });
  });
});

describe("oneOf / page", () => {
  it("候補に無い値は「すべて」（undefined）", () => {
    expect(oneOf({ k: "B" }, "k", ["A", "B"] as const)).toBe("B");
    expect(oneOf({ k: "Z" }, "k", ["A", "B"] as const)).toBeUndefined();
  });
  it("ページ番号は 1 以上の整数だけ", () => {
    expect(page({ page: "3" })).toBe(3);
    expect(page({ page: "0" })).toBe(1);
    expect(page({ page: "abc" })).toBe(1);
    expect(page({})).toBe(1);
  });
});

describe("dateRange", () => {
  it("開始 > 終了はエラーにして条件を適用しない", () => {
    const errors: string[] = [];
    const r = dateRange({ f: "2026-05-10", t: "2026-05-01" }, "f", "t", "期間", errors);
    expect(r).toEqual({});
    expect(errors[0]).toContain("開始日が終了日より後");
  });
  it("形式不正はエラー", () => {
    const errors: string[] = [];
    dateRange({ f: "2026/05/01" }, "f", "t", "期間", errors);
    expect(errors).toHaveLength(1);
  });
  it("存在しない日付（2 月 30 日）はエラー", () => {
    const errors: string[] = [];
    dateRange({ f: "2026-02-30" }, "f", "t", "期間", errors);
    expect(errors).toHaveLength(1);
  });
  it("片側だけでも受け付ける", () => {
    const errors: string[] = [];
    expect(dateRange({ t: "2026-05-01" }, "f", "t", "期間", errors)).toEqual({
      from: undefined,
      to: "2026-05-01",
    });
    expect(errors).toHaveLength(0);
  });
});

describe("日付境界", () => {
  it("日付のみ列は UTC 0 時〜同日 23:59:59.999（終了日当日を含む）", () => {
    const b = dateOnlyBounds({ from: "2026-04-01", to: "2026-04-30" });
    expect(b.gte?.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(b.lte?.toISOString()).toBe("2026-04-30T23:59:59.999Z");
  });
  it("日時列は JST の日付境界で切る", () => {
    const b = dateTimeBounds({ from: "2026-04-01", to: "2026-04-01" });
    // JST 4/1 00:00 = UTC 3/31 15:00
    expect(b.gte?.toISOString()).toBe("2026-03-31T15:00:00.000Z");
    expect(b.lte?.toISOString()).toBe("2026-04-01T14:59:59.999Z");
  });
});

describe("numberRange", () => {
  it("カンマ・¥ を含む文字列も数値として扱う", () => {
    const errors: string[] = [];
    expect(numberRange({ a: "¥1,000", b: "2,500" }, "a", "b", "価格", errors)).toEqual({
      min: 1000,
      max: 2500,
    });
    expect(errors).toHaveLength(0);
  });
  it("下限 > 上限はエラー", () => {
    const errors: string[] = [];
    expect(numberRange({ a: "10", b: "5" }, "a", "b", "価格", errors)).toEqual({});
    expect(errors[0]).toContain("下限が上限より大きく");
  });
  it("数値でない入力はエラー", () => {
    const errors: string[] = [];
    numberRange({ a: "abc" }, "a", "b", "価格", errors);
    expect(errors).toHaveLength(1);
  });
});

describe("comparator（メモリ上の並べ替え）", () => {
  type Row = { id: string; v: string | number | null };
  const rows: Row[] = [
    { id: "b", v: null },
    { id: "a", v: 2 },
    { id: "c", v: 1 },
    { id: "d", v: 2 },
    { id: "e", v: null },
  ];
  it("未設定値は昇順・降順とも末尾、同値は id で安定", () => {
    const asc = [...rows].sort(comparator((r) => r.v, "asc")).map((r) => r.id);
    expect(asc).toEqual(["c", "a", "d", "b", "e"]);
    const desc = [...rows].sort(comparator((r) => r.v, "desc")).map((r) => r.id);
    expect(desc).toEqual(["a", "d", "c", "b", "e"]);
  });
  it("文字列は日本語ロケールで比較する", () => {
    const names: Row[] = [
      { id: "1", v: "い" },
      { id: "2", v: "あ" },
      { id: "3", v: "う" },
    ];
    expect(names.sort(comparator((r) => r.v, "asc")).map((r) => r.v)).toEqual(["あ", "い", "う"]);
  });
});

describe("paginate / URL", () => {
  it("範囲外のページは最終ページへ寄せる", () => {
    const r = paginate([1, 2, 3], 9, 2);
    expect(r).toEqual({ rows: [3], total: 3, page: 2, pageCount: 2 });
  });
  it("並べ替えリンクは同じ列なら方向を反転し、ページを先頭へ戻す", () => {
    const href = sortHref(
      "/p-x",
      { q: "abc", sort: "name", dir: "asc", page: "3" },
      { field: "name", direction: "asc" },
      "name",
    );
    expect(href).toBe("/p-x?q=abc&sort=name&dir=desc");
  });
  it("別の列へ切り替えると昇順から", () => {
    const href = sortHref(
      "/p-x",
      { sort: "name", dir: "desc" },
      { field: "name", direction: "desc" },
      "createdAt",
    );
    expect(href).toBe("/p-x?sort=createdAt&dir=asc");
  });
  it("withParams は空値のキーを落とす", () => {
    expect(withParams("/p-x", { a: "1", b: "" }, { c: undefined, d: 2 })).toBe("/p-x?a=1&d=2");
  });
});
