// 二次店ポータル：初訪アポの詳細。自社が登録した顧客でなければ 404。
//
// 表示するのは初訪アポフォームの項目だけ。訪問アポは項目が違うので
// /p-appointments/visit/[id] が担当する。

import Link from "next/link";
import { notFound } from "next/navigation";

import { BackToListLink } from "@/components/partner/back-to-list-link";
import {
  PartnerCard,
  PartnerField,
  PartnerFieldGrid,
  PartnerPageHeader,
} from "@/components/partner/partner-ui";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";
import { boothAreaText } from "@/lib/partner/venue-info";

import { getPartnerFirstVisit } from "../data";

export const dynamic = "force-dynamic";

const t = labels.partner.appointment;
const c = labels.partner.common;
const kind = labels.partner.appointmentKind;

export default async function PartnerFirstVisitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getPartnerFirstVisit(id);
  if (!row) notFound();

  return (
    <div>
      <PartnerPageHeader
        title={`${t.detailTitle}（${kind.labels.FIRST_VISIT}）`}
        action={
          <Link
            href={`/p-appointments/${row.id}/edit`}
            className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 w-full items-center justify-center rounded-md border px-4 text-sm font-medium sm:h-9 sm:w-auto sm:px-3"
          >
            {c.edit}
          </Link>
        }
      />

      <div className="space-y-4">
        <PartnerCard>
          <h2 className="text-mute-light mb-3 text-xs font-semibold">{t.sections.org}</h2>
          <PartnerFieldGrid>
            <PartnerField label={t.fields.tossGetter} value={row.tossUpSalespersonName} />
            <PartnerField label={t.fields.closeCompany} value={row.closingRelationshipName} />
            <PartnerField
              label={t.fields.channel}
              value={
                row.salesChannel
                  ? (t.salesChannelLabels[row.salesChannel] ?? row.salesChannel)
                  : null
              }
            />
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
              value={row.venueChain ? (t.venueChainLabels[row.venueChain] ?? row.venueChain) : null}
            />
            {/* ブース場所は「その他」のときだけ自由記述を出す（解決は共通関数）。 */}
            <PartnerField
              label={t.fields.boothArea}
              value={boothAreaText(row, t.boothAreaLabels)}
            />
            <PartnerField
              label={t.fields.faceToFace}
              value={row.faceToFace ? (t.faceToFaceLabels[row.faceToFace] ?? null) : null}
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
        <BackToListLink href="/p-appointments" label={c.backToList} />
      </div>
    </div>
  );
}
