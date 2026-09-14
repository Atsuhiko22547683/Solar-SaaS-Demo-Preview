// 二次店ポータル：自社が登録した催事日報の一覧。

import Link from "next/link";

import {
  P_TD,
  P_TH,
  PartnerCard,
  PartnerEmpty,
  PartnerPageHeader,
  PartnerRowLink,
} from "@/components/partner/partner-ui";
import { formatDate } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { listPartnerReports } from "./data";

export const dynamic = "force-dynamic";

const t = labels.partner.report;
const c = labels.partner.common;

export default async function PartnerReportsPage() {
  const rows = await listPartnerReports();

  return (
    <div>
      <PartnerPageHeader
        title={t.listTitle}
        action={
          <Link
            href="/p-reports/new"
            className="bg-primary focus-visible:ring-primary/40 inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-white focus:outline-none focus-visible:ring-2"
          >
            {labels.partner.home.cards.reports.action}
          </Link>
        }
      />

      <p className="text-mute-light mb-3 text-sm">
        {c.resultCount.replace("{total}", String(rows.length))}
      </p>

      <PartnerCard className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <div className="px-4">
            <PartnerEmpty title={t.empty} body={t.emptyCta} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-soft/50">
                <tr className="border-hairline-light border-b">
                  <th scope="col" className={P_TH}>
                    {t.columns.eventDate}
                  </th>
                  <th scope="col" className={P_TH}>
                    {t.columns.venuePlace}
                  </th>
                  <th scope="col" className={`${P_TH} hidden sm:table-cell`}>
                    {t.columns.venueChain}
                  </th>
                  <th scope="col" className={`${P_TH} text-right`}>
                    {t.columns.apptTotal}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-hairline-light divide-y">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className={`${P_TD} tabular-nums`}>
                      <PartnerRowLink href={`/p-reports/${r.id}`}>
                        {formatDate(r.eventDate)}
                      </PartnerRowLink>
                    </td>
                    <td className={P_TD}>{r.venuePlace}</td>
                    <td className={`${P_TD} hidden sm:table-cell`}>
                      {t.venueChainLabels[r.venueChain as keyof typeof t.venueChainLabels] ??
                        r.venueChain}
                    </td>
                    <td className={`${P_TD} text-right tabular-nums`}>{r.apptTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PartnerCard>
    </div>
  );
}
