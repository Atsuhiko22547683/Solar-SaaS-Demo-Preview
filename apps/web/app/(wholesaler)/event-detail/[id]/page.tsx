import Link from "next/link";
import { notFound } from "next/navigation";

import { AcquiredAppointmentsTable } from "@/components/reports/acquired-appointments-table";
import { DealerReportsSection } from "@/components/reports/dealer-reports-section";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { getAcquiredAppointmentsForEvent } from "../acquired-appointment-data";
import { getEventCandidate, listActiveDealers, listSelfStaff } from "../data";
import { getDealerEventReportsForEvent } from "../dealer-report-data";
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

  // パートナー会社の催事日報は独立メニューではなくここで見る（代理店-01）。
  // 開催が決まっていない候補（row.eventId が無い）には日報が紐付かない。
  const dealerReports = row.eventId
    ? await getDealerEventReportsForEvent(row.eventId)
    : {
        rows: [],
        summary: {
          lotteryTotal: 0,
          seatedTotal: 0,
          apptTotal: 0,
          countedReports: 0,
          unknownScopeReports: 0,
          boothReports: 0,
          supersededReports: 0,
        },
      };

  const te = labels.event;
  const tl = labels.eventList;
  const tc = labels.eventCandidate;

  // 画面の主語は「どこで催事をやるか」なので店舗名。開催当時の記録をそのまま出す
  // （チェーン本部名を見出しにすると、どの支店か分からない）。
  const venueName = row.storeName;

  // 実績も獲得アポイントも DB を見る。表示のたびに作る値は使わない。
  const acquiredAppointments = await getAcquiredAppointmentsForEvent(row.eventId);

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
                <dd className="text-ink mt-0.5 text-sm font-semibold">
                  {/* 店舗マスタに紐付いていれば、マスタ側の詳細へ行けるようにする。 */}
                  {row.storeId ? (
                    <Link
                      href={`/masters/stores/${row.storeId}`}
                      className="text-primary underline underline-offset-4"
                    >
                      {venueName}
                    </Link>
                  ) : (
                    venueName
                  )}
                </dd>
                {/* マスタが改称されていたら、現在の名前も添える（過去の記録は上書きしない）。 */}
                {row.storeMasterName && row.storeMasterName !== row.storeName ? (
                  <dd className="text-mute-light mt-0.5 text-xs">
                    {tc.storeRenamed.replace("{name}", row.storeMasterName)}
                  </dd>
                ) : null}
              </div>
              <div>
                <dt className="text-link-light text-xs">{tc.fields.venueProvider}</dt>
                <dd className="text-ink mt-0.5 text-sm font-semibold">
                  {row.venueProviderName ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-link-light text-xs">{te.fields.address}</dt>
                {/* 開催当時に記録した住所を出す。チェーン本部の住所ではない。 */}
                <dd className="text-ink mt-0.5 text-sm font-semibold">
                  {row.address ?? row.storeMasterAddress ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-link-light text-xs">{tc.fields.area}</dt>
                <dd className="text-ink mt-0.5 text-sm font-semibold">
                  {row.area ?? row.storeMasterAreaName ?? "—"}
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
          <AcquiredAppointmentsTable rows={acquiredAppointments} />
        </CardContent>
      </Card>

      {/* パートナー会社の催事日報（実データ）。代理店自身の報告と同じ催事に並べる。 */}
      <DealerReportsSection bundle={dealerReports} />
    </div>
  );
}
