// 代理店側：二次店が提出した成約の詳細（閲覧専用）。

import Link from "next/link";
import { notFound } from "next/navigation";

import { ListPageHeader } from "@/components/list/list-shell";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { getDealerContract } from "../../data";

export const dynamic = "force-dynamic";

const t = labels.dealerContractView;
const p = labels.partner.contract;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-mute-light text-xs">{label}</dt>
      <dd className="text-ink mt-0.5 break-words text-sm">{value || "—"}</dd>
    </div>
  );
}

export default async function DealerContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getDealerContract(id);
  if (!row) notFound();

  return (
    <div className="space-y-4">
      <ListPageHeader title={t.detailTitle} subtitle={t.readOnlyNote} />
      <div className="border-hairline-light rounded-lg border bg-white p-5">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <Row label={t.columns.dealerName} value={row.dealerName} />
          <Row label={p.fields.contractDate} value={formatDate(row.contractDate)} />
          <Row label={p.fields.tossDate} value={formatDate(row.tossDate)} />
          <Row label={p.fields.tossDept} value={row.tossDept} />
          <Row label={p.fields.apptGetter} value={row.apptGetter} />
          <Row label={p.fields.salesRep} value={row.salesRep} />
          <Row label={p.fields.referralBranch} value={row.referralBranch} />
          <Row
            label={p.fields.affiliation}
            value={p.affiliationLabels[row.affiliation] ?? row.affiliation}
          />
          <Row label={p.fields.affiliationDept} value={row.affiliationDept} />
          <Row
            label={p.fields.acquisitionChannel}
            value={p.acquisitionChannelLabels[row.acquisitionChannel] ?? row.acquisitionChannel}
          />
          <Row label={p.fields.createdAt} value={formatDateTime(row.createdAt)} />
        </dl>
      </div>
      <Link
        href="/dealer-submissions/contracts"
        className="text-primary text-sm underline-offset-4 hover:underline"
      >
        {t.backToList}
      </Link>
    </div>
  );
}
