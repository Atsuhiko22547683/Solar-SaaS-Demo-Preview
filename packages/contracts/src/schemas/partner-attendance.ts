// 催事シフトの出退勤（本人の打刻）。
//
// 保存先は既存の EventShift（startActual / endActual / status）。新しい勤怠テーブルは
// 作らない。打刻の時刻はサーバー側で決めるので、入力はどのシフトかだけ。
//
// 勤務時間は「出勤から退勤までの経過時間」。休憩は控除しない（休憩管理は持たない）。

import { z } from "zod";

/** 打刻の対象。時刻は受け取らない（サーバー時刻で記録する）。 */
export const PartnerAttendancePunchSchema = z.object({
  shiftId: z.string().min(1, "対象のシフトが指定されていません"),
});
export type PartnerAttendancePunchInput = z.input<typeof PartnerAttendancePunchSchema>;

/** 勤務状態。EventShift.status から画面表示用に導く。 */
export type AttendanceState = "NOT_CHECKED_IN" | "WORKING" | "DONE";

export function attendanceState(shift: {
  startActual: Date | string | null;
  endActual: Date | string | null;
}): AttendanceState {
  if (!shift.startActual) return "NOT_CHECKED_IN";
  return shift.endActual ? "DONE" : "WORKING";
}

/**
 * 勤務時間（分）。出勤から退勤までの経過時間で、休憩は控除しない。
 *
 * 未出勤・勤務中は null（0 分と決めつけない）。
 * 退勤が出勤より前になっている行は、実態が分からないので null を返す。
 */
export function workedMinutes(shift: {
  startActual: Date | string | null;
  endActual: Date | string | null;
}): number | null {
  if (!shift.startActual || !shift.endActual) return null;
  const start = new Date(shift.startActual).getTime();
  const end = new Date(shift.endActual).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (end < start) return null;
  return Math.floor((end - start) / 60_000);
}

/** 勤務時間の表示（"7時間30分"）。0 分は "0分"、算出できないときは null。 */
export function formatWorkedDuration(minutes: number | null): string | null {
  if (minutes === null) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

/**
 * 日本時間の暦日キー（'YYYY-MM-DD'）。
 *
 * 出勤できるのは「割当の開催日当日」。サーバーの時間帯に依らず日本時間で判定する。
 */
export function jstDateKey(at: Date = new Date()): string {
  // UTC+9 にずらしてから UTC の年月日を読む（環境の時間帯設定に依存しない）。
  const shifted = new Date(at.getTime() + 9 * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

/**
 * 出勤できるか（開催日当日かどうか）。
 *
 * 開催日は暦日として UTC 0 時で保持しているので UTC で読む。開催日レコードが無い
 * 旧データは、予定開始時刻の日本時間の暦日で判定する。
 */
export function isClockableToday(
  target: { eventDate: Date | string | null; startPlanned: Date | string },
  now: Date = new Date(),
): boolean {
  return shiftDateKey(target) === jstDateKey(now);
}

/** そのシフトが「どの暦日の勤務か」。 */
export function shiftDateKey(target: {
  eventDate: Date | string | null;
  startPlanned: Date | string;
}): string {
  if (target.eventDate) {
    const d = new Date(target.eventDate);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  return jstDateKey(new Date(target.startPlanned));
}
