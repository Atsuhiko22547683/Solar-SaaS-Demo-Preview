"use client";

// ローン審査一覧テーブル。行クリック / Enter・Space で該当顧客の詳細へ遷移する
// （ローン審査は顧客詳細の「ローン審査」タブで編集するため）。
// 列構成・行高・フォーカスリングは S-032 顧客一覧の customer-table.tsx と同型。

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  LIST_ROW,
  LIST_TD,
  LIST_TD_NUM,
  LIST_TD_STRONG,
  LIST_TH,
} from "@/components/list/list-shell";
import { Badge } from "@/components/ui/badge";
import { labels } from "@/lib/i18n/labels";

import { defectVariant, loanResultVariant, loanStatusVariant } from "./constants";

import type { LoanReviewListItem } from "./data";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

interface LoanReviewTableProps {
  reviews: LoanReviewListItem[];
}

export function LoanReviewTable({ reviews }: LoanReviewTableProps) {
  const t = labels.loanReviewList;
  const c = labels.customer;
  const router = useRouter();

  function goToCustomer(customerId: string) {
    router.push(`/customers/${customerId}`);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-hairline-light bg-surface-soft/50 border-b">
            <th className={LIST_TH}>{t.columns.customerName}</th>
            <th className={LIST_TH}>{c.columns.assignee}</th>
            <th className={LIST_TH}>{t.columns.loanCompany}</th>
            <th className={LIST_TH}>{t.columns.status}</th>
            <th className={LIST_TH}>{t.columns.defect}</th>
            <th className={LIST_TH}>{t.columns.defectAssignee}</th>
            <th className={LIST_TH}>{t.columns.latestResult}</th>
            <th className={LIST_TH}>{t.columns.updatedAt}</th>
            <th className="w-10 px-3 py-3" aria-hidden />
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
              <td className={LIST_TD}>{row.assigneeName ?? c.none}</td>
              <td className={LIST_TD}>{row.loanCompany ?? t.noCompany}</td>
              <td className="whitespace-nowrap px-6 py-3">
                <Badge variant={loanStatusVariant(row.status)}>
                  {t.statusLabels[row.status as keyof typeof t.statusLabels] ?? row.status}
                </Badge>
              </td>
              <td className="whitespace-nowrap px-6 py-3">
                <Badge variant={defectVariant(row.defectState)}>
                  {t.defectLabels[row.defectState]}
                </Badge>
              </td>
              <td className={LIST_TD}>{row.defectAssigneeName ?? c.none}</td>
              <td className="whitespace-nowrap px-6 py-3">
                {row.latestResult ? (
                  <Badge variant={loanResultVariant(row.latestResult)}>
                    {t.resultLabels[row.latestResult as keyof typeof t.resultLabels] ??
                      row.latestResult}
                  </Badge>
                ) : (
                  <span className="text-mute-light text-xs">{t.noResult}</span>
                )}
              </td>
              <td className={LIST_TD_NUM}>{formatDate(row.updatedAt)}</td>
              <td className="px-3 py-3 text-right">
                <ChevronRight className="text-mute-light inline size-4" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
