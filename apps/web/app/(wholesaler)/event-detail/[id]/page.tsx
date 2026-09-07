import { notFound } from "next/navigation";

import {
  buildDemoAppointments,
  buildDemoEventReports,
} from "@/components/reports/result-report-data";
import {
  AcquiredAppointmentsTable,
  EventReportsView,
} from "@/components/reports/result-report-dialog";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { getEventCandidate, listActiveDealers, listSelfStaff } from "../data";
import { AssignSection } from "./assign-section";
import { CandidateStatusSelect } from "./candidate-status-select";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatScheduledDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}

export default async function EventCandidateDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [row, selfStaff, dealers] = await Promise.all([
    getEventCandidate(id),
    listSelfStaff(),
    listActiveDealers(),
  ]);
  if (!row) notFound();

  const te = labels.event;
  const tl = labels.eventList;
  const tc = labels.eventCandidate;

  const venueName = row.venueProviderName ?? row.storeName;

  // 報告（開始/終了/成果）+ アポ取り顧客のデモ値を決定論的に生成（同一シード）。
  const reportSeed = row.eventId ?? row.id;
  const reportCtx = { date: row.scheduledDate.slice(0, 10), venuePlace: venueName };
  const demoReports = buildDemoEventReports(reportSeed, reportCtx);
  const demoAppointments = buildDemoAppointments(
    reportSeed,
    demoReports.result.apptTotal,
    reportCtx,
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[{ label: tl.title, href: "/events" }, { label: venueName }]} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <h1 className="text-ink text-xl font-bold">{venueName}</h1>
        <p className="text-mute-light whitespace-nowrap text-xs">
          {te.fields.lastUpdated} {formatDate(row.updatedAt)}
        </p>
      </div>

      {/* Date + Status bar */}
      <div className="border-hairline-light flex items-center justify-between rounded-md border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-mute-light whitespace-nowrap text-sm">{tl.dateTime}</span>
          <span className="text-ink text-sm font-semibold">
            {formatScheduledDate(row.scheduledDate)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-mute-light whitespace-nowrap text-sm">{tl.holdingStatusLabel}</span>
          <CandidateStatusSelect id={row.id} current={row.status} />
        </div>
      </div>

      {/* Two-column: Basic Info + Assign Info */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Basic Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{te.sections.basicInfo}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div>
                <dt className="text-link-light text-xs">{te.fields.storeName}</dt>
                <dd className="text-ink mt-0.5 text-sm font-semibold">{venueName}</dd>
              </div>
              <div>
                <dt className="text-link-light text-xs">{te.fields.address}</dt>
                <dd className="text-ink mt-0.5 text-sm font-semibold">
                  {row.venueProviderAddress ?? row.address ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-link-light text-xs">{tc.fields.venueChain}</dt>
                <dd className="text-ink mt-0.5 text-sm font-semibold">
                  {row.venueChain ? tc.venueChains[row.venueChain] : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-link-light text-xs">{tc.fields.boothArea}</dt>
                <dd className="text-ink mt-0.5 text-sm font-semibold">
                  {row.boothArea
                    ? row.boothArea === "OTHER" && row.boothAreaNote
                      ? `${tc.boothAreas.OTHER}（${row.boothAreaNote}）`
                      : tc.boothAreas[row.boothArea]
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-link-light text-xs">{tc.fields.productCategory}</dt>
                <dd className="text-ink mt-0.5 text-sm font-semibold">
                  {row.productCategory ? tc.productCategories[row.productCategory] : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-link-light text-xs">{te.fields.contractType}</dt>
                <dd className="text-ink mt-0.5 text-sm font-semibold">
                  {row.venueProviderContractType
                    ? (te.contractTypes[
                        row.venueProviderContractType as keyof typeof te.contractTypes
                      ] ?? row.venueProviderContractType)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-link-light text-xs">{te.fields.fixedFee}</dt>
                <dd className="text-ink mt-0.5 text-sm font-semibold">
                  {row.venueProviderFixedFee != null
                    ? `¥${Number(row.venueProviderFixedFee).toLocaleString("ja-JP")}`
                    : "—"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Right: Assign Info */}
        <AssignSection
          candidateId={row.id}
          eventId={row.eventId}
          eventMode={row.eventMode}
          candidateStatus={row.status}
          assignees={row.assignees}
          overallStatus={row.assignees.length > 0 ? "confirmed" : "adjusting"}
          selfStaff={selfStaff}
          dealers={dealers}
          memo={row.eventNote}
        />
      </div>

      {/* Appointment Info table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tl.appointmentInfo}</CardTitle>
        </CardHeader>
        <CardContent>
          <AcquiredAppointmentsTable customers={demoAppointments} />
        </CardContent>
      </Card>

      {/* Report — 開始/終了/成果 をインライン表示（レーンイベントと同一 UI） */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{tl.reportSection}</CardTitle>
        </CardHeader>
        <CardContent>
          <EventReportsView
            reports={buildDemoEventReports(row.eventId ?? row.id, {
              date: row.scheduledDate.slice(0, 10),
              venuePlace: venueName,
            })}
          />
        </CardContent>
      </Card>
    </div>
  );
}
