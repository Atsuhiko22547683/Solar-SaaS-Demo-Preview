// 二次店ポータル：催事日報の編集。自社の日報でなければ 404。

import { notFound } from "next/navigation";

import { PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext, franchiseNoLabel } from "@/lib/partner/context";
import { listPartnerOrigins } from "@/lib/partner/origins";

import { getPartnerReport } from "../../data";
import { PartnerReportForm } from "../../report-form";

export const dynamic = "force-dynamic";

export default async function EditPartnerReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const partner = await requirePartnerContext("partner_event_report.write");
  // 依頼先代理店の候補（複数の代理店から依頼を受ける会社では選択が要る）。
  const origins = await listPartnerOrigins("partner_event_report.write");
  const row = await getPartnerReport(id);
  if (!row) notFound();

  return (
    <div>
      <PartnerPageHeader title={labels.partner.report.editTitle} />
      <PartnerReportForm
        mode="edit"
        initial={row}
        franchiseNo={franchiseNoLabel(partner)}
        origins={origins.options}
      />
    </div>
  );
}
