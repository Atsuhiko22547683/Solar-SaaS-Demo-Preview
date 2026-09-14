// 二次店ポータル：催事日報の編集。自社の日報でなければ 404。

import { notFound } from "next/navigation";

import { PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";

import { getPartnerReport } from "../../data";
import { PartnerReportForm } from "../../report-form";

export const dynamic = "force-dynamic";

export default async function EditPartnerReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getPartnerReport(id);
  if (!row) notFound();

  return (
    <div>
      <PartnerPageHeader title={labels.partner.report.editTitle} />
      <PartnerReportForm mode="edit" initial={row} />
    </div>
  );
}
