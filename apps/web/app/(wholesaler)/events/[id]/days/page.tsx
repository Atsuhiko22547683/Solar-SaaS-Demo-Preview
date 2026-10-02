// 催事の開催日の管理（代理店）。
//
// 1 催事 = 1 日とは限らないため、開催日を行として登録する。開催時間は日ごとに持ち、
// パートナー会社のシフト配置で予定時間の初期値になる。

import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { labels } from "@/lib/i18n/labels";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import { EventDayEditor, type EventDayRow } from "./day-form";

export const dynamic = "force-dynamic";

const t = labels.eventDays;

function hhmm(d: Date | null): string | null {
  if (!d) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// 暦日は UTC 0 時で保持しているので UTC で読む（ローカルで読むと JST では前日になる）。
function dateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export default async function EventDaysPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();
  const ctx = await getTenantContext();

  const event = await withTenant(ctx, (tx) =>
    tx.event.findFirst({
      where: { id },
      select: {
        id: true,
        eventCandidate: { select: { storeName: true } },
        days: {
          orderBy: { eventDate: "asc" },
          select: {
            id: true,
            eventDate: true,
            startAt: true,
            endAt: true,
            note: true,
            _count: { select: { shifts: true } },
          },
        },
      },
    }),
  );
  if (!event) notFound();

  const days: EventDayRow[] = event.days.map((d) => ({
    id: d.id,
    eventDate: dateKey(d.eventDate),
    startTime: hhmm(d.startAt),
    endTime: hhmm(d.endAt),
    note: d.note,
    shiftCount: d._count.shifts,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold">
          {t.title} — {event.eventCandidate.storeName}
        </h1>
        <p className="text-muted-foreground mt-0.5 text-sm">{t.subtitle}</p>
      </div>
      <EventDayEditor eventId={event.id} days={days} />
      <Link
        href={`/events/${event.id}/shifts`}
        className="text-primary text-sm underline-offset-4 hover:underline"
      >
        {labels.partner.shift.title}
      </Link>
    </div>
  );
}
