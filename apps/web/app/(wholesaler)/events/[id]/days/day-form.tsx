"use client";

// 催事の開催日の追加・更新・削除。
//
// 複数日にまたがる催事は、この画面で日ごとに行を足す。開催時間は日ごとに違ってよい。
// 時間が未定の日は空のまま登録でき、パートナー側の配置時に入力する。

import { useState } from "react";

import { labels } from "@/lib/i18n/labels";

import { deleteEventDayAction, upsertEventDayAction } from "./actions";

const t = labels.eventDays;

export interface EventDayRow {
  id: string;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  shiftCount: number;
}

export function EventDayEditor({ eventId, days }: { eventId: string; days: EventDayRow[] }) {
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      await upsertEventDayAction({ eventId, eventDate: date, startTime: start, endTime: end });
      setDate("");
      setStart("");
      setEnd("");
      setMessage(t.saved);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t.failed);
    } finally {
      setPending(false);
    }
  }

  async function remove(eventDayId: string) {
    setPending(true);
    setMessage(null);
    try {
      await deleteEventDayAction({ eventDayId });
      setMessage(t.deleted);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t.failed);
    } finally {
      setPending(false);
    }
  }

  const field = "h-11 rounded-md border px-3 text-base sm:h-9 sm:text-sm";

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-md border">
        {days.length === 0 ? (
          <li className="text-muted-foreground p-3 text-sm">{t.empty}</li>
        ) : (
          days.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
            >
              <span className="tabular-nums">
                {d.eventDate}
                <span className="text-muted-foreground ml-2">
                  {d.startTime && d.endTime ? `${d.startTime}〜${d.endTime}` : t.timeUnset}
                </span>
                {d.shiftCount > 0 ? (
                  <span className="text-muted-foreground ml-2 text-xs">
                    {t.shiftCount.replace("{n}", String(d.shiftCount))}
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => remove(d.id)}
                disabled={pending || d.shiftCount > 0}
                className="text-destructive h-11 px-2 text-xs disabled:opacity-40 sm:h-9"
              >
                {t.remove}
              </button>
            </li>
          ))
        )}
      </ul>

      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label htmlFor="eventDate" className="text-muted-foreground block text-xs font-medium">
            {t.dateLabel}
          </label>
          <input
            id="eventDate"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className={field}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="startTime" className="text-muted-foreground block text-xs font-medium">
            {t.startLabel}
          </label>
          <input
            id="startTime"
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={field}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="endTime" className="text-muted-foreground block text-xs font-medium">
            {t.endLabel}
          </label>
          <input
            id="endTime"
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={field}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground h-11 rounded-md px-4 text-sm disabled:opacity-60 sm:h-9"
        >
          {t.add}
        </button>
      </form>

      <p className="text-muted-foreground text-xs">{t.hint}</p>
      {message ? (
        <p role="alert" className="text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
