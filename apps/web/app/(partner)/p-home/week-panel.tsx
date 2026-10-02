// スタッフトップの「当日の催事シフト」と「週間カレンダー」。サーバーコンポーネント。
//
// 並びは 当日（無ければ直近の今後）→ 週間カレンダー。上部ナビと重なる業務カードは置かない。
// 催事に対する操作（出退勤・アポ登録・日報入力）は業務操作としてシフト欄に残す。
//
// リンクには催事 id と開催日 id を載せる（店舗名の文字列では結ばない）。
// 曜日の色・週の計算は代理店の週次カレンダーと同じ共有モジュールを使う。

import { formatWorkedDuration } from "@solar/contracts";
import Link from "next/link";

import { AttendanceButtons } from "@/components/partner/attendance-buttons";
import { PartnerCard, PartnerSection } from "@/components/partner/partner-ui";
import { formatShortDay, weekdayTextClass } from "@/lib/format/week";
import { labels } from "@/lib/i18n/labels";

import { roleLabel } from "../p-shifts/shift-views";

import type { HomeWeekData, MyShiftRow } from "./week-data";

const t = labels.partner.home.week;
const at = labels.partner.attendance;
const c = labels.partner.common;

function hhmm(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 勤務状態のバッジ。未出勤を 0 時間扱いにしない。 */
function StateBadge({ row }: { row: MyShiftRow }) {
  const tone =
    row.state === "WORKING"
      ? "bg-primary/10 text-primary"
      : row.state === "DONE"
        ? "bg-surface-soft text-mute-light"
        : "border-hairline-light text-mute-light border";
  return (
    <span className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[11px] ${tone}`}>
      {at.state[row.state]}
    </span>
  );
}

/** 出退勤の実績と勤務時間。休憩を控除しないことを添える。 */
function WorkedLine({ row }: { row: MyShiftRow }) {
  const inAt = hhmm(row.startActual);
  const outAt = hhmm(row.endActual);
  if (!inAt) return null;
  return (
    <p className="text-body-light text-xs tabular-nums">
      {at.clockedInAt} {inAt}
      {outAt ? ` / ${at.clockedOutAt} ${outAt}` : ""}
      {" · "}
      {at.worked} {/* 退勤前は時間を確定させず「勤務中」と出す（0 時間と決めつけない）。 */}
      {row.state === "WORKING"
        ? at.state.WORKING
        : (formatWorkedDuration(row.workedMinutes) ?? c.dash)}
      <span className="text-mute-light">（{at.workedNote}）</span>
    </p>
  );
}

/** 催事 1 件ぶんの業務操作。出勤前はアポ登録・日報入力を出さない。 */
function ShiftActions({ row }: { row: MyShiftRow }) {
  const dayQuery = row.eventDayId ? `&eventDayId=${row.eventDayId}` : "";
  const linkClass =
    "border-hairline-light text-ink hover:bg-surface-soft focus-visible:ring-primary/40 inline-flex h-11 items-center justify-center rounded-md border px-4 text-sm focus:outline-none focus-visible:ring-2 sm:h-9";
  const checkedIn = row.state !== "NOT_CHECKED_IN";
  return (
    <div className="mt-3 space-y-2">
      <AttendanceButtons shiftId={row.shiftId} state={row.state} canClock={row.isToday} />
      {checkedIn ? (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/p-appointments/new?eventId=${row.eventId}${dayQuery}`}
            className={linkClass}
          >
            {t.registerAppointment}
          </Link>
          <Link href={`/p-reports/new?eventId=${row.eventId}${dayQuery}`} className={linkClass}>
            {t.registerReport}
          </Link>
        </div>
      ) : null}
      <p>
        <Link
          href={`/p-shifts/${row.shiftId}`}
          className="text-primary text-[13px] underline-offset-4 hover:underline"
        >
          {t.openShiftDetail}
        </Link>
      </p>
    </div>
  );
}

