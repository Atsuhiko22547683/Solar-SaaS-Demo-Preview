// 二次店ポータル：訪問アポの詳細。自社が登録した行でなければ 404。
//
// 表示するのは訪問アポフォームの 5 項目だけ。初訪アポとは項目が違うので
// 画面も分ける（アポ区分は登録後に変更できない）。

import Link from "next/link";
import { notFound } from "next/navigation";

import { BackToListLink } from "@/components/partner/back-to-list-link";
import {
  PartnerCard,
  PartnerField,
  PartnerFieldGrid,
  PartnerPageHeader,
} from "@/components/partner/partner-ui";
import { formatDateTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { getPartnerVisit } from "../../data";

export const dynamic = "force-dynamic";

const t = labels.partner.visitAppointment;
const a = labels.partner.appointment;
const c = labels.partner.common;

export default async function PartnerVisitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getPartnerVisit(id);
  if (!row) notFound();

  return (
    <div>
      <PartnerPageHeader
        title={t.detailTitle}
        action={
          <Link
            href={`/p-appointments/visit/${row.id}/edit`}
            className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 w-full items-center justify-center rounded-md border px-4 text-sm font-medium sm:h-9 sm:w-auto sm:px-3"
          >
            {c.edit}
          </Link>
        }
      />

      <PartnerCard>
        <PartnerFieldGrid>
          <PartnerField label={t.fields.tossDept} value={row.tossDept} />
          <PartnerField label={t.fields.maekakuOperator} value={row.maekakuOperator} />
          <PartnerField label={t.fields.closeDept} value={row.closeDept} />
          <PartnerField label={t.fields.salesRep} value={row.salespersonName} />
          <PartnerField
            label={t.fields.channel}
            value={a.salesChannelLabels[row.salesChannel] ?? row.salesChannel}
          />
          <PartnerField label={t.fields.createdAt} value={formatDateTime(row.createdAt)} />
        </PartnerFieldGrid>
      </PartnerCard>

      <div className="mt-4">
        <BackToListLink href="/p-appointments" label={c.backToList} />
      </div>
    </div>
  );
}
