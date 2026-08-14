"use client";

// 施工一覧テーブル。行クリック / Enter・Space で既存の契約配下 施工画面
// （/contracts/[id]/construction）へ遷移する。
// 列構成・行高・フォーカスリングは S-032 顧客一覧の customer-table.tsx と同型。
// 施工状態バッジは顧客一覧の constructionVariant を再利用し、色が食い違わないようにする。

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

import { constructionVariant } from "../customers/customer-table";

import type { ConstructionListItem } from "./data";
import type { SurveyStatusValue } from "../customers/constants";
import type { BadgeVariant } from "@/components/ui/badge";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** 現地調査: 実施済=成功 / 予定日確定=進行中 / 調査前=灰。 */
function surveyVariant(v: SurveyStatusValue): BadgeVariant {
  switch (v) {
    case "surveyed":
      return "success";
    case "scheduled":
      return "default";
    case "not_surveyed":
      return "secondary";
  }
}

interface ConstructionTableProps {
  constructions: ConstructionListItem[];
}

export function ConstructionTable({ constructions }: ConstructionTableProps) {
  const t = labels.constructionList;
  const c = labels.customer;
  const router = useRouter();

  function goToDetail(contractId: string) {
    router.push(`/contracts/${contractId}/construction`);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-hairline-light bg-surface-soft/50 border-b">
            <th className={LIST_TH}>{t.columns.plannedDate}</th>
            <th className={LIST_TH}>{t.columns.customerName}</th>
            <th className={LIST_TH}>{t.columns.assignee}</th>
            <th className={LIST_TH}>{t.columns.installer}</th>
            <th className={LIST_TH}>{t.columns.surveyStatus}</th>
            <th className={LIST_TH}>{t.columns.status}</th>
            <th className={LIST_TH}>{t.columns.completedDate}</th>
            <th className="w-10 px-3 py-3" aria-hidden />
          </tr>
        </thead>
        <tbody className="divide-hairline-light divide-y">
          {constructions.map((row) => (
            <tr
              key={row.id}
              tabIndex={0}
              role="button"
              aria-label={`${row.customerName}${c.honorific} ${c.constructionStatusLabels[row.status]}`}
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
              <td className={LIST_TD}>{row.installerName ?? t.noInstaller}</td>
              <td className="whitespace-nowrap px-6 py-3">
                {row.surveyStatus ? (
                  <Badge variant={surveyVariant(row.surveyStatus)}>
                    {c.surveyStatusLabels[row.surveyStatus]}
                  </Badge>
                ) : (
                  <span className="text-mute-light text-xs">{t.noSurvey}</span>
                )}
              </td>
              <td className="whitespace-nowrap px-6 py-3">
                <Badge variant={constructionVariant(row.status)}>
                  {c.constructionStatusLabels[row.status]}
                </Badge>
              </td>
              <td className={LIST_TD_NUM}>
                {formatDate(row.completedDate) ?? (
                  <span className="text-mute-light text-xs">{t.notCompleted}</span>
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
