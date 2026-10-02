// 二次店ポータル：催事日報の詳細。自社の日報でなければ 404。

import Link from "next/link";
import { notFound } from "next/navigation";

import { BackToListLink } from "@/components/partner/back-to-list-link";
import { PartnerPageHeader } from "@/components/partner/partner-ui";
import { ReportDetailView } from "@/components/partner/report-detail-view";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext, franchiseNoLabel } from "@/lib/partner/context";

import { getPartnerReport } from "../data";

export const dynamic = "force-dynamic";

const c = labels.partner.common;

export default async function PartnerReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const partner = await requirePartnerContext("partner_event_report.read");
  const row = await getPartnerReport(id);
  if (!row) notFound();

  return (
    <div>
      <PartnerPageHeader
        title={labels.partner.report.detailTitle}
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link
              href={`/p-reports/${row.id}/edit`}
              className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 w-full items-center justify-center rounded-md border px-4 text-sm font-medium sm:h-9 sm:w-auto sm:px-3"
            >
              {c.edit}
            </Link>
            {/* 訂正は元の日報を残したまま出し直す。訂正済みなら出さない。 */}
            {row.supersededByReportId ? null : (
              <Link
                href={`/p-reports/${row.id}/correct`}
                className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 w-full items-center justify-center rounded-md border px-4 text-sm font-medium sm:h-9 sm:w-auto sm:px-3"
              >
                {labels.partner.report.correctAction}
              </Link>
            )}
          </div>
        }
      />
      {/* 訂正の関係は必ず出す。どちらが集計の対象かが分からないと読み違える。 */}
      {row.supersededByReportId ? (
        <p className="text-warning mb-3 text-[13px]">
          {labels.partner.report.correctedBadge}{" "}
          <Link className="underline" href={`/p-reports/${row.supersededByReportId}`}>
            {labels.partner.report.alreadyCorrected}
          </Link>
        </p>
      ) : null}
      {row.supersedesReportId ? (
        <p className="text-mute-light mb-3 text-[13px]">
          {labels.partner.report.correctionBadge}{" "}
          <Link className="underline" href={`/p-reports/${row.supersedesReportId}`}>
            {labels.partner.report.detailTitle}
          </Link>
        </p>
      ) : null}

      {/* 誰が出した日報かは管理者にだけ出す（本人には自明なので出さない）。 */}
      {partner.role === "ADMIN" ? (
        <p className="text-mute-light mb-3 text-[13px]">
          {labels.partner.list.submittedByColumn}:{" "}
          <span className="text-ink">{row.submitterName ?? c.dash}</span>
        </p>
      ) : null}
      <ReportDetailView data={row} franchiseNo={franchiseNoLabel(partner)} />
      <div className="mt-4">
        <BackToListLink href="/p-reports" label={c.backToList} />
      </div>
    </div>
  );
}
