// 二次店ポータル：商品詳細（閲覧専用）。公開範囲外・無効な商品は 404。

import { notFound } from "next/navigation";

import { BackToListLink } from "@/components/partner/back-to-list-link";
import {
  PartnerCard,
  PartnerField,
  PartnerFieldGrid,
  PartnerPageHeader,
} from "@/components/partner/partner-ui";
import { formatDate } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { getPartnerCatalogItem } from "../data";
import { formatYen } from "../format";

export const dynamic = "force-dynamic";

const t = labels.partner.catalog;
const c = labels.partner.common;

export default async function PartnerCatalogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getPartnerCatalogItem(id);
  if (!row) notFound();

  return (
    <div>
      <PartnerPageHeader title={t.detailTitle} />

      <PartnerCard>
        <PartnerFieldGrid>
          <PartnerField label={t.fields.name} value={row.name} />
          <PartnerField
            label={t.fields.category}
            value={t.categoryLabels[row.category] ?? row.category}
          />
          <PartnerField label={t.fields.maker} value={row.maker} />
          <PartnerField label={t.fields.series} value={row.series} />
          <PartnerField label={t.fields.modelNo} value={row.modelNo} />
          <PartnerField
            label={t.fields.capacity}
            value={row.capacity ? `${row.capacity} ${row.unit}` : null}
          />
          {row.batteryFunctionType ? (
            <PartnerField
              label={t.fields.batteryFunctionType}
              value={
                t.batteryFunctionTypeLabels[row.batteryFunctionType] ?? row.batteryFunctionType
              }
            />
          ) : null}
          {row.warrantyYears !== null ? (
            <PartnerField label={t.fields.warrantyYears} value={`${row.warrantyYears}年`} />
          ) : null}
          <PartnerField label={t.fields.dealerPrice} value={formatYen(row.dealerPrice)} />
          <PartnerField label={t.fields.listPrice} value={formatYen(row.listPrice)} />
          <PartnerField label={t.fields.effectiveFrom} value={formatDate(row.effectiveFrom)} />
          <PartnerField
            label={t.fields.effectiveTo}
            value={row.effectiveTo ? formatDate(row.effectiveTo) : null}
          />
        </PartnerFieldGrid>
        {row.note ? <p className="text-ink mt-4 whitespace-pre-wrap text-sm">{row.note}</p> : null}
        {/* 資料添付の仕組みが無いことを明示し、「ダウンロードが無い」を不具合と誤解させない。 */}
        <p className="text-mute-light mt-4 text-xs">{t.noDocumentsNote}</p>
      </PartnerCard>

      <div className="mt-4">
        <BackToListLink href="/p-catalog" label={c.backToList} />
      </div>
    </div>
  );
}
