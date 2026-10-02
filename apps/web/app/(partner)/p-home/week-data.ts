// スタッフトップの「当日の催事シフト」と「週間カレンダー」。
//
// 表示の順は 当日（無ければ直近の今後）→ 週間カレンダー。週は月曜始まりで、
// 先週・今週・来週を切り替える。対象は本人（ログイン利用者）の配置だけで、
// 会社全件の確認は /p-shifts（管理者サイト）で行う。
//
// 「この催事からアポイント登録 / 日報入力」へ渡すのは催事 id と開催日 id。
// 店舗名などの文字列は渡さない（同名店舗で別催事の実績に混ざるため）。
//
// 割当は EventShift を見る。EventSalesperson（販売員の配置）は別概念で、
// これが無い割当も消さずに出す（最小デモは EventShift だけを持つ）。

import "server-only";

import { attendanceState, workedMinutes, type AttendanceState } from "@solar/contracts";

import { jstDateKey, shiftDateKey } from "@/lib/partner/attendance";
import { requirePartnerContext, wholesalerNameMap } from "@/lib/partner/context";
import { shiftScope } from "@/lib/partner/scope";
import { withTenant } from "@/lib/tenancy/with-tenant";

export type WeekOffset = -1 | 0 | 1;

export interface MyShiftRow {
  shiftId: string;
  eventId: string;
  eventDayId: string | null;
  /** 勤務の暦日 'YYYY-MM-DD'。 */
  date: string;
  /** 開催場所（店舗名）。 */
  venuePlace: string;
  /** 依頼元代理店。複数代理店から依頼を受けている場合の区別に使う。 */
  originName: string;
  role: string;
  startPlanned: string;
  endPlanned: string;
  /** 出退勤の実績（サーバー時刻で記録したもの）。未打刻は null。 */
  startActual: string | null;
  endActual: string | null;
  /** 勤務状態。未出勤 / 勤務中 / 退勤済み。 */
  state: AttendanceState;
  /** 勤務時間（分）。未出勤・勤務中は null（0 分と決めつけない）。 */
  workedMinutes: number | null;
  /** 今日の割当か（出勤できるのは当日だけ）。 */
  isToday: boolean;
}

export interface HomeWeekData {
  offset: WeekOffset;
  /** 週の範囲（表示用の 'YYYY-MM-DD'）。 */
  from: string;
  to: string;
  /** 週の 7 日ぶんの日付キー（カレンダーの並び）。 */
  days: string[];
  /** その週の本人の割当。 */
  shifts: MyShiftRow[];
  /** 当日の割当（複数可）。無ければ空。 */
  todayShifts: MyShiftRow[];
  /** 当日が無いときに出す、直近の今後の割当。無ければ null。 */
  nextShift: MyShiftRow | null;
  /** 日本時間の今日。 */
  today: string;
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 月曜始まりの週の範囲。 */
export function weekRange(offset: WeekOffset, now = new Date()): { start: Date; end: Date } {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // getDay(): 0=日 … 6=土。月曜を週頭にする。
  const mondayDelta = (base.getDay() + 6) % 7;
  const start = new Date(base);
  start.setDate(base.getDate() - mondayDelta + offset * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

export function parseWeekOffset(raw: string | undefined): WeekOffset {
  if (raw === "prev") return -1;
  if (raw === "next") return 1;
  return 0;
}

/** 本人の割当を読むときの select。当日欄・週欄・直近欄で同じ形にする。 */
const SHIFT_SELECT = {
  id: true,
  eventDayId: true,
  role: true,
  startPlanned: true,
  endPlanned: true,
  startActual: true,
  endActual: true,
  eventDay: { select: { eventDate: true } },
  event: {
    select: {
      id: true,
      eventCandidate: { select: { storeName: true } },
      dealers: {
        where: {} as Record<string, never>,
        select: { relationshipId: true },
      },
    },
  },
} as const;

type ShiftRecord = {
  id: string;
  eventDayId: string | null;
  role: string;
  startPlanned: Date;
  endPlanned: Date;
  startActual: Date | null;
  endActual: Date | null;
  eventDay: { eventDate: Date } | null;
  event: {
    id: string;
    eventCandidate: { storeName: string };
    dealers: { relationshipId: string }[];
  };
};

function toRow(s: ShiftRecord, originNames: Map<string, string>, today: string): MyShiftRow {
  const date = shiftDateKey({
    eventDate: s.eventDay?.eventDate ?? null,
    startPlanned: s.startPlanned,
  });
  return {
    shiftId: s.id,
    eventId: s.event.id,
    eventDayId: s.eventDayId,
    date,
    venuePlace: s.event.eventCandidate.storeName,
    originName: originNames.get(s.event.dealers[0]?.relationshipId ?? "") ?? "—",
    role: s.role,
    startPlanned: s.startPlanned.toISOString(),
    endPlanned: s.endPlanned.toISOString(),
    startActual: s.startActual?.toISOString() ?? null,
    endActual: s.endActual?.toISOString() ?? null,
    state: attendanceState(s),
    workedMinutes: workedMinutes(s),
    isToday: date === today,
  };
}

export async function getHomeWeek(offset: WeekOffset): Promise<HomeWeekData> {
  const partner = await requirePartnerContext("partner_shift.read");
  const { start, end } = weekRange(offset);
  const originNames = wholesalerNameMap(partner);
  const today = jstDateKey();

  return withTenant(partner.ctx, async (tx) => {
    const mine = { ...shiftScope(partner), userId: partner.userId };
    const select = {
      ...SHIFT_SELECT,
      event: {
        select: {
          ...SHIFT_SELECT.event.select,
          dealers: {
            where: { relationshipId: { in: partner.relationshipIds } },
            select: { relationshipId: true },
          },
        },
      },
    };

    const [weekRows, todayRows, upcoming] = await Promise.all([
      // その週の割当。
      tx.eventShift.findMany({
        where: { ...mine, startPlanned: { gte: start, lt: end } },
        orderBy: { startPlanned: "asc" },
        select,
      }),
      // 当日の割当。週の切替とは独立に、常に今日を出す。
      tx.eventShift.findMany({
        where: { ...mine, eventDay: { eventDate: new Date(`${today}T00:00:00.000Z`) } },
        orderBy: { startPlanned: "asc" },
        select,
      }),
      // 直近の今後の割当（当日が無いときの代わり）。
      tx.eventShift.findMany({
        where: { ...mine, startPlanned: { gte: new Date() } },
        orderBy: { startPlanned: "asc" },
        take: 1,
        select,
      }),
    ]);

    const todayShifts = todayRows.map((s) => toRow(s as ShiftRecord, originNames, today));
    const nextShift =
      todayShifts.length > 0
        ? null
        : (upcoming.map((s) => toRow(s as ShiftRecord, originNames, today))[0] ?? null);

    return {
      offset,
      from: localDateKey(start),
      to: localDateKey(new Date(end.getTime() - 86_400_000)),
      days: Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return localDateKey(d);
      }),
      shifts: weekRows.map((s) => toRow(s as ShiftRecord, originNames, today)),
      todayShifts,
      nextShift,
      today,
    };
  });
}
