"use client";

// ローン審査一覧テーブル。行クリック / Enter・Space で該当顧客の詳細へ遷移する
// （ローン審査は顧客詳細の「ローン審査」タブで編集するため）。
// 列構成・行高・フォーカスリングは S-032 顧客一覧の customer-table.tsx と同型。

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  COL_LG,
  COL_MD,
  COL_XL,
  LIST_ROW,
  LIST_TD,
  LIST_TD_STRONG,
  LIST_TH,
} from "@/components/list/list-shell";
import { Badge } from "@/components/ui/badge";
import { labels } from "@/lib/i18n/labels";

import { loanStatusVariant } from "./constants";

import type { LoanReviewListItem } from "./data";

interface LoanReviewTableProps {
  reviews: LoanReviewListItem[];
}

export function LoanReviewTable({ reviews }: LoanReviewTableProps) {
  const t = labels.loanReviewList;
  const c = labels.customer;
  const router = useRouter();

  // 詳細確認はその顧客の顧客詳細・ローン審査タブへ。
  function goToCustomer(customerId: string) {
    router.push(`/customers/${customerId}?tab=loan`);
  }

  // 一覧の主目的は「いま審査がどこで止まっているか」。
  // 顧客・審査状態・不備・結果を常時、金融機関と担当は幅に余裕があるときに出す。
  const COL = {
    loanCompany: COL_MD,
    assignee: COL_XL,
    defectAssignee: COL_LG,
  } as const;

  // 列幅は固定（table-fixed）。会社名や氏名の長さで列位置が動かないようにする。
  const W = {
    customer: "w-[40%] lg:w-[20%]",
    assignee: "xl:w-[11%]",
    loanCompany: "md:w-[14%]",
    status: "w-[26%] lg:w-[14%]",
    defect: "w-[20%] lg:w-[12%]",
    defectAssignee: "lg:w-[11%]",
    result: "w-[14%] lg:w-[14%]",
    chevron: "lg:w-[4%]",
  } as const;

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-hairline-light bg-surface-soft/50 border-b">
            <th scope="col" className={`${LIST_TH} ${W.customer}`}>
              {t.columns.customerName}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.assignee} ${W.assignee}`}>
              {c.columns.assignee}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.loanCompany} ${W.loanCompany}`}>
              {t.columns.loanCompany}
            </th>
            <th scope="col" className={`${LIST_TH} ${W.status}`}>
              {t.columns.status}
            </th>
            <th scope="col" className={`${LIST_TH} ${W.defect}`}>
              {t.columns.defect}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.defectAssignee} ${W.defectAssignee}`}>
              {t.columns.defectAssignee}
            </th>
            <th scope="col" className={`${LIST_TH} ${W.result}`}>
              {t.columns.latestResult}
            </th>
            <th className={W.chevron} aria-hidden />
          </tr>
        </thead>
        <tbody className="divide-hairline-light divide-y">
          {reviews.map((row) => (
            <tr
              key={row.id}
              tabIndex={0}
              role="button"
              aria-label={`${row.customerName}${c.honorific} ${t.statusLabels[row.status as keyof typeof t.statusLabels] ?? row.status}`}
              className={LIST_ROW}
              onClick={() => goToCustomer(row.customerId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  goToCustomer(row.customerId);
                }
              }}
            >
              <td className={LIST_TD_STRONG}>
                {row.customerName} {c.honorific}
              </td>
              <td className={`${LIST_TD} ${COL.assignee}`}>{row.assigneeName ?? c.none}</td>
              <td className={`${LIST_TD} ${COL.loanCompany}`}>{row.loanCompany ?? t.noCompany}</td>
              {/* 審査状態が行の主 status。バッジはここ 1 つだけに絞る。 */}
              <td className={LIST_TD}>
                <Badge variant={loanStatusVariant(row.status)}>
                  {t.statusLabels[row.status as keyof typeof t.statusLabels] ?? row.status}
                </Badge>
              </td>
              {/* 不備は「あれば要対応」。色付きの文字で見つけやすくし、無い場合は控えめに。 */}
              <td className={LIST_TD}>
                {row.defectState === "none" ? (
                  <span className="text-mute-light">{t.defectPresenceLabels.no}</span>
                ) : (
                  <span className="text-danger font-medium">{t.defectPresenceLabels.yes}</span>
                )}
              </td>
              <td className={`${LIST_TD} ${COL.defectAssignee}`}>
                {row.defectAssigneeName ?? c.none}
              </td>
              {/* 最新結果は補助情報。審査状態と色を競わせない。 */}
              <td className={LIST_TD}>
                {row.latestResult ? (
                  (t.resultLabels[row.latestResult as keyof typeof t.resultLabels] ??
                  row.latestResult)
                ) : (
                  <span className="text-mute-light">{t.noResult}</span>
                )}
              </td>
              <td className={`${LIST_TD} text-right`}>
                <ChevronRight className="text-mute-light inline size-4" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
