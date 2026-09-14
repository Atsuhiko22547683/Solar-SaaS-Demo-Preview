// 二次店ポータル：アポイントの詳細。自社が登録した顧客でなければ 404。

import Link from "next/link";
import { notFound } from "next/navigation";

import {
  PartnerCard,
  PartnerField,
  PartnerFieldGrid,
  PartnerPageHeader,
} from "@/components/partner/partner-ui";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";
import { boothAreaText } from "@/lib/partner/venue-info";

import { getPartnerAppointment } from "../data";

export const dynamic = "force-dynamic";

const t = labels.partner.appointment;
const c = labels.partner.common;
const r = labels.partner.report;

export default async function PartnerAppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getPartnerAppointment(id);
  if (!row) notFound();

  return (
    <div>
      <PartnerPageHeader
        title={t.detailTitle}
        action={
          <Link
            href={`/p-appointments/${row.id}/edit`}
            className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium"
          >
            {c.edit}
          </Link>
        }
      />

      <div className="space-y-4">
        <PartnerCard>
          <h2 className="text-mute-light mb-3 text-xs font-semibold">{t.sections.org}</h2>
          <PartnerFieldGrid>
            <PartnerField label={t.fields.tossDept} value={row.tossDept} />
            <PartnerField
              label={t.fields.channel}
              value={
                row.salesChannel
                  ? (labels.customer.detail.salesChannelLabels[
                      row.salesChannel as keyof typeof labels.customer.detail.salesChannelLabels
                    ] ?? row.salesChannel)
                  : null
              }
            />
            <PartnerField label={t.fields.tossGetter} value={row.tossUpSalespersonName} />
            <PartnerField label={t.fields.salesRep} value={row.closingSalespersonName} />
          </PartnerFieldGrid>
        </PartnerCard>

        <PartnerCard>
          <h2 className="text-mute-light mb-3 flex items-center gap-2 text-xs font-semibold">
            {t.sections.event}
            {row.venueFromEvent ? (
              <span className="border-hairline-light text-mute-light rounded-sm border px-1 text-[10px] font-normal">
                {t.fromEventBadge}
              </span>
            ) : null}
          </h2>
          <PartnerFieldGrid>
            <PartnerField
              label={t.fields.eventDate}
              value={row.eventDate ? formatDate(row.eventDate) : null}
            />
            <PartnerField label={t.fields.venuePlace} value={row.venuePlace} />
            <PartnerField
              label={t.fields.eventType}
              value={
                row.venueChain
                  ? (r.venueChainLabels[row.venueChain as keyof typeof r.venueChainLabels] ??
                    row.venueChain)
                  : null
              }
            />
            {/* ブース場所は「その他」のときだけ自由記述を出す（解決は共通関数）。 */}
            <PartnerField
              label={t.fields.boothArea}
              value={boothAreaText(row, t.boothAreaLabels)}
            />
            <PartnerField
              label={t.fields.faceToFace}
              value={
                row.faceToFace === "SOVEREIGN"
                  ? labels.customer.detail.faceToFaceLabels.sovereign
                  : row.faceToFace === "NON_SOVEREIGN"
                    ? labels.customer.detail.faceToFaceLabels.nonSovereign
                    : null
              }
            />
          </PartnerFieldGrid>
        </PartnerCard>

        <PartnerCard>
          <h2 className="text-mute-light mb-3 text-xs font-semibold">{t.sections.customer}</h2>
          <PartnerFieldGrid>
            <PartnerField label={t.fields.customerName} value={row.name} />
            <PartnerField label={t.fields.kana} value={row.kana} />
            <PartnerField label={t.fields.landline} value={row.landlinePhone} />
            <PartnerField label={t.fields.mobile} value={row.mobilePhone} />
            <PartnerField label={t.fields.postalCode} value={row.postalCode} />
            <PartnerField label={t.fields.prefecture} value={row.prefecture} />
            <PartnerField label={t.fields.cityAddress} value={row.cityAddress} />
          </PartnerFieldGrid>
        </PartnerCard>

        <PartnerCard>
          <h2 className="text-mute-light mb-3 text-xs font-semibold">{t.sections.appointment}</h2>
          <PartnerFieldGrid>
            <PartnerField
              label={t.fields.maekakuPreferredAt}
              value={row.maekakuPreferredAt ? formatDateTime(row.maekakuPreferredAt) : null}
            />
            <PartnerField label={t.fields.maekakuOperator} value={row.maekakuOperator} />
            <PartnerField
              label={t.fields.firstVisitAt}
              value={row.firstVisitAt ? formatDateTime(row.firstVisitAt) : null}
            />
            <PartnerField label={t.fields.createdAt} value={formatDateTime(row.createdAt)} />
          </PartnerFieldGrid>
        </PartnerCard>

        <PartnerCard>
          <h2 className="text-mute-light mb-2 text-xs font-semibold">{t.sections.note}</h2>
          <p className="text-ink whitespace-pre-wrap text-sm">
            {row.note ?? <span className="text-mute-light">{c.dash}</span>}
          </p>
        </PartnerCard>
      </div>

      <div className="mt-4">
        <Link
          href="/p-appointments"
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          {c.backToList}
        </Link>
      </div>
    </div>
  );
}
