// 二次店ポータル：催事日報の詳細。自社の日報でなければ 404。

import Link from "next/link";
import { notFound } from "next/navigation";

import { PartnerPageHeader } from "@/components/partner/partner-ui";
import { ReportDetailView } from "@/components/partner/report-detail-view";
import { labels } from "@/lib/i18n/labels";

import { getPartnerReport } from "../data";

export const dynamic = "force-dynamic";

const c = labels.partner.common;

export default async function PartnerReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getPartnerReport(id);
  if (!row) notFound();

  return (
    <div>
      <PartnerPageHeader
        title={labels.partner.report.detailTitle}
        action={
          <Link
            href={`/p-reports/${row.id}/edit`}
            className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium"
          >
            {c.edit}
          </Link>
        }
      />
      <ReportDetailView data={row} />
      <div className="mt-4">
        <Link href="/p-reports" className="text-primary text-sm underline-offset-4 hover:underline">
          {c.backToList}
        </Link>
      </div>
    </div>
  );
}
