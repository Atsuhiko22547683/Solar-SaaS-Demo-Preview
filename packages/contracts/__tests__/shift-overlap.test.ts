// シフトの時間帯重複判定（純関数）の検証。
//
// 業務要件の確認項目:
//   ③ 同じスタッフを時間が重複する催事へ配置できない
//   ④ 複数日催事の一部の日程だけに重複がある場合も正しく検出できる
//   「現在編集中の自分自身の割当は、重複相手として扱わない」

import { describe, expect, it } from "vitest";

import {
  findBulkShiftConflicts,
  findShiftConflicts,
  intervalsOverlap,
  isValidInterval,
} from "../src/services/shift-overlap.js";

const d = (iso: string): Date => new Date(iso);

describe("intervalsOverlap", () => {
  it("重なっている区間を検出する", () => {
    expect(
      intervalsOverlap(
        d("2026-07-04T10:00:00"),
        d("2026-07-04T18:00:00"),
        d("2026-07-04T17:00:00"),
        d("2026-07-04T20:00:00"),
      ),
    ).toBe(true);
  });

  it("隣接（前の終了 = 次の開始）は重複にしない", () => {
    expect(
      intervalsOverlap(
        d("2026-07-04T10:00:00"),
        d("2026-07-04T18:00:00"),
        d("2026-07-04T18:00:00"),
        d("2026-07-04T21:00:00"),
      ),
    ).toBe(false);
  });

  it("日をまたいで離れていれば重複しない", () => {
    expect(
      intervalsOverlap(
        d("2026-07-04T10:00:00"),
        d("2026-07-04T18:00:00"),
        d("2026-07-05T10:00:00"),
        d("2026-07-05T18:00:00"),
      ),
    ).toBe(false);
  });
});

describe("isValidInterval", () => {
  it("開始と終了が同じ、または逆転しているものは不正", () => {
    expect(isValidInterval(d("2026-07-04T10:00:00"), d("2026-07-04T10:00:00"))).toBe(false);
    expect(isValidInterval(d("2026-07-04T18:00:00"), d("2026-07-04T10:00:00"))).toBe(false);
    expect(isValidInterval(d("2026-07-04T10:00:00"), d("2026-07-04T18:00:00"))).toBe(true);
  });
});

describe("findShiftConflicts", () => {
  const existing = [
    {
      id: "s1",
      userId: "u1",
      start: d("2026-07-04T10:00:00"),
      end: d("2026-07-04T18:00:00"),
    },
    {
      id: "s2",
      userId: "u2",
      start: d("2026-07-04T10:00:00"),
      end: d("2026-07-04T18:00:00"),
    },
  ];

  it("同じスタッフの重なる区間だけを相手にする", () => {
    const hit = findShiftConflicts({
      candidate: { userId: "u1", start: d("2026-07-04T17:00:00"), end: d("2026-07-04T20:00:00") },
      existing,
    });
    expect(hit.map((h) => h.id)).toEqual(["s1"]);
  });

  it("別のスタッフの同時刻は重複にしない", () => {
    const hit = findShiftConflicts({
      candidate: { userId: "u3", start: d("2026-07-04T10:00:00"), end: d("2026-07-04T18:00:00") },
      existing,
    });
    expect(hit).toEqual([]);
  });

  it("編集中の行そのものは重複相手にしない", () => {
    const hit = findShiftConflicts({
      candidate: {
        id: "s1",
        userId: "u1",
        start: d("2026-07-04T11:00:00"),
        end: d("2026-07-04T17:00:00"),
      },
      existing,
      ignoreShiftId: "s1",
    });
    expect(hit).toEqual([]);
  });

  it("別の依頼元代理店の催事でも、同じスタッフなら重複になる", () => {
    // EventShift は代理店で分割されないので、相手が別代理店の催事でも判定は同じ。
    const hit = findShiftConflicts({
      candidate: { userId: "u1", start: d("2026-07-04T09:00:00"), end: d("2026-07-04T12:00:00") },
      existing,
    });
    expect(hit).toHaveLength(1);
  });
});

describe("findBulkShiftConflicts", () => {
  it("複数日催事のうち、重なる日だけを検出する", () => {
    // 既存: 7/24 の 10:00-18:00 に配置済み。
    const existing = [
      { id: "s1", userId: "u1", start: d("2026-07-24T10:00:00"), end: d("2026-07-24T18:00:00") },
    ];
    // 候補: 7/24 と 7/25 の 2 日ぶん。初日だけ重なる。
    const candidates = [
      { userId: "u1", start: d("2026-07-24T10:00:00"), end: d("2026-07-24T18:00:00") },
      { userId: "u1", start: d("2026-07-25T10:00:00"), end: d("2026-07-25T18:00:00") },
    ];
    const conflicts = findBulkShiftConflicts(candidates, existing);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.index).toBe(0);
  });

  it("開催期間をまたいで連続勤務として扱わない（夜間は空く）", () => {
    // 7/24 18:00 に終わり 7/25 10:00 に始まるので、間の夜間は重複判定に入らない。
    const existing = [
      { id: "s1", userId: "u1", start: d("2026-07-24T19:00:00"), end: d("2026-07-24T22:00:00") },
    ];
    const candidates = [
      { userId: "u1", start: d("2026-07-24T10:00:00"), end: d("2026-07-24T18:00:00") },
      { userId: "u1", start: d("2026-07-25T10:00:00"), end: d("2026-07-25T18:00:00") },
    ];
    expect(findBulkShiftConflicts(candidates, existing)).toEqual([]);
  });

  it("同じ操作の中で作る区間同士の重複も見る", () => {
    // 同じスタッフを同時刻の 2 催事へ一括で入れようとした場合。
    const candidates = [
      { userId: "u1", start: d("2026-07-24T10:00:00"), end: d("2026-07-24T18:00:00") },
      { userId: "u1", start: d("2026-07-24T11:00:00"), end: d("2026-07-24T19:00:00") },
    ];
    const conflicts = findBulkShiftConflicts(candidates, []);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.index).toBe(1);
  });
});
