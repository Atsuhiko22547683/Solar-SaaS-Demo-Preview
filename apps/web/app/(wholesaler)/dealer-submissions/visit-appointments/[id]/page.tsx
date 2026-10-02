// 代理店側：二次店が提出した訪問アポの詳細（閲覧専用）。

import Link from "next/link";
import { notFound } from "next/navigation";

import { ListPageHeader } from "@/components/list/list-shell";
import { formatDateTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { getDealerVisitAppointment } from "../../data";

export const dynamic = "force-dynamic";

const t = labels.dealerVisitAppointmentView;
const v = labels.partner.visitAppointment;
const a = labels.partner.appointment;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-mute-light text-xs">{label}</dt>
      <dd className="text-ink mt-0.5 break-words text-sm">{value || "—"}</dd>
    </div>
  );
}

export default async function DealerVisitAppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getDealerVisitAppointment(id);
  if (!row) notFound();

  return (
    <div className="space-y-4">
      <ListPageHeader title={t.detailTitle} subtitle={t.readOnlyNote} />
      <div className="border-hairline-light rounded-lg border bg-white p-5">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Row label={t.columns.dealerName} value={row.dealerName} />
          <Row label={v.fields.tossDept} value={row.tossDept} />
          <Row label={v.fields.maekakuOperator} value={row.maekakuOperator} />
          <Row label={v.fields.closeDept} value={row.closeDept} />
          <Row label={v.fields.salesRep} value={row.salesRep} />
          <Row
            label={v.fields.channel}
            value={a.salesChannelLabels[row.salesChannel] ?? row.salesChannel}
          />
          <Row label={v.fields.createdAt} value={formatDateTime(row.createdAt)} />
        </dl>
      </div>
      <Link
        href="/dealer-submissions/visit-appointments"
        className="text-primary text-sm underline-offset-4 hover:underline"
      >
        {t.backToList}
      </Link>
    </div>
  );
}
