import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Metric, SectionLabel, TodoRow } from "@/components/home/home-sections";
import { Card } from "@/components/ui/card";
import { labels } from "@/lib/i18n/labels";

import { getDashboardSummary } from "./data";
import { SalesTrendChart } from "./sales-trend-chart";

export const dynamic = "force-dynamic";

const t = labels.dashboard;

function fmt(yen: number | null) {
  if (yen == null) return "—";
  return `¥${yen.toLocaleString("ja-JP")}`;
}

export default async function WholesalerDashboardPage() {
  const session = await auth();
  if (session?.user?.isSaasAdmin) {
    redirect("/saas-admin-dashboard");
  }

  const summary = await getDashboardSummary();
  const todo = t.sections.todo;
  const ms = t.sections.monthlySummary;

  const contractDiff = summary.monthlySummary.contractCountDiff;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-ink text-xl font-bold">{t.title}</h1>
        <p className="text-mute-light mt-0.5 text-[13px]">{t.subtitle}</p>
      </div>

      {/* ── 要対応 ──
          催事営業で売上を落とす原因は「体制が決まらない」「コールが漏れる」
          「通達を見ていない」の 3 つ。ホームの最上段はこれだけに使う。 */}
      <section>
        <SectionLabel>{todo.title}</SectionLabel>
        <Card className="divide-hairline-light divide-y p-0">
          <TodoRow
            title={todo.preference.title}
            count={summary.dealerPreference.pendingDealerCount}
            unit={todo.preference.unit}
            hint={todo.preference.hint}
            clearedHint={todo.allClear}
            href="/lane-preferences"
            linkLabel={todo.preference.link}
          />
          <TodoRow
            title={todo.precall.title}
            count={summary.precall.pendingCount}
            unit={todo.precall.unit}
            hint={todo.precall.hint}
            clearedHint={todo.allClear}
            href="/customers/maekaku"
            linkLabel={todo.precall.link}
          />
          <TodoRow
            title={todo.unread.title}
            count={summary.notifications.unreadCount}
            unit={todo.unread.unit}
            hint={todo.unread.hint}
            clearedHint={todo.allClear}
            href="/notifications"
            linkLabel={todo.unread.link}
          />
        </Card>
      </section>

      {/* ── 今週の催事 ──
          この事業の実体。日付・場所・体制・担当二次店数が一目で並ぶことが重要。 */}
      <section>
        <SectionLabel
          action={
            <Link
              href="/events"
              className="text-link-light text-xs underline-offset-4 hover:underline"
            >
              {t.sections.recentEvents.viewAll}
            </Link>
          }
        >
          {t.sections.thisWeek.title}
        </SectionLabel>
        <Card className="overflow-hidden p-0">
          {summary.weekendEvents.length === 0 ? (
            <p className="text-mute-light px-4 py-8 text-[13px]">
              {t.sections.weekendEvents.empty}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t.sections.weekendEvents.cols.date}</th>
                    <th scope="col">{t.sections.weekendEvents.cols.name}</th>
                    <th scope="col">{t.sections.weekendEvents.cols.venue}</th>
                    <th scope="col">{t.sections.weekendEvents.cols.mode}</th>
                    <th scope="col" className="text-right">
                      {t.sections.weekendEvents.cols.dealers}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.weekendEvents.map((ev) => (
                    <tr key={ev.id}>
                      <td className="whitespace-nowrap tabular-nums">{ev.date}</td>
                      <td>
                        <Link
                          href={`/events/${ev.id}`}
                          className="text-link-light font-medium underline-offset-4 hover:underline"
                        >
                          {ev.name}
                        </Link>
                      </td>
                      <td className="max-w-xs truncate">{ev.venue}</td>
                      <td>{ev.mode}</td>
                      <td className="text-right tabular-nums">{ev.dealerCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      {/* ── 当月成績サマリ ──
          実績は確認しに行くもの。1 行のメトリクス帯 + 推移グラフに留め、
          最上段の要対応より視線を引かないようにする。 */}
      <section>
        <SectionLabel
          action={
            <Link
              href="/commissions"
              className="text-link-light text-xs underline-offset-4 hover:underline"
            >
              {ms.link}
            </Link>
          }
        >
          {ms.title}
        </SectionLabel>
        <Card className="p-0">
          <div className="divide-hairline-light flex flex-col divide-y sm:flex-row sm:divide-y-0">
            <Metric
              label={ms.contractCount}
              value={`${summary.monthlySummary.contractCount ?? "—"}${t.kpi.countUnit}`}
              sub={
                contractDiff == null
                  ? undefined
                  : `${ms.prevMonthPrefix} ${summary.monthlySummary.prevContractCount ?? "—"}${t.kpi.countUnit}（${contractDiff >= 0 ? "+" : ""}${contractDiff}）`
              }
            />
            <Metric
              label={ms.revenue}
              value={fmt(summary.monthlySummary.revenueYen)}
              sub={`${ms.prevMonthPrefix} ${fmt(summary.monthlySummary.prevRevenueYen)}`}
            />
            <Metric label={ms.grossProfit} value={fmt(summary.monthlySummary.grossProfitYen)} />
            <Metric
              label={ms.appointments}
              value={`${summary.weeklyAppointments.completedCount + summary.weeklyAppointments.scheduledCount}${t.kpi.countUnit}`}
              sub={`${t.kpi.appointmentCompleted} ${summary.weeklyAppointments.completedCount}／${t.kpi.appointmentScheduled} ${summary.weeklyAppointments.scheduledCount}`}
            />
          </div>
          <div className="border-hairline-light border-t px-4 py-4">
            <p className="text-mute-light mb-2 text-xs">{t.sections.salesTrend.title}</p>
            <SalesTrendChart data={summary.salesTrend} />
          </div>
        </Card>
      </section>
    </div>
  );
}
