// 催事シフトの表示（一覧 / カレンダー）。サーバーコンポーネント。
//
// どちらのビューも同じデータから描く。並べ替え UI は持たず、開催日 → 開催開始 → 場所の
// 固定順（listPartnerShiftMonth で決めている）。
//
// カレンダーは横スクロールを起こさないよう 7 列のグリッドで組む。狭い画面では
// セルに「場所 + 人数」だけを出し、日をタップすると一覧側の該当日へ入る。

import { attendanceState, formatWorkedDuration, workedMinutes } from "@solar/contracts";
import Link from "next/link";

import { P_SUB } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";

import type { ShiftEventDayView } from "./data";

const t = labels.partner.shift;
const at = labels.partner.attendance;
const c = labels.partner.common;

/** 役割の表示。旧値は旧ラベルのまま出す（キャッチ / トスへ読み替えない）。 */
export function roleLabel(role: string): string {
  const primary = (t.roles as Record<string, string>)[role];
  if (primary) return primary;
  return (t.rolesLegacy as Record<string, string>)[role] ?? role;
}

/** ISO 日時 → 'HH:MM'（ローカル）。 */
export function hhmm(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function dayLabel(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function ShiftListView({ days }: { days: ShiftEventDayView[] }) {
  if (days.length === 0) {
    return <p className="text-mute-light py-8 text-center text-sm">{t.monthEmpty}</p>;
  }

  // 同じ日の催事はまとめて見出しを 1 つにする。
  const groups = new Map<string, ShiftEventDayView[]>();
  for (const d of days) {
    const list = groups.get(d.date) ?? [];
    list.push(d);
    groups.set(d.date, list);
  }

  return (
    <div className="space-y-5">
      {Array.from(groups.entries()).map(([date, rows]) => {
        const wd = WEEKDAYS[new Date(`${date}T00:00:00`).getDay()] ?? "";
        return (
          <section key={date} aria-label={date}>
            <h3 className="text-ink border-hairline-light mb-2 border-b pb-1 text-sm font-semibold">
              {dayLabel(date)}（{wd}）
            </h3>
            <ul className="space-y-3">
              {rows.map((row) => {
                const start = hhmm(row.startAt);
                const end = hhmm(row.endAt);
                return (
                  <li
                    key={`${row.eventId}-${row.eventDayId ?? row.date}`}
                    className="border-hairline-light rounded-md border p-3"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="text-ink text-sm font-medium">{row.venuePlace}</p>
                      <p className="text-mute-light text-xs tabular-nums">
                        {start && end ? `${start}〜${end}` : t.timeUnknown}
                      </p>
                    </div>
                    <p className={P_SUB}>{row.originName}</p>
                    {/* 日報はこの催事・開催日から入力する（対象を選び直させない）。 */}
                    {row.eventDayId ? (
                      <p className="mt-2">
                        <Link
                          href={`/p-reports/new?eventId=${row.eventId}&eventDayId=${row.eventDayId}`}
                          className="text-primary text-[13px] underline-offset-4 hover:underline"
                        >
                          {t.registerReport}
                        </Link>
                      </p>
                    ) : null}
                    {row.staff.length === 0 ? (
                      <p className="text-mute-light mt-2 text-xs">{t.unassigned}</p>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {row.staff.map((s) => {
                          const ps = hhmm(s.startPlanned);
                          const pe = hhmm(s.endPlanned);
                          const as = hhmm(s.startActual);
                          const ae = hhmm(s.endActual);
                          // 勤務状態と勤務時間。未打刻は「未出勤」で、0 時間にはしない。
                          const state = attendanceState(s);
                          const worked =
                            state === "WORKING"
                              ? at.state.WORKING
                              : formatWorkedDuration(workedMinutes(s));
                          return (
                            <li key={s.shiftId} className="text-body-light text-[13px]">
                              <Link
                                href={`/p-shifts/${s.shiftId}`}
                                className="text-primary underline-offset-4 hover:underline"
                              >
                                {s.userName ?? c.dash}
                              </Link>
                              <span className="text-mute-light ml-2 text-xs">
                                {roleLabel(s.role)}
                              </span>
                              <span className="ml-2 tabular-nums">
                                {t.planned} {ps}〜{pe}
                              </span>
                              {/* 実績は予定と別に出す。予定は上書きしない。 */}
                              <span className="text-mute-light ml-2 text-xs tabular-nums">
                                {as || ae
                                  ? `${t.actual} ${as ?? "—"}〜${ae ?? "—"}`
                                  : t.actualUnset}
                              </span>
                              {/* 勤務状態と勤務時間（休憩は控除しない）。 */}
                              <span className="text-mute-light ml-2 text-xs">
                                {at.state[state]}
                                {worked ? ` · ${at.worked} ${worked}` : ""}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function ShiftCalendarView({
  month,
  days,
  basePath,
  search,
}: {
  month: string;
  days: ShiftEventDayView[];
  basePath: string;
  search: string;
}) {
  const [y, m] = month.split("-").map(Number);
  const year = y ?? new Date().getFullYear();
  const monthIndex = (m ?? 1) - 1;
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leading = firstDay.getDay();

  const byDate = new Map<string, ShiftEventDayView[]>();
  for (const d of days) {
    const list = byDate.get(d.date) ?? [];
    list.push(d);
    byDate.set(d.date, list);
  }

  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) =>
        `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
    ),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* 7 列固定。セル内で折り返すのでページ全体が横へはみ出さない。 */}
      <div className="grid grid-cols-7 gap-px text-center" role="grid" aria-label={t.viewCalendar}>
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-mute-light py-1 text-[11px] font-semibold">
            {w}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} className="min-h-16" />;
          const rows = byDate.get(date) ?? [];
          const staffTotal = rows.reduce((sum, r) => sum + r.staff.length, 0);
          const dayNo = Number(date.split("-")[2]);
          return (
            <Link
              key={date}
              href={`${basePath}?${search}&view=list#${date}`}
              className="border-hairline-light focus-visible:ring-primary/40 hover:bg-surface-soft min-h-16 rounded-sm border p-1 text-left focus:outline-none focus-visible:ring-2"
            >
              <span className="text-ink block text-[11px] tabular-nums">{dayNo}</span>
              {rows.length > 0 ? (
                <>
                  {/* 狭い画面でも読めるよう、先頭の場所だけ出して残りは件数で示す。 */}
                  <span className="text-ink block truncate text-[10px] leading-tight">
                    {rows[0]!.venuePlace}
                  </span>
                  {rows.length > 1 ? (
                    <span className="text-mute-light block text-[10px]">+{rows.length - 1}</span>
                  ) : null}
                  <span className="text-primary block text-[10px] tabular-nums">
                    {staffTotal > 0
                      ? t.staffCount.replace("{n}", String(staffTotal))
                      : t.unassigned}
                  </span>
                </>
              ) : null}
            </Link>
          );
        })}
      </div>
      <p className="text-mute-light mt-3 text-[13px]">{t.viewCalendar}</p>
    </div>
  );
}
