// 代理店側：二次店が提出した催事日報の一覧（閲覧専用）。
//
// 登録・編集の導線は置かない。編集は二次店ポータルだけが行う。

import Link from "next/link";

import { IntegratedViewNotice } from "@/components/layout/integrated-view-notice";
import {
  ListFilterCard,
  ListPageHeader,
  ListResultCount,
  ListTableCard,
  LIST_TD,
  LIST_TD_NUM,
  LIST_TD_STRONG,
  LIST_TH,
} from "@/components/list/list-shell";
import { formatDate } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { listDealerOptions, listDealerReports } from "./data";

export const dynamic = "force-dynamic";

const t = labels.dealerReportView;
const n = labels.integratedViewNotice;
const r = labels.partner.report;

interface PageProps {
  searchParams: Promise<{ dealer?: string }>;
}

export default async function DealerReportsPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const dealers = await listDealerOptions();
  // 値域外は絞り込みなしへ落とす（URL 直打ちで where を壊さない）。
  const relationshipId = dealers.some((d) => d.id === sp.dealer) ? sp.dealer : undefined;
  const rows = await listDealerReports({ relationshipId });

  return (
    <div className="space-y-6">
      <ListPageHeader title={t.listTitle} subtitle={t.listSubtitle} />

      {/* 統合先への案内。旧 URL を残したまま、同じ内容が見られる場所を示す（代理店-01）。 */}
      <IntegratedViewNotice
        body={n.dealerReports}
        links={[{ href: "/events", label: n.links.events }]}
      />

      <ListFilterCard>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="dealer" className="text-mute-light text-xs font-semibold">
              {t.filters.dealer}
            </label>
            <select
              id="dealer"
              name="dealer"
              defaultValue={relationshipId ?? ""}
              className="border-ash-light text-body-light focus:border-primary focus:ring-primary/40 h-9 rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2"
            >
              <option value="">{t.filters.all}</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="bg-primary inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-white"
          >
            {labels.common.search}
          </button>
        </form>
      </ListFilterCard>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListResultCount total={rows.length} template={t.filters.resultCount} />
        <p className="text-mute-light text-[13px]">{t.readOnlyNote}</p>
      </div>

      <ListTableCard isEmpty={rows.length === 0} emptyTitle={t.empty} emptyBody={t.emptyCta}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-hairline-light bg-surface-soft/50 border-b">
                <th scope="col" className={LIST_TH}>
                  {t.columns.eventDate}
                </th>
                <th scope="col" className={LIST_TH}>
                  {t.columns.dealerName}
                </th>
                <th scope="col" className={`${LIST_TH} hidden sm:table-cell`}>
                  {t.columns.venuePlace}
                </th>
                <th scope="col" className={`${LIST_TH} hidden md:table-cell`}>
                  {t.columns.venueChain}
                </th>
                <th scope="col" className={`${LIST_TH} text-right`}>
                  {t.columns.apptTotal}
                </th>
              </tr>
            </thead>
            <tbody className="divide-hairline-light divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className={LIST_TD_NUM}>
                    <Link
                      href={`/dealer-reports/${row.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {formatDate(row.eventDate)}
                    </Link>
                  </td>
                  <td className={LIST_TD_STRONG}>{row.dealerName}</td>
                  <td className={`${LIST_TD} hidden sm:table-cell`}>{row.venuePlace}</td>
                  <td className={`${LIST_TD} hidden md:table-cell`}>
                    {r.venueChainLabels[row.venueChain as keyof typeof r.venueChainLabels] ??
                      row.venueChain}
                  </td>
                  <td className={`${LIST_TD_NUM} text-right`}>{row.apptTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ListTableCard>
    </div>
  );
}
