// S-030 — イベント詳細 (卸業者ビュー) (T-04-02 / F-027 / docs/04 §1.3 S-030).
//
// 卸業者全ロールで参照可。報告状況・担当者・シフト・関連顧客数を統合表示。
// シフト管理への導線あり (events/[id]/shifts へのリンク)。

import Link from "next/link";
import { notFound } from "next/navigation";

import { DealerReportsSection } from "@/components/reports/dealer-reports-section";
import { buildDemoResultReport } from "@/components/reports/result-report-data";
import { ResultReportTrigger } from "@/components/reports/result-report-dialog";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { getWholesalerEventDetail } from "./data";
import { ReportButtons } from "./reports/report-buttons";
import { ReportMetrics } from "./reports/report-metrics";
import { ResultReportForm } from "./reports/result-form";
import { SalespersonAssign } from "./salesperson-assign";
import { StatusSelect } from "./status-select";
import { getDealerEventReportsForEvent } from "../../event-detail/dealer-report-data";
import { canUpdateSalesperson, listActiveSalespeople } from "../../salespeople/data";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function WholesalerEventDetailPage({ params }: PageProps) {
  const { id } = await params;

  let data;
  try {
    data = await getWholesalerEventDetail(id);
  } catch {
    notFound();
  }

  // 販売員の選択肢（有効なマスタ）。参照権限が無いロールでは空にして描画を抑える。
  let salespeopleOptions: Awaited<ReturnType<typeof listActiveSalespeople>> = [];
  try {
    salespeopleOptions = await listActiveSalespeople();
  } catch {
    salespeopleOptions = [];
  }
  // アサインの変更は salesperson.update（卸業者管理者）のみ。参照ロールには
  // 保存ボタンを出さず、アサイン済みのバッジ表示に落とす。
  const canAssignSalespeople = await canUpdateSalesperson();

  // パートナー会社の日報は Event に紐付く。ここでも同じ読み取りを使う。
  const dealerReports = await getDealerEventReportsForEvent(data.id);

  const t = labels.event;
  // 追加集計項目は自社（卸業者）の成果報告にぶら下がる。未提出なら null。
  const wholesalerResultReport =
    data.reports.find((r) => r.type === "RESULT" && r.reporterOrgType === "WHOLESALER") ?? null;
  const c = labels.common;
  const bc = labels.breadcrumb.items;

  const venueName = data.venueProvider?.name ?? data.eventCandidate.storeName;

  return (
    <div className="space-y-8">
      <Breadcrumb items={[{ label: bc.events, href: "/events" }, { label: venueName }]} />

      {/* Page header */}
      <h1 className="text-ink text-xl font-bold">
        {venueName}
        {"　"}
        {t.detailHeading}
      </h1>

      {/* Meta info grid */}
      <section
        aria-label={t.sections.info}
        className="border-border bg-muted/20 grid grid-cols-1 gap-4 rounded-md border p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div>
          <p className="text-muted-foreground text-xs">{t.fields.scheduledDate}</p>
          <p className="text-sm font-medium">
            {new Date(data.eventCandidate.scheduledDate).toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground mb-1 text-xs">{t.fields.status}</p>
          <StatusSelect eventId={data.id} currentStatus={data.status} />
        </div>
        <div>
          <p className="text-muted-foreground text-xs">{t.fields.lastUpdated}</p>
          <p className="text-sm font-medium">
            {new Date(data.updatedAt).toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">{t.fields.updatedBy}</p>
          <p className="text-sm font-medium">{data.decidedByName ?? c.notSet}</p>
        </div>
      </section>

      {/* Basic info section */}
      <section aria-label={t.sections.basicInfo}>
        <h2 className="mb-3 text-base font-semibold">{t.sections.basicInfo}</h2>
        <div className="border-border space-y-3 rounded-md border p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-xs">{t.fields.area}</p>
              <p className="text-sm">
                {data.venueProvider?.area ?? data.eventCandidate.area ?? c.notSet}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">{t.fields.address}</p>
              <p className="text-sm">
                {data.venueProvider?.address ?? data.eventCandidate.address ?? c.notSet}
              </p>
            </div>
          </div>
          {data.venueProvider?.note ? (
            <div>
              <p className="text-muted-foreground text-xs">{t.fields.note}</p>
              <p className="text-sm">{data.venueProvider.note}</p>
            </div>
          ) : null}
        </div>
      </section>

      {/* Contract conditions section */}
      <section aria-label={t.sections.contractConditions}>
        <h2 className="mb-3 text-base font-semibold">{t.sections.contractConditions}</h2>
        <div className="border-border rounded-md border p-4">
          {data.venueProvider ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground text-xs">{t.fields.contractType}</p>
                <p className="text-sm font-medium">
                  {data.venueProvider.contractType
                    ? (t.contractTypes[
                        data.venueProvider.contractType as keyof typeof t.contractTypes
                      ] ?? data.venueProvider.contractType)
                    : c.notSet}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t.fields.fixedFee}</p>
                <p className="text-sm">
                  {data.venueProvider.fixedFee != null
                    ? `${Number(data.venueProvider.fixedFee).toLocaleString("ja-JP")}${c.currencySuffix}`
                    : c.notSet}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">{t.fields.performanceRate}</p>
                <p className="text-sm">
                  {data.venueProvider.performanceRate != null
                    ? `${data.venueProvider.performanceRate}%`
                    : c.notSet}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{c.notSet}</p>
          )}
        </div>
      </section>

      {/* Assign info section */}
      <section aria-label={t.sections.assignInfo}>
        <h2 className="mb-3 text-base font-semibold">{t.sections.assignInfo}</h2>

        {/* DEALER or JOINT: show assigned dealers */}
        {(data.mode === "DEALER" || data.mode === "JOINT") && (
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-medium">{t.sections.dealers}</h3>
            {data.dealers.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t.noDealers}</p>
            ) : (
              <ul className="space-y-2">
                {data.dealers.map((d) => (
                  <li
                    key={d.relationshipId}
                    className="border-border rounded-md border p-3 text-sm"
                  >
                    <span className="font-medium">{d.dealerName}</span>
                    {d.scopeOverride ? (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {d.scopeOverride}
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* SELF or JOINT: show shifts table */}
        {(data.mode === "SELF" || data.mode === "JOINT") && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium">{t.sections.shifts}</h3>
              <Button asChild size="sm" variant="outline">
                <Link href={`/events/${data.id}/shifts`}>{t.manageShifts}</Link>
              </Button>
            </div>
            {data.shifts.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t.noShifts}</p>
            ) : (
              <div className="border-border overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">
                        {labels.eventShift.fields.user}
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        {labels.eventShift.fields.role}
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        {labels.eventShift.fields.status}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {data.shifts.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium">{s.userName}</td>
                        <td className="px-3 py-2">
                          {labels.eventShift.roles[
                            s.role as keyof typeof labels.eventShift.roles
                          ] ?? s.role}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary">
                            {labels.eventShift.statuses[
                              s.status as keyof typeof labels.eventShift.statuses
                            ] ?? s.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 販売員アサイン — 認証 User のシフトとは別概念（Salesperson マスタから選ぶ）。 */}
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium">{labels.salespersonList.assign.title}</h3>
          <SalespersonAssign
            eventId={data.id}
            assignedIds={data.salespeople.map((s) => s.salespersonId)}
            candidates={salespeopleOptions}
            canEdit={canAssignSalespeople}
          />
        </div>

        {/* DEALER only: no shifts needed, show shift management link anyway */}
        {data.mode === "DEALER" && (
          <div className="mt-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/events/${data.id}/shifts`}>{t.manageShifts}</Link>
            </Button>
          </div>
        )}
      </section>

      {/* Reports */}
      <section aria-label={t.sections.reports}>
        <h2 className="mb-3 text-base font-semibold">{t.sections.reports}</h2>
        {data.reports.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.noReports}</p>
        ) : (
          <ul className="space-y-2">
            {data.reports.map((r) => {
              const typeLabel = t.reportTypes[r.type as keyof typeof t.reportTypes] ?? r.type;
              return (
                <li key={r.id} className="border-border rounded-md border p-3 text-sm">
                  {r.type === "RESULT" ? (
                    // 成果報告はクリックで日報ポップアップを開く。
                    <ResultReportTrigger
                      data={buildDemoResultReport(r.id, {
                        date: data.eventCandidate.scheduledDate.slice(0, 10),
                        venuePlace: data.venueProvider?.name ?? data.eventCandidate.storeName,
                      })}
                    >
                      {typeLabel}
                    </ResultReportTrigger>
                  ) : (
                    <span className="font-medium">{typeLabel}</span>
                  )}
                  <Badge variant="outline" className="ml-2 text-xs">
                    {t.reportOrgTypes[r.reporterOrgType] ?? r.reporterOrgType}
                  </Badge>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {formatDateTime(r.createdAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* パートナー会社の日報・実績 — /event-detail と同じ DB の提出を見る。 */}
      <DealerReportsSection bundle={dealerReports} />

      {/* Report actions (T-04-03) */}
      <section aria-label={labels.eventReport.sections.actions}>
        <h2 className="mb-3 text-base font-semibold">{labels.eventReport.sections.actions}</h2>
        <ReportButtons
          eventId={data.id}
          hasWholesalerStart={data.reports.some(
            (r) => r.type === "START" && r.reporterOrgType === "WHOLESALER",
          )}
          hasWholesalerEnd={data.reports.some(
            (r) => r.type === "END" && r.reporterOrgType === "WHOLESALER",
          )}
        />
      </section>

      {/* Result report (T-04-04 / F-030) */}
      <section aria-label={labels.eventReport.sections.result}>
        <h2 className="mb-3 text-base font-semibold">{labels.eventReport.sections.result}</h2>
        <ResultReportForm eventId={data.id} hasWholesalerResult={wholesalerResultReport != null} />
      </section>

      {/* 追加集計項目 — 固定集計項目とは別枠で、成果報告にぶら下げて管理する */}
      <section aria-label={labels.eventReport.sections.metrics}>
        <h2 className="mb-3 text-base font-semibold">{labels.eventReport.sections.metrics}</h2>
        <ReportMetrics
          reportId={wholesalerResultReport?.id ?? null}
          metrics={wholesalerResultReport?.metrics ?? []}
        />
      </section>

      {/* Customers */}
      <section aria-label={t.sections.customers}>
        <h2 className="mb-3 text-base font-semibold">{t.sections.customers}</h2>
        {data.customerCount === 0 ? (
          <p className="text-muted-foreground text-sm">{t.noCustomers}</p>
        ) : (
          <p className="text-sm">
            {data.customerCount} {t.customerCountSuffix}
          </p>
        )}
        {/* このイベントから顧客登録へ。催事 ID と販売チャネル（催事）を前埋めする。 */}
        <Button asChild size="sm" variant="outline" className="mt-3">
          <Link href={`/customers/new?eventId=${data.id}`}>{t.registerCustomer}</Link>
        </Button>
      </section>
    </div>
  );
}
