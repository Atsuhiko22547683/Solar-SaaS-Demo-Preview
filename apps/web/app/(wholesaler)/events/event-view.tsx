"use client";

import { useCallback, useState } from "react";

import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { EventTable } from "./event-table";
import { WeeklyCalendar } from "./weekly-calendar";

import type { DaySummary, UnifiedEventRow } from "./unified-data";

interface EventViewProps {
  weekStart: string;
  weekEnd: string;
  daySummaries: DaySummary[];
  events: UnifiedEventRow[];
}

export function EventView({ weekStart, weekEnd, daySummaries, events }: EventViewProps) {
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const t = labels.eventList;

  const clearSelection = useCallback(() => setSelectedDates(new Set()), []);

  const toggleDate = useCallback((date: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  }, []);

  const hasSelection = selectedDates.size > 0;
  const filtered = hasSelection
    ? events.filter((ev) => selectedDates.has(ev.scheduledDate.slice(0, 10)))
    : events;

  // 表示は共有フォーマッタへ通す。以前はカレンダー見出しが
  // 「2026年8月31日(月) 〜 9月6日(日)」なのに、直下のこのラベルだけ
  // 「2026-08-31 〜 2026-09-06」という機械可読形式のままだった。
  const rangeLabel = hasSelection
    ? t.selectedDateLabel.replace("{date}", [...selectedDates].sort().map(formatDate).join("、"))
    : t.selectedWeekRange
        .replace("{start}", formatDate(weekStart))
        .replace("{end}", formatDate(weekEnd));

  return (
    <>
      <WeeklyCalendar
        weekStart={weekStart}
        weekEnd={weekEnd}
        daySummaries={daySummaries}
        selectedDates={selectedDates}
        onToggleDate={toggleDate}
        onClearSelection={clearSelection}
      />

      <Card className="overflow-hidden p-0">
        <div className="border-hairline-light flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-ink text-sm font-medium">
            {hasSelection ? t.selectedDateEvents : t.selectedWeekEvents}
          </h2>
          <span className="text-mute-light text-xs tabular-nums">{rangeLabel}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="text-mute-light px-6 py-12 text-center text-sm">{t.empty}</div>
        ) : (
          <EventTable events={filtered} />
        )}
      </Card>
    </>
  );
}
