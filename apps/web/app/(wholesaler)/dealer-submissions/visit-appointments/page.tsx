// 代理店側：二次店が提出した訪問アポの一覧（閲覧専用）。
//
// 登録・編集の導線は置かない。編集は二次店ポータルだけが行う。

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
import { formatDateTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { listDealerVisitAppointments } from "../data";

export const dynamic = "force-dynamic";

const t = labels.dealerVisitAppointmentView;
const n = labels.integratedViewNotice;

export default async function DealerVisitAppointmentsPage() {
  const rows = await listDealerVisitAppointments();

  return (
    <div className="space-y-4">
      <ListPageHeader title={t.listTitle} subtitle={t.listSubtitle} />

      {/* 統合先への案内。旧 URL を残したまま、同じ内容が見られる場所を示す（代理店-01）。 */}
      <IntegratedViewNotice
        body={n.visitAppointments}
        links={[
          { href: "/customers", label: n.links.customers },
          { href: "/appointments", label: n.links.appointments },
        ]}
      />
      <p className="text-mute-light text-[13px]">{t.readOnlyNote}</p>
      <ListResultCount total={rows.length} template={labels.dealerReportView.filters.resultCount} />

      <ListTableCard isEmpty={rows.length === 0} emptyTitle={t.empty} emptyBody={t.emptyCta}>
        {
          <table className="w-full text-sm">
            <thead>
              <tr className="border-hairline-light border-b">
                <th scope="col" className={LIST_TH}>
                  {t.columns.createdAt}
                </th>
                <th scope="col" className={LIST_TH}>
                  {t.columns.dealerName}
                </th>
                <th scope="col" className={LIST_TH}>
                  {t.columns.closeDept}
                </th>
                <th scope="col" className={LIST_TH}>
                  {t.columns.salesRep}
                </th>
              </tr>
            </thead>
            <tbody className="divide-hairline-light divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={`${LIST_TD_STRONG} tabular-nums`}>
                    <Link
                      href={`/dealer-submissions/visit-appointments/${r.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {formatDateTime(r.createdAt)}
                    </Link>
                  </td>
                  <td className={LIST_TD}>{r.dealerName}</td>
                  <td className={LIST_TD}>{r.closeDept}</td>
                  <td className={LIST_TD}>{r.salesRep}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      </ListTableCard>
    </div>
  );
}
