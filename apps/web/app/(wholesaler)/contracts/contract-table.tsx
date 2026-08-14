"use client";

// 契約一覧テーブル。行クリック / Enter・Space で既存の契約詳細（/contracts/[id]）へ遷移する。
// 列構成・行高・フォーカスリングは S-032 顧客一覧の customer-table.tsx と同型。
// 施工 / 設置申請のバッジは顧客一覧と同じ配色関数を再利用し、両画面で色が食い違わないようにする。

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

import { contractStatusVariant } from "./constants";
import { constructionVariant, subsidyVariant } from "../customers/customer-table";

import type { ContractListItem } from "./data";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** 契約金額（Decimal 文字列）→ "¥3,500,000"。小数は切り捨てず整数部のみ表示する。 */
function formatAmount(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

interface ContractTableProps {
  contracts: ContractListItem[];
}

export function ContractTable({ contracts }: ContractTableProps) {
  const t = labels.contract.list;
  const c = labels.customer;
  const router = useRouter();

  function goToDetail(id: string) {
    router.push(`/contracts/${id}`);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-hairline-light bg-surface-soft/50 border-b">
            <th className={LIST_TH}>{t.columns.contractDate}</th>
            <th className={LIST_TH}>{t.columns.customerName}</th>
            <th className={LIST_TH}>{t.columns.assignee}</th>
            <th className={LIST_TH}>{t.columns.status}</th>
            <th className={LIST_TH}>{t.columns.contractAmount}</th>
            <th className={LIST_TH}>{t.columns.construction}</th>
            <th className={LIST_TH}>{t.columns.subsidy}</th>
            <th className="w-10 px-3 py-3" aria-hidden />
          </tr>
        </thead>
        <tbody className="divide-hairline-light divide-y">
          {contracts.map((row) => (
            <tr
              key={row.id}
              tabIndex={0}
              role="button"
              aria-label={`${row.customerName}${c.honorific} ${formatDate(row.contractDate)}`}
              className={LIST_ROW}
              onClick={() => goToDetail(row.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  goToDetail(row.id);
                }
              }}
            >
              <td className={LIST_TD_NUM}>{formatDate(row.contractDate)}</td>
              <td className={LIST_TD_STRONG}>
                {row.customerName} {c.honorific}
              </td>
              <td className={LIST_TD}>{row.assigneeName ?? c.none}</td>
              <td className="whitespace-nowrap px-6 py-3">
                <Badge variant={contractStatusVariant(row.status)}>
                  {labels.contract.statuses[row.status]}
                </Badge>
              </td>
              <td className="text-ink whitespace-nowrap px-6 py-3 text-right tabular-nums">
                {formatAmount(row.contractAmount)}
              </td>
              <td className="whitespace-nowrap px-6 py-3">
                {row.constructionStatus ? (
                  <Badge variant={constructionVariant(row.constructionStatus)}>
                    {c.constructionStatusLabels[row.constructionStatus]}
                  </Badge>
                ) : (
                  <span className="text-mute-light text-xs">{t.noConstruction}</span>
                )}
              </td>
              <td className="whitespace-nowrap px-6 py-3">
                {row.subsidyStatus ? (
                  <Badge variant={subsidyVariant(row.subsidyStatus)}>
                    {c.subsidyStatusLabels[row.subsidyStatus]}
                  </Badge>
                ) : (
                  <span className="text-mute-light text-xs">{t.noApplication}</span>
                )}
              </td>
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
