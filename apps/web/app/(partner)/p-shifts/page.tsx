// 催事シフト。スタッフサイト・管理者サイトの共通画面。
//
// 初期表示は当月。前月 / 当月 / 翌月の切替と、月の直接選択ができる。
// 一覧ビューとカレンダービューを切り替えられる。並べ替え UI は持たない。
//
// 管理者サイトでは「配置する」から一括配置へ入れる。スタッフサイトは閲覧のみ。

import Link from "next/link";

import { FILTER_INPUT_CLASS } from "@/components/partner/list-filter";
import { PartnerCard, PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";

import { listPartnerShiftMonth } from "./data";
import { currentMonth, monthOptions, parseShiftMonthQuery } from "./query";
import { ShiftCalendarView, ShiftListView } from "./shift-views";

import type { RawParams } from "@/lib/partner/list-query";

export const dynamic = "force-dynamic";

const BASE = "/p-shifts";
const t = labels.partner.shift;

/** 月・表示方法・絞り込みを保ったままリンクを作る。 */
function hrefWith(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  return `${BASE}?${sp.toString()}`;
}

export default async function PartnerShiftsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const q = parseShiftMonthQuery(params);
  const data = await listPartnerShiftMonth(q);

  const common = { member: q.member, venue: q.venue, view: q.view };
  const navClass =
    "border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 items-center justify-center rounded-md border px-3 text-sm sm:h-9";
  const activeClass =
    "bg-primary inline-flex h-11 items-center justify-center rounded-md px-3 text-sm font-medium text-white sm:h-9";

  return (
    <div>
      <PartnerPageHeader
        title={t.title}
        description={t.subtitle}
        action={
          data.isAdmin ? (
            <Link
              href={`${BASE}/assign?month=${data.month}`}
              className="bg-primary focus-visible:ring-primary/40 inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 sm:h-9"
            >
              {t.assign.open}
            </Link>
          ) : undefined
        }
      />

      <PartnerCard className="mb-4">
        {/* 月の切替。前月 / 当月 / 翌月 と、直接選択。 */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href={hrefWith({ ...common, month: data.prevMonth })} className={navClass}>
            {t.prevMonth}
          </Link>
          <Link href={hrefWith({ ...common, month: currentMonth() })} className={navClass}>
            {t.thisMonth}
          </Link>
          <Link href={hrefWith({ ...common, month: data.nextMonth })} className={navClass}>
            {t.nextMonth}
          </Link>
        </div>

        <form method="GET" className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="view" value={q.view} />
          <div className="space-y-1">
            <label htmlFor="month" className="text-mute-light block text-xs font-medium">
              {t.monthLabel}
            </label>
            <select
              id="month"
              name="month"
              defaultValue={data.month}
              className={FILTER_INPUT_CLASS}
            >
              {monthOptions(data.month).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="member" className="text-mute-light block text-xs font-medium">
              {t.admin.filters.member}
            </label>
            <select
              id="member"
              name="member"
              defaultValue={q.member ?? ""}
              className={FILTER_INPUT_CLASS}
            >
              <option value="">{labels.partner.list.all}</option>
              {data.memberOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="venue" className="text-mute-light block text-xs font-medium">
              {t.columns.venue}
            </label>
            <input
              id="venue"
              name="venue"
              defaultValue={q.venue ?? ""}
              className={FILTER_INPUT_CLASS}
            />
          </div>
          <button type="submit" className={navClass}>
            {t.monthApply}
          </button>
        </form>

        {/* 一覧 / カレンダー の切替。 */}
        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          role="group"
          aria-label={t.viewLabel}
        >
          <Link
            href={hrefWith({ ...common, month: data.month, view: "list" })}
            aria-current={q.view === "list" ? "page" : undefined}
            className={q.view === "list" ? activeClass : navClass}
          >
            {t.viewList}
          </Link>
          <Link
            href={hrefWith({ ...common, month: data.month, view: "calendar" })}
            aria-current={q.view === "calendar" ? "page" : undefined}
            className={q.view === "calendar" ? activeClass : navClass}
          >
            {t.viewCalendar}
          </Link>
        </div>

        {q.errors.length > 0 ? (
          <ul role="alert" className="text-danger mt-2 space-y-0.5 text-sm">
            {q.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
      </PartnerCard>

      <PartnerCard>
        {q.view === "calendar" ? (
          <ShiftCalendarView
            month={data.month}
            days={data.days}
            basePath={BASE}
            search={new URLSearchParams(
              Object.entries({
                month: data.month,
                member: q.member ?? "",
                venue: q.venue ?? "",
              }).filter(([, v]) => v) as [string, string][],
            ).toString()}
          />
        ) : (
          <ShiftListView days={data.days} />
        )}
      </PartnerCard>
    </div>
  );
}
