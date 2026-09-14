// 二次店ポータル：自社に所属する販売員の一覧。

import Link from "next/link";

import {
  P_TD,
  P_TH,
  PartnerCard,
  PartnerEmpty,
  PartnerPageHeader,
  PartnerRowLink,
} from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";

import { listPartnerSalespeople } from "./data";

export const dynamic = "force-dynamic";

const t = labels.partner.salesperson;
const c = labels.partner.common;

export default async function PartnerSalespeoplePage() {
  const rows = await listPartnerSalespeople();

  return (
    <div>
      <PartnerPageHeader
        title={t.listTitle}
        action={
          <Link
            href="/p-salespeople/new"
            className="bg-primary focus-visible:ring-primary/40 inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-white focus:outline-none focus-visible:ring-2"
          >
            {labels.partner.home.cards.salespeople.action}
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
                    {t.columns.name}
                  </th>
                  {/* 補助列は狭い画面では落とす（横スクロールを作らない）。 */}
                  <th scope="col" className={`${P_TH} hidden sm:table-cell`}>
                    {t.columns.kana}
                  </th>
                  <th scope="col" className={`${P_TH} hidden md:table-cell`}>
                    {t.columns.phone}
                  </th>
                  <th scope="col" className={`${P_TH} hidden md:table-cell`}>
                    {t.columns.employmentType}
                  </th>
                  <th scope="col" className={P_TH}>
                    {t.fields.isActive}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-hairline-light divide-y">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className={P_TD}>
                      <PartnerRowLink href={`/p-salespeople/${r.id}`}>{r.name}</PartnerRowLink>
                    </td>
                    <td className={`${P_TD} hidden sm:table-cell`}>{r.kana ?? c.dash}</td>
                    <td className={`${P_TD} hidden md:table-cell`}>{r.phone ?? c.dash}</td>
                    <td className={`${P_TD} hidden md:table-cell`}>
                      {r.employmentType
                        ? (t.employmentTypeLabels[
                            r.employmentType as keyof typeof t.employmentTypeLabels
                          ] ?? r.employmentType)
                        : c.dash}
                    </td>
                    <td className={P_TD}>
                      {r.isActive ? t.activeLabels.active : t.activeLabels.inactive}
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
