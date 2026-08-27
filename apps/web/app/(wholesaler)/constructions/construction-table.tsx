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
import { LIST_ROW, LIST_TD, LIST_TD_NUM, LIST_TH } from "@/components/list/list-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { labels } from "@/lib/i18n/labels";

import { saveProjectConstructionAction } from "../customers/actions";
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
    default:
      return "secondary";
  }
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
        <h4 className="border-hairline-light text-mute-light border-b pb-1 text-xs font-semibold uppercase tracking-wider">
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
            <th className={LIST_TH}>{t.columns.startedDate}</th>
            <th className={LIST_TH}>{t.columns.completedDate}</th>
            <th className="w-12 px-3 py-3" aria-hidden />
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
                className={`group ${LIST_ROW} ${isExpanded ? "bg-mist-light" : ""}`}
                onClick={toggle}
              >
                <td className={LIST_TD_NUM}>{formatDate(row.plannedDate) ?? c.none}</td>
                {/* 顧客名だけは遷移リンク。行クリック（= 展開）と取り違えないよう伝播を止める。 */}
                <td className="text-ink whitespace-nowrap px-6 py-3 font-medium">
                  <Link
                    href={customerHref(row.customerId)}
                    onClick={(e) => e.stopPropagation()}
                    className="focus-visible:ring-primary/40 rounded-sm underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2"
                  >
                    {row.customerName} {c.honorific}
                  </Link>
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
                {/* 日付は read-only。編集は展開バナー側（列幅を使いすぎないため）。 */}
                <td className={LIST_TD_NUM}>{formatDate(row.startedDate) ?? c.none}</td>
                <td className={LIST_TD_NUM}>
                  {formatDate(row.completedDate) ?? (
                    <span className="text-mute-light text-xs">{t.notCompleted}</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right">
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
