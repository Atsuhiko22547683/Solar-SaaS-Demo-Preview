"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatMonthDayWithWeekday } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import type { DaySummary } from "./unified-data";

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalDate(s: string): Date {
  const parts = s.split("-").map(Number);
  return new Date(parts[0]!, parts[1]! - 1, parts[2]!);
}

function formatDayHeader(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return formatMonthDayWithWeekday(d);
}

function formatRangeLabel(start: string, end: string): string {
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  return `${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日(${DAY_LABELS[s.getDay()]}) 〜 ${e.getMonth() + 1}月${e.getDate()}日(${DAY_LABELS[e.getDay()]})`;
}

function shiftWeek(weekStart: string, delta: number): string {
  const d = parseLocalDate(weekStart);
  d.setDate(d.getDate() + 7 * delta);
  return localDateStr(d);
}

function todayMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return localDateStr(new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff));
}

function cellBg(day: DaySummary, isSelected: boolean): string {
  if (isSelected) return "bg-primary/5 ring-1 ring-primary/30 ring-inset";
  if (day.isHoliday || day.dayOfWeek === 0) return "bg-red-50";
  if (day.dayOfWeek === 6) return "bg-blue-50";
  return "";
}

function dayHeaderColor(day: DaySummary): string {
  if (day.isHoliday || day.dayOfWeek === 0) return "text-danger";
  if (day.dayOfWeek === 6) return "text-link-light";
  return "text-ink";
}

interface WeeklyCalendarProps {
  weekStart: string;
  weekEnd: string;
  daySummaries: DaySummary[];
  selectedDates: Set<string>;
  onToggleDate: (date: string) => void;
  onClearSelection: () => void;
}

export function WeeklyCalendar({
  weekStart,
  weekEnd,
  daySummaries,
  selectedDates,
  onToggleDate,
  onClearSelection,
}: WeeklyCalendarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = labels.eventList;

  const navigate = useCallback(
    (week: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("week", week);
      params.delete("day");
      router.push(`/events?${params.toString()}`);
    },
    [searchParams, router],
  );

  const navigateWeek = useCallback(
    (delta: number) => navigate(shiftWeek(weekStart, delta)),
    [weekStart, navigate],
  );

  const goToday = useCallback(() => navigate(todayMonday()), [navigate]);

  const handleDayClick = useCallback((date: string) => onToggleDate(date), [onToggleDate]);

  return (
    <Card className="overflow-hidden p-0">
      {/* Header */}
      <div className="border-hairline-light flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <h2 className="text-ink text-sm font-semibold">{t.weeklyCalendar}</h2>
          {selectedDates.size > 0 && (
            <button
              type="button"
              className="text-link-light text-xs underline-offset-4 hover:underline"
              onClick={onClearSelection}
            >
              {t.clearSelection}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* 週送りは他画面のページャと同じ lucide のシェブロンに揃える。
              素の "<" ">" は文字として描かれるため、同じ画面の中でここだけ
              出自の違う部品に見えていた。 */}
          <Button
            variant="outline"
            size="sm"
            className="px-2"
            aria-label={t.prevWeek}
            onClick={() => navigateWeek(-1)}
          >
            <ChevronLeft />
          </Button>
          <span className="text-ink px-2 text-sm tabular-nums">
            {formatRangeLabel(weekStart, weekEnd)}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="px-2"
            aria-label={t.nextWeek}
            onClick={() => navigateWeek(1)}
          >
            <ChevronRight />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            {t.thisWeek}
          </Button>
        </div>
      </div>

      {/* Day grid */}
      <div className="divide-hairline-light border-hairline-light grid grid-cols-7 divide-x border-b">
        {daySummaries.map((day) => {
          const isSelected = selectedDates.has(day.date);
          return (
            <div
              key={day.date}
              className={[
                "hover:bg-primary/5 cursor-pointer px-4 py-3 transition-colors",
                cellBg(day, isSelected),
              ].join(" ")}
              onClick={() => handleDayClick(day.date)}
            >
              {/* Day header */}
              <p
                className={[
                  "border-hairline-light mb-3 border-b pb-2 text-xs font-semibold",
                  dayHeaderColor(day),
                ].join(" ")}
              >
                {formatDayHeader(day.date)}
              </p>

              {/* 未アサインを日セルの主役にする。
                  催事は人を立てられなければ売上がゼロになるため、この画面で
                  最初に探すのは「総イベント件数」ではなく「人が足りていない日」。
                  以前は総件数が最大表示で、未アサインは 3 行目の小さな数字だった。
                  イベントが無い日は静かに沈める（0 が 7 個並ぶのを避ける）。 */}
              {day.total === 0 ? (
                <p className="py-3 text-center text-sm text-slate-300">{t.noEvents}</p>
              ) : (
                <>
                  <div className="mb-3">
                    {day.unassigned > 0 ? (
                      <div className="text-danger flex items-baseline gap-1">
                        <span className="text-2xl font-bold tabular-nums leading-tight">
                          {day.unassigned}
                        </span>
                        <span className="text-[11px] font-medium">{t.unassigned}</span>
                      </div>
                    ) : (
                      <p className="text-ok text-sm font-medium">{t.allAssigned}</p>
                    )}
                  </div>

                  {/* 内訳は補助情報。件数の内訳であって行動の対象ではない。 */}
                  <div className="text-mute-light space-y-0.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span>{t.confirmed}</span>
                      <span className="tabular-nums">{day.confirmed}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{t.prospective}</span>
                      <span className="tabular-nums">{day.prospective}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
