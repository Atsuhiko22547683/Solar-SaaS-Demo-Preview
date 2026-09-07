"use client";

// 施工一覧テーブル。
//
// 通常行は「情報確認」に徹し、日付は read-only の文字として並べる（date input を
// 並べると列幅を使いすぎて横スクロールが必要になるため）。着工日・完工日の編集は
// 行を展開したときだけ出す（コール一覧と同じ操作感）。
//
// 操作の切り分け:
//   行のどこか / 右端のシェブロン → 展開・折りたたみ（アコーディオン: 1 行ずつ）
//   顧客名リンク / バナーの「案件詳細」 → 顧客詳細の施工タブ（?tab=construction）
//
// 保存は既存の saveProjectConstructionAction（customer.update 権限 + テナント境界）を
// そのまま使う。列構成・行高・バッジは S-032 顧客一覧と同じトークン。

import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { toDateInputValue } from "@/components/list/inline-date-input";
import {
  COL_LG,
  COL_MD,
  COL_XL,
  LIST_ROW,
  LIST_TD,
  LIST_TD_NUM,
  LIST_TD_STRONG,
  LIST_TH,
} from "@/components/list/list-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate as fmtDate } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { saveProjectConstructionAction } from "../customers/actions";
import { constructionVariant } from "../customers/customer-table";

import type { ConstructionListItem } from "./data";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return fmtDate(iso);
}

/** 顧客詳細の施工タブ。 */
function customerHref(customerId: string): string {
  return `/customers/${customerId}?tab=construction`;
}

const EDIT_FIELD =
  "h-8 w-full rounded-sm border border-hairline-light bg-white px-2 text-sm text-ink tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-surface-soft";

/**
 * 展開バナー — 施工日程（着工日 / 完工日）の編集。
 * 保存先は Construction.startedDate / completedDate（既存列・既存 Action）。
 */
