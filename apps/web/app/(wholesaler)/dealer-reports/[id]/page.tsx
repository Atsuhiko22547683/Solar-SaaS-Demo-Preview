// 代理店側：二次店が提出した催事日報の詳細（閲覧専用）。
//
// 表示内容は二次店ポータルの詳細と同一（ReportDetailView を共有）。
// 編集導線は置かない。

import Link from "next/link";
import { notFound } from "next/navigation";

import { ListPageHeader } from "@/components/list/list-shell";
import { ReportDetailView } from "@/components/partner/report-detail-view";
import { labels } from "@/lib/i18n/labels";

import { getDealerReport } from "../data";

export const dynamic = "force-dynamic";

const t = labels.dealerReportView;

export default async function DealerReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getDealerReport(id);
  if (!row) notFound();

  return (
    <div className="space-y-6">
      <ListPageHeader title={t.detailTitle} subtitle={row.dealerName} />
      <p className="text-mute-light text-[13px]">{t.readOnlyNote}</p>
      <ReportDetailView data={row} />
      <Link
        href="/dealer-reports"
        className="text-primary text-sm underline-offset-4 hover:underline"
      >
        {t.backToList}
      </Link>
    </div>
  );
}
