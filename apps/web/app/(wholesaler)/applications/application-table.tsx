"use client";

// 設置申請一覧テーブル。行クリック / Enter・Space で既存の契約配下 設置申請画面
// （/contracts/[id]/application）へ遷移する。
// 列構成・行高・フォーカスリングは S-032 顧客一覧の customer-table.tsx と同型。
// 申請状態バッジは顧客一覧の subsidyVariant を再利用し、色が食い違わないようにする。

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

import { subsidyVariant } from "../customers/customer-table";

import type { ApplicationListItem } from "./data";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

interface ApplicationTableProps {
  applications: ApplicationListItem[];
}

export function ApplicationTable({ applications }: ApplicationTableProps) {
  const t = labels.applicationList;
  const c = labels.customer;
  const router = useRouter();

  function goToDetail(contractId: string) {
    router.push(`/contracts/${contractId}/application`);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-hairline-light bg-surface-soft/50 border-b">
            <th className={LIST_TH}>{t.columns.plannedDate}</th>
            <th className={LIST_TH}>{t.columns.customerName}</th>
            <th className={LIST_TH}>{t.columns.assignee}</th>
            <th className={LIST_TH}>{t.columns.type}</th>
            <th className={LIST_TH}>{t.columns.status}</th>
            <th className={LIST_TH}>{t.columns.submittedDate}</th>
            <th className={LIST_TH}>{t.columns.approvedDate}</th>
            <th className={LIST_TH}>{t.columns.files}</th>
            <th className="w-10 px-3 py-3" aria-hidden />
          </tr>
        </thead>
        <tbody className="divide-hairline-light divide-y">
          {applications.map((row) => (
            <tr
              key={row.id}
              tabIndex={0}
              role="button"
              aria-label={`${row.customerName}${c.honorific} ${row.type}`}
              className={LIST_ROW}
              onClick={() => goToDetail(row.contractId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  goToDetail(row.contractId);
                }
              }}
            >
              <td className={LIST_TD_NUM}>{formatDate(row.plannedDate) ?? c.none}</td>
              <td className={LIST_TD_STRONG}>
                {row.customerName} {c.honorific}
              </td>
              <td className={LIST_TD}>{row.assigneeName ?? c.none}</td>
              <td className={LIST_TD}>
                {row.type || t.noType}
                {row.agency ? (
                  <span className="text-mute-light ml-2 text-xs">{row.agency}</span>
                ) : null}
              </td>
              <td className="whitespace-nowrap px-6 py-3">
                <Badge variant={subsidyVariant(row.status)}>
                  {c.subsidyStatusLabels[row.status]}
                </Badge>
              </td>
              <td className={LIST_TD_NUM}>
                {formatDate(row.submittedDate) ?? (
                  <span className="text-mute-light text-xs">{t.notSubmitted}</span>
                )}
              </td>
              <td className={LIST_TD_NUM}>
                {formatDate(row.approvedDate) ?? (
                  <span className="text-mute-light text-xs">{t.notApproved}</span>
                )}
              </td>
              <td className={LIST_TD_NUM}>
                {row.fileCount > 0 ? (
                  t.fileCount.replace("{n}", String(row.fileCount))
                ) : (
                  <span className="text-mute-light text-xs">{t.noFiles}</span>
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
