// 催事日報の詳細表示。
//
// 二次店ポータル（編集導線あり）と代理店側の読み取り専用画面で同じ内容を出すため、
// 表示部分だけをここに切り出す。合計は保存していないので、渡ってきた算出値を使う。
//
// "use client" は付けない（Server Component から直接描く）。

import { PartnerCard, PartnerField, PartnerFieldGrid } from "@/components/partner/partner-ui";
import { formatDate } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

const t = labels.partner.report;

export interface ReportDetailViewData {
  eventDate: string;
  venuePlace: string;
  category: string;
  venueChain: string;
  areaInFacility: string;
  startTime: string;
  endTime: string;
  lotteryBoth: number;
  lotterySingle: number;
  seatedBoth: number;
  seatedSingle: number;
  apptBoth: number;
  apptSingle: number;
  lotteryTotal: number;
  seatedTotal: number;
  apptTotal: number;
  cainzPayCount: number | null;
  impression: string | null;
}

const TH = "px-3 py-2 text-left text-xs font-semibold text-mute-light";
const TD = "px-3 py-2 text-sm text-body-light text-right tabular-nums";

export function ReportDetailView({ data }: { data: ReportDetailViewData }) {
  const rows = [
    {
      label: t.metrics.lottery,
      both: data.lotteryBoth,
      single: data.lotterySingle,
      total: data.lotteryTotal,
    },
    {
      label: t.metrics.seated,
      both: data.seatedBoth,
      single: data.seatedSingle,
      total: data.seatedTotal,
    },
    {
      label: t.metrics.appointment,
      both: data.apptBoth,
      single: data.apptSingle,
      total: data.apptTotal,
    },
  ];

  return (
    <div className="space-y-4">
      <PartnerCard>
        <h2 className="text-mute-light mb-3 text-xs font-semibold">{t.sections.basic}</h2>
        <PartnerFieldGrid>
          <PartnerField label={t.fields.eventDate} value={formatDate(data.eventDate)} />
          <PartnerField label={t.fields.venuePlace} value={data.venuePlace} />
          <PartnerField
            label={t.fields.category}
            value={
              t.categoryLabels[data.category as keyof typeof t.categoryLabels] ?? data.category
            }
          />
          <PartnerField
            label={t.fields.venueChain}
            value={
              t.venueChainLabels[data.venueChain as keyof typeof t.venueChainLabels] ??
              data.venueChain
            }
          />
          <PartnerField label={t.fields.areaInFacility} value={data.areaInFacility} />
          <PartnerField
            label={`${t.fields.startTime} / ${t.fields.endTime}`}
            value={`${data.startTime} 〜 ${data.endTime}`}
          />
        </PartnerFieldGrid>
      </PartnerCard>

      <PartnerCard className="overflow-hidden p-0">
        <h2 className="text-mute-light border-hairline-light border-b px-4 py-3 text-xs font-semibold">
          {t.sections.performance}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-soft/50">
              <tr className="border-hairline-light border-b">
                <th scope="col" className={TH} />
                <th scope="col" className={`${TH} text-right`}>
                  {t.metrics.both}
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  {t.metrics.single}
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  {t.metrics.total}
                </th>
              </tr>
            </thead>
            <tbody className="divide-hairline-light divide-y">
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row" className="text-ink px-3 py-2 text-left text-sm font-medium">
                    {r.label}
                  </th>
                  <td className={TD}>{r.both}</td>
                  <td className={TD}>{r.single}</td>
                  <td className={`${TD} text-ink font-semibold`}>{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-hairline-light border-t px-4 py-3">
          <PartnerField
            label={t.fields.cainzPayCount}
            value={data.cainzPayCount === null ? null : String(data.cainzPayCount)}
          />
        </div>
      </PartnerCard>

      <PartnerCard>
        <h2 className="text-mute-light mb-2 text-xs font-semibold">{t.sections.impression}</h2>
        <p className="text-ink whitespace-pre-wrap text-sm">
          {data.impression ?? <span className="text-mute-light">{labels.partner.common.dash}</span>}
        </p>
      </PartnerCard>
    </div>
  );
}
