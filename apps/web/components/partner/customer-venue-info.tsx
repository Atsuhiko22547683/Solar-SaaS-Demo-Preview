// 代理店側の顧客詳細に出す「二次店が登録した催事情報」（読み取り専用）。
//
// 二次店ポータルから登録されたアポイントの催事欄を、代理店が確認できるようにする
// ための最小表示。編集は二次店ポータルだけが行うので、ここに導線は置かない。
//
// 催事情報の解決（イベント由来か直接入力か）は lib/partner/venue-info.ts が行い、
// この部品は受け取った結果を描くだけ。
//
// "use client" は付けない（Server Component から直接描く）。

import { formatDate } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";
import { boothAreaText, type ResolvedVenueInfo } from "@/lib/partner/venue-info";

const t = labels.customerVenueInfo;

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-mute-light text-xs">{label}</dt>
      <dd className="text-ink mt-0.5 break-words text-sm">
        {value && value.length > 0 ? value : <span className="text-mute-light">—</span>}
      </dd>
    </div>
  );
}

export function CustomerVenueInfo({ venue }: { venue: ResolvedVenueInfo | null }) {
  // 催事情報が 1 つも無い顧客（代理店が直接登録した顧客など）には何も出さない。
  const hasAny =
    venue && (venue.eventDate || venue.venuePlace || venue.venueChain || venue.boothArea);

  return (
    <section>
      <h2 className="text-ink mb-3 flex items-center gap-2 text-sm font-semibold">
        {t.section}
        {hasAny ? (
          <span className="border-hairline-light text-mute-light rounded-sm border px-1 text-[10px] font-normal">
            {venue.fromEvent ? t.fromEvent : t.directInput}
          </span>
        ) : null}
      </h2>

      {hasAny ? (
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Row
            label={t.fields.eventDate}
            value={venue.eventDate ? formatDate(venue.eventDate) : null}
          />
          <Row label={t.fields.venuePlace} value={venue.venuePlace} />
          <Row
            label={t.fields.venueChain}
            value={
              venue.venueChain
                ? (labels.partner.report.venueChainLabels[
                    venue.venueChain as keyof typeof labels.partner.report.venueChainLabels
                  ] ?? venue.venueChain)
                : null
            }
          />
          <Row
            label={t.fields.boothArea}
            value={boothAreaText(venue, labels.partner.appointment.boothAreaLabels)}
          />
        </dl>
      ) : (
        <p className="text-mute-light text-[13px]">{t.empty}</p>
      )}
    </section>
  );
}
