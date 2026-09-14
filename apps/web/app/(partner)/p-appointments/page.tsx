// 二次店ポータル：自社が登録したアポイントの一覧。

import Link from "next/link";

import {
  P_TD,
  P_TH,
  PartnerCard,
  PartnerEmpty,
  PartnerPageHeader,
  PartnerRowLink,
} from "@/components/partner/partner-ui";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { listPartnerAppointments } from "./data";

export const dynamic = "force-dynamic";

const t = labels.partner.appointment;
const c = labels.partner.common;

export default async function PartnerAppointmentsPage() {
  const rows = await listPartnerAppointments();

  return (
    <div>
      <PartnerPageHeader
        title={t.listTitle}
        action={
          <Link
            href="/p-appointments/new"
            className="bg-primary focus-visible:ring-primary/40 inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-white focus:outline-none focus-visible:ring-2"
          >
            {labels.partner.home.cards.appointments.action}
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
                    {t.columns.customerName}
                  </th>
                  <th scope="col" className={P_TH}>
                    {t.columns.firstVisitAt}
                  </th>
                  <th scope="col" className={`${P_TH} hidden sm:table-cell`}>
                    {t.columns.venuePlace}
                  </th>
                  <th scope="col" className={`${P_TH} hidden md:table-cell`}>
                    {t.columns.createdAt}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-hairline-light divide-y">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className={P_TD}>
                      <PartnerRowLink href={`/p-appointments/${r.id}`}>
                        {r.customerName}
                      </PartnerRowLink>
                    </td>
                    <td className={`${P_TD} tabular-nums`}>
                      {r.firstVisitAt ? formatDateTime(r.firstVisitAt) : c.dash}
                    </td>
                    <td className={`${P_TD} hidden sm:table-cell`}>{r.venuePlace ?? c.dash}</td>
                    <td className={`${P_TD} hidden tabular-nums md:table-cell`}>
                      {formatDate(r.createdAt)}
                    </td>
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
