// 代理店側：二次店が提出した成約の一覧（閲覧専用）。
//
// 登録・編集の導線は置かない。グラフ・集計も置かず、登録内容の確認だけを行う。

import Link from "next/link";

import { IntegratedViewNotice } from "@/components/layout/integrated-view-notice";
import {
  ListPageHeader,
  ListResultCount,
  ListTableCard,
  LIST_TD,
  LIST_TD_STRONG,
  LIST_TH,
} from "@/components/list/list-shell";
import { formatDate } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { listDealerContracts } from "../data";

export const dynamic = "force-dynamic";

const t = labels.dealerContractView;
const n = labels.integratedViewNotice;
const p = labels.partner.contract;

export default async function DealerContractsPage() {
  const rows = await listDealerContracts();

  return (
    <div className="space-y-4">
      <ListPageHeader title={t.listTitle} subtitle={t.listSubtitle} />

      {/* 統合先への案内。旧 URL を残したまま、同じ内容が見られる場所を示す（代理店-01）。 */}
      <IntegratedViewNotice
        body={n.contracts}
        links={[{ href: "/customers", label: n.links.customers }]}
      />
      <p className="text-mute-light text-[13px]">{t.readOnlyNote}</p>
      <ListResultCount total={rows.length} template={labels.dealerReportView.filters.resultCount} />

      <ListTableCard isEmpty={rows.length === 0} emptyTitle={t.empty} emptyBody={t.emptyCta}>
        {
          <table className="w-full text-sm">
            <thead>
              <tr className="border-hairline-light border-b">
                <th scope="col" className={LIST_TH}>
                  {t.columns.contractDate}
                </th>
                <th scope="col" className={LIST_TH}>
                  {t.columns.dealerName}
                </th>
                <th scope="col" className={LIST_TH}>
                  {t.columns.salesRep}
                </th>
                <th scope="col" className={LIST_TH}>
                  {t.columns.referralBranch}
                </th>
                <th scope="col" className={LIST_TH}>
                  {t.columns.affiliation}
                </th>
              </tr>
            </thead>
            <tbody className="divide-hairline-light divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={`${LIST_TD_STRONG} tabular-nums`}>
                    <Link
                      href={`/dealer-submissions/contracts/${r.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {formatDate(r.contractDate)}
                    </Link>
                  </td>
                  <td className={LIST_TD}>{r.dealerName}</td>
                  <td className={LIST_TD}>{r.salesRep}</td>
                  <td className={LIST_TD}>{r.referralBranch}</td>
                  <td className={LIST_TD}>{p.affiliationLabels[r.affiliation] ?? r.affiliation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      </ListTableCard>
    </div>
  );
}
