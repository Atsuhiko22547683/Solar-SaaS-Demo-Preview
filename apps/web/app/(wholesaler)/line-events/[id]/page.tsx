import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { getAcquiredAppointmentsForLineEvent } from "../../event-detail/acquired-appointment-data";
import { getDealerEventReportsForLineEvent } from "../../event-detail/dealer-report-data";
import { getLineEvent, listActiveDealers, listSelfStaff } from "../data";
import { LineAssignSection } from "./line-assign-section";
import { LineScheduleSection } from "./line-schedule-section";
import { LineStatusSelect } from "./line-status-select";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LineEventDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [row, selfStaff, dealers, reportsByDate, appointmentsByDate] = await Promise.all([
    getLineEvent(id),
    listSelfStaff(),
    listActiveDealers(),
    // 開催日ごとの日報・獲得アポイント。このレーンで確定した催事のものだけを読む。
    getDealerEventReportsForLineEvent(id),
    getAcquiredAppointmentsForLineEvent(id),
  ]);
  if (!row) notFound();

  const t = labels.lineEvent;
  const vt = labels.venueProvider;

  const contractTypeLabel = row.contractType
    ? (vt.contractTypes[row.contractType as keyof typeof vt.contractTypes] ?? row.contractType)
    : "—";

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: t.breadcrumbList, href: "/line-events" }, { label: row.name }]}
      />

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-ink text-xl font-bold">{row.name}</h1>
          <LineStatusSelect id={row.id} current={row.status} />
        </div>
        <p className="text-mute-light whitespace-nowrap text-xs">
          {t.fields.updatedAt} {formatDate(row.updatedAt)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 基本情報 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t.sections.basic}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div>
                <dt className="text-link-light text-xs">{t.fields.venueProvider}</dt>
                <dd className="text-ink mt-0.5 text-sm font-semibold">
                  {row.venueProviderName ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-link-light text-xs">{t.fields.area}</dt>
                <dd className="text-ink mt-0.5 text-sm font-semibold">{row.area ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-link-light text-xs">{t.fields.targetMonth}</dt>
                <dd className="text-ink mt-0.5 text-sm font-semibold">{row.targetMonth}</dd>
              </div>
              <div>
                <dt className="text-link-light text-xs">{t.columns.holdingCount}</dt>
                <dd className="text-ink mt-0.5 text-sm font-semibold">
                  {row.scheduledDates.length}
                  {t.holdingCountSuffix}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* 契約条件 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t.sections.contract}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div>
                <dt className="text-link-light text-xs">{t.fields.contractType}</dt>
                <dd className="text-ink mt-0.5 text-sm font-semibold">{contractTypeLabel}</dd>
              </div>
              {row.contractType === "FIXED" ? (
                <div>
                  <dt className="text-link-light text-xs">{t.fields.perDayFee}</dt>
                  <dd className="text-ink mt-0.5 text-sm font-semibold">
                    {row.fixedFee != null
                      ? `¥${Number(row.fixedFee).toLocaleString("ja-JP")}`
                      : "—"}
                  </dd>
                </div>
              ) : null}
              {row.contractType === "PERFORMANCE" ? (
                <div>
                  <dt className="text-link-light text-xs">{t.fields.revenueRate}</dt>
                  <dd className="text-ink mt-0.5 text-sm font-semibold">
                    {row.performanceRate != null ? `${row.performanceRate}%` : "—"}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-link-light text-xs">{t.fields.contractNote}</dt>
                <dd className="text-ink mt-0.5 whitespace-pre-wrap text-sm font-semibold">
                  {row.contractNote ?? "—"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* 開催日 — カレンダー + 開催予定日パネル（編集・日付ポップアップ付き） */}
      <LineScheduleSection
        lineEventId={row.id}
        targetMonth={row.targetMonth}
        scheduledDates={row.scheduledDates}
        contractNote={row.contractNote}
        reportsByDate={reportsByDate}
        appointmentsByDate={appointmentsByDate}
      />

      {/* アサイン情報 */}
      <LineAssignSection
        lineEventId={row.id}
        assignMode={row.assignMode}
        assignStatus={row.assignStatus}
        assignStaffIds={row.assignStaffIds}
        assignDealerIds={row.assignDealerIds}
        assignees={row.assignees}
        assignNote={row.assignNote}
        selfStaff={selfStaff}
        dealers={dealers}
      />
    </div>
  );
}