/** 当日・直近の 1 件。場所・時間・勤務状態を必ず出す。 */
function ShiftCard({ row, withActions }: { row: MyShiftRow; withActions: boolean }) {
  return (
    <li className="border-hairline-light rounded-md border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-ink text-sm font-semibold">{row.venuePlace}</p>
        <StateBadge row={row} />
      </div>
      <p className="text-body-light mt-0.5 text-xs tabular-nums">
        {formatShortDay(row.date)} {hhmm(row.startPlanned)}〜{hhmm(row.endPlanned)}
        <span className="text-mute-light"> · {roleLabel(row.role)}</span>
      </p>
      <p className="text-mute-light text-xs">{row.originName}</p>
      <WorkedLine row={row} />
      {withActions ? <ShiftActions row={row} /> : null}
    </li>
  );
}

export function HomeWeekPanel({ data }: { data: HomeWeekData }) {
  const navClass =
    "border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 items-center justify-center rounded-md border px-3 text-sm sm:h-9";
  const activeClass =
    "bg-primary inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-white sm:h-9";

  // 週の各日に本人の割当を割り振る（件数だけにしない）。
  const byDate = new Map<string, MyShiftRow[]>();
  for (const s of data.shifts) {
    byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  }

  return (
    <div className="mb-6 space-y-5">
      {/* 1. 当日の催事シフト（無ければ直近の今後） */}
      <PartnerCard>
        <PartnerSection title={data.todayShifts.length > 0 ? t.todayTitle : t.nextTitle}>
          {data.todayShifts.length > 0 ? (
            <ul className="space-y-3">
              {data.todayShifts.map((row) => (
                <ShiftCard key={row.shiftId} row={row} withActions />
              ))}
            </ul>
          ) : data.nextShift ? (
            <>
              <p className="text-mute-light mb-2 text-[13px]">{t.noTodayHint}</p>
              <ul className="space-y-3">
                <ShiftCard row={data.nextShift} withActions />
              </ul>
            </>
          ) : (
            <p className="text-mute-light text-[13px]">{t.emptyUpcoming}</p>
          )}
        </PartnerSection>
      </PartnerCard>

      {/* 2. 週間カレンダー */}
      <PartnerCard>
        <PartnerSection title={`${t.title}（${data.from} 〜 ${data.to}）`}>
          <div className="mb-3 flex flex-wrap gap-2">
            <Link
              href="/p-home?week=prev"
              aria-current={data.offset === -1 ? "page" : undefined}
              className={data.offset === -1 ? activeClass : navClass}
            >
              {t.prev}
            </Link>
            <Link
              href="/p-home"
              aria-current={data.offset === 0 ? "page" : undefined}
              className={data.offset === 0 ? activeClass : navClass}
            >
              {t.current}
            </Link>
            <Link
              href="/p-home?week=next"
              aria-current={data.offset === 1 ? "page" : undefined}
              className={data.offset === 1 ? activeClass : navClass}
            >
              {t.next}
            </Link>
          </div>

          {/* 390px は 1 列（日付ごとの縦並び）、広い画面は 7 列。
              どちらでも場所と予定時間を必ず出す（件数だけにしない）。 */}
          <ul className="divide-hairline-light border-hairline-light divide-y rounded-md border lg:grid lg:grid-cols-7 lg:divide-x lg:divide-y-0">
            {data.days.map((day) => {
              const rows = byDate.get(day) ?? [];
              const isToday = day === data.today;
              return (
                <li
                  key={day}
                  className={`p-2 ${isToday ? "bg-primary/5" : ""}`}
                  aria-current={isToday ? "date" : undefined}
                >
                  <p
                    className={`border-hairline-light mb-1.5 border-b pb-1 text-xs font-semibold ${weekdayTextClass(day)}`}
                  >
                    {formatShortDay(day)}
                  </p>
                  {rows.length === 0 ? (
                    <p className="text-mute-light text-[11px]">{c.dash}</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {rows.map((row) => (
                        <li key={row.shiftId}>
                          <Link
                            href={`/p-shifts/${row.shiftId}`}
                            className="hover:bg-surface-soft focus-visible:ring-primary/40 block rounded px-1 py-0.5 focus:outline-none focus-visible:ring-2"
                          >
                            <span className="text-ink block text-xs font-medium">
                              {row.venuePlace}
                            </span>
                            <span className="text-body-light block text-[11px] tabular-nums">
                              {hhmm(row.startPlanned)}〜{hhmm(row.endPlanned)}
                            </span>
                            <StateBadge row={row} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </PartnerSection>
      </PartnerCard>
    </div>
  );
}