function ConstructionDetail({ row }: { row: ConstructionListItem }) {
  const t = labels.constructionList;
  const c = labels.common;
  const router = useRouter();

  const [startedDate, setStartedDate] = useState(() => toDateInputValue(row.startedDate));
  const [completedDate, setCompletedDate] = useState(() => toDateInputValue(row.completedDate));
  const [isPending, startTransition] = useTransition();

  // 一覧が再取得されたら（検索・並び替え・他行の保存）サーバ値へ追随する。
  useEffect(() => {
    setStartedDate(toDateInputValue(row.startedDate));
    setCompletedDate(toDateInputValue(row.completedDate));
  }, [row.startedDate, row.completedDate]);

  const dirty =
    startedDate !== toDateInputValue(row.startedDate) ||
    completedDate !== toDateInputValue(row.completedDate);

  function save() {
    startTransition(async () => {
      try {
        await saveProjectConstructionAction({
          customerId: row.customerId,
          contractId: row.contractId,
          constructionId: row.id,
          // 空欄は null で送る = 入力済みの値を消して未設定へ戻せる。
          startedDate: startedDate || null,
          completedDate: completedDate || null,
        });
        toast.success(c.saved);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error && err.message ? err.message : c.unknownError);
      }
    });
  }

  const idBase = `construction-edit-${row.id}`;
  return (
    <div className="space-y-4">
      <div className="min-w-0 space-y-2">
        <h4 className="border-hairline-light text-mute-light border-b pb-1 text-xs font-semibold">
          {t.editSection.title}
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-lg">
          <div className="min-w-0">
            <label
              htmlFor={`${idBase}-started`}
              className="text-mute-light text-[11px] leading-tight"
            >
              {t.columns.startedDate}
            </label>
            <input
              id={`${idBase}-started`}
              type="date"
              value={startedDate}
              disabled={isPending}
              onChange={(e) => setStartedDate(e.target.value)}
              aria-label={`${row.customerName} ${t.columns.startedDate}`}
              className={EDIT_FIELD}
            />
          </div>
          <div className="min-w-0">
            <label
              htmlFor={`${idBase}-completed`}
              className="text-mute-light text-[11px] leading-tight"
            >
              {t.columns.completedDate}
            </label>
            <input
              id={`${idBase}-completed`}
              type="date"
              value={completedDate}
              disabled={isPending}
              onChange={(e) => setCompletedDate(e.target.value)}
              aria-label={`${row.customerName} ${t.columns.completedDate}`}
              className={EDIT_FIELD}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={save} disabled={isPending || !dirty}>
          {isPending ? c.saving : c.save}
        </Button>
        <Button asChild size="default" className="px-5">
          <Link href={customerHref(row.customerId)}>
            {t.expand.detailLink}
            <ArrowRight className="ml-1 size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}

interface ConstructionTableProps {
  constructions: ConstructionListItem[];
}

export function ConstructionTable({ constructions }: ConstructionTableProps) {
  const t = labels.constructionList;
  const c = labels.customer;

  // 展開状態は画面上の一時的な UI 状態（保存しない / リロードで閉じる）。
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 一覧の主目的は「施工前 / 施工中 / 完工待ちのどこにいるか」。
  // 顧客・工事予定日・施工状態・現地調査を常時、担当と実績日は幅に余裕があるときに出す。
  const COL = {
    installer: COL_MD,
    startedDate: COL_LG,
    completedDate: COL_LG,
    assignee: COL_XL,
  } as const;

  // 列幅は固定（table-fixed）。事業者名や氏名の長さで列位置が動かないようにする。
  const W = {
    plannedDate: "w-[22%] lg:w-[11%]",
    customer: "w-[38%] lg:w-[19%]",
    assignee: "xl:w-[10%]",
    installer: "md:w-[13%]",
    survey: "w-[16%] lg:w-[11%]",
    status: "w-[18%] lg:w-[11%]",
    startedDate: "lg:w-[10%]",
    completedDate: "lg:w-[11%]",
    chevron: "w-[6%] lg:w-[4%]",
  } as const;

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-hairline-light bg-surface-soft/50 border-b">
            <th scope="col" className={`${LIST_TH} ${W.plannedDate}`}>
              {t.columns.plannedDate}
            </th>
            <th scope="col" className={`${LIST_TH} ${W.customer}`}>
              {t.columns.customerName}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.assignee} ${W.assignee}`}>
              {t.columns.assignee}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.installer} ${W.installer}`}>
              {t.columns.installer}
            </th>
            <th scope="col" className={`${LIST_TH} ${W.survey}`}>
              {t.columns.surveyStatus}
            </th>
            <th scope="col" className={`${LIST_TH} ${W.status}`}>
              {t.columns.status}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.startedDate} ${W.startedDate}`}>
              {t.columns.startedDate}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.completedDate} ${W.completedDate}`}>
              {t.columns.completedDate}
            </th>
            <th className={W.chevron} aria-hidden />
          </tr>
        </thead>
        <tbody className="divide-hairline-light divide-y">
          {constructions.map((row) => {
            const isExpanded = expandedId === row.id;
            const bannerId = `construction-row-detail-${row.id}`;
            const toggle = () => setExpandedId(isExpanded ? null : row.id);

            return [
              <tr
                key={row.id}
                className={`group ${LIST_ROW} ${isExpanded ? "bg-page" : ""}`}
                onClick={toggle}
              >
                <td className={LIST_TD_NUM}>{formatDate(row.plannedDate) ?? c.none}</td>
                {/* 顧客名だけは遷移リンク。行クリック（= 展開）と取り違えないよう伝播を止める。 */}
                <td className={LIST_TD_STRONG}>
                  <Link
                    href={customerHref(row.customerId)}
                    onClick={(e) => e.stopPropagation()}
                    className="focus-visible:ring-primary/40 rounded-sm underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2"
                  >
                    {row.customerName} {c.honorific}
                  </Link>
                </td>
                <td className={`${LIST_TD} ${COL.assignee}`}>{row.assigneeName ?? c.none}</td>
                <td className={`${LIST_TD} ${COL.installer}`}>
                  {row.installerName ?? t.noInstaller}
                </td>
                {/* 現地調査は施工状態の前工程。補助情報なのでバッジにせず文字で出す。 */}
                <td className={LIST_TD}>
                  {row.surveyStatus ? (
                    c.surveyStatusLabels[row.surveyStatus]
                  ) : (
                    <span className="text-mute-light">{t.noSurvey}</span>
                  )}
                </td>
                {/* 施工状態が行の主 status。バッジはここ 1 つだけに絞る。 */}
                <td className={LIST_TD}>
                  <Badge variant={constructionVariant(row.status)}>
                    {c.constructionStatusLabels[row.status]}
                  </Badge>
                </td>
                {/* 日付は read-only。編集は展開バナー側（列幅を使いすぎないため）。 */}
                <td className={`${LIST_TD_NUM} ${COL.startedDate}`}>
                  {formatDate(row.startedDate) ?? c.none}
                </td>
                <td className={`${LIST_TD_NUM} ${COL.completedDate}`}>
                  {formatDate(row.completedDate) ?? (
                    <span className="text-mute-light">{t.notCompleted}</span>
                  )}
                </td>
                <td className={`${LIST_TD} text-right`}>
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={bannerId}
                    aria-label={`${row.customerName}${c.honorific} ${isExpanded ? t.expand.close : t.expand.open}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle();
                    }}
                    className="text-mute-light hover:bg-surface-soft hover:text-ink focus-visible:ring-primary/40 rounded-md p-1 transition-colors focus:outline-none focus-visible:ring-2"
                  >
                    <ChevronDown
                      className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                </td>
              </tr>,

              isExpanded ? (
                <tr key={`${row.id}-detail`} className="bg-surface-soft/40">
                  <td id={bannerId} colSpan={9} className="px-6 py-4">
                    <ConstructionDetail row={row} />
                  </td>
                </tr>
              ) : null,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
