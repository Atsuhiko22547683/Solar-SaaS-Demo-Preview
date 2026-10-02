// 催事シフトの出退勤（本人の打刻）と、それを前提にする入力の条件。
//
// 保存先は既存の EventShift（startActual / endActual / status）。新しい勤怠テーブルは
// 作らない。誰の・どの割当の・どの催事の・どの開催日の勤務かは EventShift が持つ。
//
// 決め事:
//   - 出勤できるのは「割当の開催日当日（日本時間）」の、本人の割当だけ
//   - 時刻はサーバー時刻で記録する。予定時間（startPlanned / endPlanned）は変えない
//   - 二重打刻は作らない（出勤済みなら出勤を受け付けない・未出勤の退勤は拒否）
//   - 催事に紐づくアポ登録・日報入力は「出勤済み」を条件にする。退勤後も出せる
//   - 催事と関係のない入力（訪問アポ報告など）にはこの条件を広げない

import "server-only";

import {
  attendanceState,
  isClockableToday,
  jstDateKey,
  shiftDateKey,
  workedMinutes,
  type AttendanceState,
} from "@solar/contracts";

import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { labels } from "@/lib/i18n/labels";
import { shiftScope } from "@/lib/partner/scope";

import type { PartnerContext } from "@/lib/partner/context";
import type { TxClient } from "@solar/db";

const t = labels.partner.attendance;

export { attendanceState, jstDateKey, shiftDateKey, workedMinutes };
export type { AttendanceState };

/** 打刻の対象として取り出した本人のシフト。 */
interface PunchTarget {
  id: string;
  eventId: string;
  eventDayId: string | null;
  startActual: Date | null;
  endActual: Date | null;
  startPlanned: Date;
  eventDate: Date | null;
}

/**
 * 本人の割当を取り出す。
 *
 * `userId` を where に入れるので、他人の割当の id を送っても見つからない
 * （画面にボタンが出ているかどうかとは無関係に成立させる）。
 */
async function findOwnShift(
  tx: TxClient,
  partner: PartnerContext,
  shiftId: string,
): Promise<PunchTarget> {
  const row = await tx.eventShift.findFirst({
    where: { id: shiftId, userId: partner.userId, ...shiftScope(partner) },
    select: {
      id: true,
      eventId: true,
      eventDayId: true,
      startActual: true,
      endActual: true,
      startPlanned: true,
      eventDay: { select: { eventDate: true } },
    },
  });
  if (!row) throw new NotFoundError(t.errors.notYourShift);
  return {
    id: row.id,
    eventId: row.eventId,
    eventDayId: row.eventDayId,
    startActual: row.startActual,
    endActual: row.endActual,
    startPlanned: row.startPlanned,
    eventDate: row.eventDay?.eventDate ?? null,
  };
}

/**
 * 出勤。開催日当日の本人の割当にだけ、サーバー時刻で記録する。
 *
 * 既に出勤済みなら何も書かない（連打・再送で時刻が動かないようにする）。
 * 書き込みは `startActual: null` を条件にした updateMany なので、同時送信でも
 * 後から来た方の更新件数が 0 になり、記録はひとつだけ残る。
 */
export async function clockIn(
  tx: TxClient,
  partner: PartnerContext,
  shiftId: string,
  now: Date = new Date(),
): Promise<{ shiftId: string; startActual: Date; alreadyDone: boolean }> {
  const shift = await findOwnShift(tx, partner, shiftId);

  if (!isClockableToday(shift, now)) {
    throw new ValidationError(t.errors.notToday, { field: "shiftId" });
  }
  if (shift.startActual) {
    // 既に出勤済み。時刻は上書きしない。
    return { shiftId: shift.id, startActual: shift.startActual, alreadyDone: true };
  }

  const res = await tx.eventShift.updateMany({
    where: { id: shift.id, userId: partner.userId, startActual: null },
    data: { startActual: now, status: "CHECKED_IN" },
  });
  if (res.count === 0) {
    // 同時送信で他方が先に入った。既存の時刻をそのまま返す。
    const again = await findOwnShift(tx, partner, shiftId);
    if (!again.startActual) throw new ValidationError(t.errors.clockInFailed, { field: "shiftId" });
    return { shiftId: again.id, startActual: again.startActual, alreadyDone: true };
  }
  return { shiftId: shift.id, startActual: now, alreadyDone: false };
}

/**
 * 退勤。出勤済みで未退勤のときだけ、サーバー時刻で記録する。
 *
 * 未出勤での退勤は拒否する。退勤済みなら時刻を上書きしない。
 */
export async function clockOut(
  tx: TxClient,
  partner: PartnerContext,
  shiftId: string,
  now: Date = new Date(),
): Promise<{ shiftId: string; endActual: Date; alreadyDone: boolean }> {
  const shift = await findOwnShift(tx, partner, shiftId);

  if (!shift.startActual) {
    throw new ValidationError(t.errors.notCheckedIn, { field: "shiftId" });
  }
  if (shift.endActual) {
    return { shiftId: shift.id, endActual: shift.endActual, alreadyDone: true };
  }
  if (now.getTime() < shift.startActual.getTime()) {
    // サーバー時刻が出勤より前になることは通常ないが、負の勤務時間は作らない。
    throw new ValidationError(t.errors.clockOutBeforeIn, { field: "shiftId" });
  }

  const res = await tx.eventShift.updateMany({
    where: { id: shift.id, userId: partner.userId, startActual: { not: null }, endActual: null },
    data: { endActual: now, status: "CHECKED_OUT" },
  });
  if (res.count === 0) {
    const again = await findOwnShift(tx, partner, shiftId);
    if (!again.endActual) throw new ValidationError(t.errors.clockOutFailed, { field: "shiftId" });
    return { shiftId: again.id, endActual: again.endActual, alreadyDone: true };
  }
  return { shiftId: shift.id, endActual: now, alreadyDone: false };
}

/**
 * 「その催事・開催日に出勤済みか」を確かめる。
 *
 * 催事アポ登録・催事日報入力の入口条件。ボタンを出さないだけでなく、URL 直打ちや
 * Server Action への直接送信でもここで止める。
 * 退勤後も通す（その日の記録を後から出せるようにする）。
 */
export async function assertCheckedInForEvent(
  tx: TxClient,
  partner: PartnerContext,
  eventId: string,
  eventDayId: string | null,
): Promise<void> {
  const shift = await tx.eventShift.findFirst({
    where: {
      userId: partner.userId,
      eventId,
      // 開催日の指定があればその日の割当に限る。旧データ（開催日なし）は催事単位で見る。
      ...(eventDayId ? { OR: [{ eventDayId }, { eventDayId: null }] } : {}),
      startActual: { not: null },
      ...shiftScope(partner),
    },
    select: { id: true },
  });
  if (!shift) throw new ForbiddenError(t.errors.needCheckIn);
}
