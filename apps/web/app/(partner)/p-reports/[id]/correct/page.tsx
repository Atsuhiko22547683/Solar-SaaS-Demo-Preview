// 二次店ポータル：催事日報の訂正。自社の日報でなければ 404。
//
// 編集（内容の直し）とは別で、元の日報を残したまま訂正後の日報を新しく出す。
// 集計は訂正後だけを数えるので、訂正しても実績が二重にならない。

import { notFound, redirect } from "next/navigation";

import { PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext, franchiseNoLabel } from "@/lib/partner/context";
import { listPartnerOrigins } from "@/lib/partner/origins";

import { getPartnerReport, listPartnerLinkableEvents } from "../../data";
import { PartnerReportForm } from "../../report-form";

export const dynamic = "force-dynamic";

export default async function CorrectPartnerReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const partner = await requirePartnerContext("partner_event_report.write");
  const [origins, row, events] = await Promise.all([
    listPartnerOrigins("partner_event_report.write"),
    getPartnerReport(id),
    listPartnerLinkableEvents(),
  ]);
  if (!row) notFound();
  // すでに訂正済みなら、二重に訂正を作らせず訂正後の日報へ送る。
  if (row.supersededByReportId) redirect(`/p-reports/${row.supersededByReportId}`);

  return (
    <div>
      <PartnerPageHeader title={labels.partner.report.correctTitle} />
      <p className="text-mute-light mb-4 text-[13px]">{labels.partner.report.correctHint}</p>
      <PartnerReportForm
        mode="correct"
        initial={row}
        franchiseNo={franchiseNoLabel(partner)}
        origins={origins.options}
        events={events}
      />
    </div>
  );
}
