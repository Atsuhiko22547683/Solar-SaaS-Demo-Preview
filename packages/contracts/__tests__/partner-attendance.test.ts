// 催事シフトの出退勤の計算規則。
//
// 勤務時間は「出勤から退勤までの経過時間」で、休憩は控除しない。
// 未出勤・勤務中は 0 時間と決めつけず null にする（画面は「未出勤」「勤務中」と出す）。

import { describe, expect, it } from "vitest";

import {
  attendanceState,
  formatWorkedDuration,
  isClockableToday,
  jstDateKey,
  shiftDateKey,
  workedMinutes,
} from "../src/schemas/partner-attendance.js";

describe("attendanceState", () => {
  it("未出勤 / 勤務中 / 退勤済み を出勤・退勤の有無で決める", () => {
    expect(attendanceState({ startActual: null, endActual: null })).toBe("NOT_CHECKED_IN");
    expect(attendanceState({ startActual: "2026-09-30T01:00:00Z", endActual: null })).toBe(
      "WORKING",
    );
    expect(
      attendanceState({ startActual: "2026-09-30T01:00:00Z", endActual: "2026-09-30T09:00:00Z" }),
    ).toBe("DONE");
  });

  it("退勤だけある行は勤務中として扱わない（出勤が無いので未出勤）", () => {
    expect(attendanceState({ startActual: null, endActual: "2026-09-30T09:00:00Z" })).toBe(
      "NOT_CHECKED_IN",
    );
  });
});

describe("workedMinutes", () => {
  it("出勤から退勤までの経過分（休憩は控除しない）", () => {
    expect(
      workedMinutes({ startActual: "2026-09-30T01:00:00Z", endActual: "2026-09-30T09:30:00Z" }),
    ).toBe(510);
  });

  it("未出勤・勤務中は null（0 分にしない）", () => {
    expect(workedMinutes({ startActual: null, endActual: null })).toBeNull();
    expect(workedMinutes({ startActual: "2026-09-30T01:00:00Z", endActual: null })).toBeNull();
  });

  it("退勤が出勤より前の行は算出しない", () => {
    expect(
      workedMinutes({ startActual: "2026-09-30T09:00:00Z", endActual: "2026-09-30T01:00:00Z" }),
    ).toBeNull();
  });

  it("同時刻は 0 分（打刻はあるので null にしない）", () => {
    expect(
      workedMinutes({ startActual: "2026-09-30T01:00:00Z", endActual: "2026-09-30T01:00:00Z" }),
    ).toBe(0);
  });
});

describe("formatWorkedDuration", () => {
  it.each([
    [510, "8時間30分"],
    [480, "8時間"],
    [45, "45分"],
    [0, "0分"],
  ])("%s 分 → %s", (min, expected) => {
    expect(formatWorkedDuration(min)).toBe(expected);
  });

  it("算出できないときは null（画面側で「未出勤」「勤務中」を出す）", () => {
    expect(formatWorkedDuration(null)).toBeNull();
  });
});

describe("jstDateKey", () => {
  it("日本時間の暦日を返す（環境の時間帯に依らない）", () => {
    // 2026-09-29T15:00Z = 2026-09-30 00:00 JST → 9/30 として扱う。
    expect(jstDateKey(new Date("2026-09-29T15:00:00Z"))).toBe("2026-09-30");
    // 2026-09-29T14:59Z = 2026-09-29 23:59 JST → まだ 9/29。
    expect(jstDateKey(new Date("2026-09-29T14:59:00Z"))).toBe("2026-09-29");
  });
});

describe("shiftDateKey / isClockableToday", () => {
  it("開催日レコードがあれば、その暦日（UTC 0 時保持）で判定する", () => {
    const shift = {
      eventDate: new Date("2026-09-29T00:00:00Z"),
      startPlanned: new Date("2026-09-29T01:00:00Z"),
    };
    expect(shiftDateKey(shift)).toBe("2026-09-29");
    // 日本時間で 9/29 のうちは出勤できる。
    expect(isClockableToday(shift, new Date("2026-09-29T01:00:00Z"))).toBe(true);
    // 日本時間で 9/30 になったら出勤できない。
    expect(isClockableToday(shift, new Date("2026-09-29T15:00:00Z"))).toBe(false);
  });

  it("開催日レコードが無い旧データは予定開始の日本時間の暦日で判定する", () => {
    // 2026-09-29T23:00Z = 9/30 08:00 JST。
    const shift = { eventDate: null, startPlanned: new Date("2026-09-29T23:00:00Z") };
    expect(shiftDateKey(shift)).toBe("2026-09-30");
    expect(isClockableToday(shift, new Date("2026-09-30T02:00:00Z"))).toBe(true);
    expect(isClockableToday(shift, new Date("2026-09-29T02:00:00Z"))).toBe(false);
  });
});
