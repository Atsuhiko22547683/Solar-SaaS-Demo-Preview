"use client";

// 設置申請一覧テーブル。
//
// 通常行は「情報確認」に徹し、日付は read-only の文字として並べる（date input を
// 並べると列幅を使いすぎて横スクロールが必要になるため）。申請日程の編集は行を
// 展開したときだけ出す（コール一覧・施工一覧と同じ操作感）。
//
// 操作の切り分け:
//   行のどこか / 右端のシェブロン → 展開・折りたたみ（アコーディオン: 1 行ずつ）
//   顧客名リンク / バナーの「案件詳細」 → 顧客詳細の設置申請タブ（?tab=subsidy）
//
// 保存は既存の saveProjectApplicationAction（customer.update 権限 + テナント境界）。
// 申請状態バッジは顧客一覧の subsidyVariant を再利用し、色が食い違わないようにする。

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

import { saveProjectApplicationAction } from "../customers/actions";
import { subsidyVariant } from "../customers/customer-table";

import type { ApplicationListItem } from "./data";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return fmtDate(iso);
}

/** 顧客詳細の設置申請タブ。 */
function customerHref(customerId: string): string {
  return `/customers/${customerId}?tab=subsidy`;
}

const EDIT_FIELD =
  "h-8 w-full rounded-sm border border-hairline-light bg-white px-2 text-sm text-ink tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-surface-soft";

/**
 * 展開バナー — 申請日程（申請予定日 / 提出日 / 承認日）の編集。
 * いずれも Application の既存列で、保存は既存 saveProjectApplicationAction を使う。
 */
function ApplicationDetail({ row }: { row: ApplicationListItem }) {
  const t = labels.applicationList;
  const c = labels.common;
  const router = useRouter();

  const [plannedDate, setPlannedDate] = useState(() => toDateInputValue(row.plannedDate));
  const [submittedDate, setSubmittedDate] = useState(() => toDateInputValue(row.submittedDate));
  const [approvedDate, setApprovedDate] = useState(() => toDateInputValue(row.approvedDate));
  const [isPending, startTransition] = useTransition();

  // 一覧が再取得されたら（検索・並び替え・他行の保存）サーバ値へ追随する。
  useEffect(() => {
    setPlannedDate(toDateInputValue(row.plannedDate));
    setSubmittedDate(toDateInputValue(row.submittedDate));
    setApprovedDate(toDateInputValue(row.approvedDate));
  }, [row.plannedDate, row.submittedDate, row.approvedDate]);

  const dirty =
    plannedDate !== toDateInputValue(row.plannedDate) ||
    submittedDate !== toDateInputValue(row.submittedDate) ||
    approvedDate !== toDateInputValue(row.approvedDate);

  function save() {
    startTransition(async () => {
      try {
        await saveProjectApplicationAction({
          customerId: row.customerId,
          contractId: row.contractId,
          applicationId: row.id,
          // 空欄は null で送る = 入力済みの値を消して未設定へ戻せる。
          plannedDate: plannedDate || null,
          submittedDate: submittedDate || null,
          approvedDate: approvedDate || null,
        });
        toast.success(c.saved);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error && err.message ? err.message : c.unknownError);
      }
    });
  }

  const idBase = `application-edit-${row.id}`;
  const fields = [
    { key: "planned", label: t.columns.plannedDate, value: plannedDate, set: setPlannedDate },
    {
      key: "submitted",
      label: t.columns.submittedDate,
      value: submittedDate,
      set: setSubmittedDate,
    },
    { key: "approved", label: t.columns.approvedDate, value: approvedDate, set: setApprovedDate },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="min-w-0 space-y-2">
        <h4 className="border-hairline-light text-mute-light border-b pb-1 text-xs font-semibold">
          {t.editSection.title}
        </h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:max-w-2xl">
          {fields.map((f) => (
            <div key={f.key} className="min-w-0">
              <label
                htmlFor={`${idBase}-${f.key}`}
                className="text-mute-light text-[11px] leading-tight"
              >
                {f.label}
              </label>
              <input
                id={`${idBase}-${f.key}`}
                type="date"
                value={f.value}
                disabled={isPending}
                onChange={(e) => f.set(e.target.value)}
                aria-label={`${row.customerName} ${f.label}`}
                className={EDIT_FIELD}
              />
            </div>
          ))}
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

interface ApplicationTableProps {
  applications: ApplicationListItem[];
}

export function ApplicationTable({ applications }: ApplicationTableProps) {
  const t = labels.applicationList;
  const c = labels.customer;

  // 展開状態は画面上の一時的な UI 状態（保存しない / リロードで閉じる）。
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 一覧の主目的は「未提出 / 審査中 / 完了のどこで滞留しているか」。
  // 顧客・申請状態・提出日を常時、種別と担当・添付は幅に余裕があるときに出す。
  const COL = {
    type: COL_MD,
    approvedDate: COL_LG,
    assignee: COL_XL,
    files: COL_XL,
  } as const;

  // 列幅は固定（table-fixed）。申請種別や氏名の長さで列位置が動かないようにする。
  const W = {
    plannedDate: "w-[22%] lg:w-[11%]",
    customer: "w-[38%] lg:w-[20%]",
    assignee: "xl:w-[10%]",
    type: "md:w-[14%]",
    status: "w-[18%] lg:w-[12%]",
    submittedDate: "w-[16%] lg:w-[11%]",
    approvedDate: "lg:w-[11%]",
    files: "xl:w-[8%]",
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
            <th scope="col" className={`${LIST_TH} ${COL.type} ${W.type}`}>
              {t.columns.type}
            </th>
            <th scope="col" className={`${LIST_TH} ${W.status}`}>
              {t.columns.status}
            </th>
            <th scope="col" className={`${LIST_TH} ${W.submittedDate}`}>
              {t.columns.submittedDate}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.approvedDate} ${W.approvedDate}`}>
              {t.columns.approvedDate}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.files} ${W.files}`}>
              {t.columns.files}
            </th>
            <th className={W.chevron} aria-hidden />
          </tr>
        </thead>
        <tbody className="divide-hairline-light divide-y">
          {applications.map((row) => {
            const isExpanded = expandedId === row.id;
            const bannerId = `application-row-detail-${row.id}`;
            const toggle = () => setExpandedId(isExpanded ? null : row.id);

            return [
              <tr
                key={row.id}
                className={`group ${LIST_ROW} ${isExpanded ? "bg-page" : ""}`}
                onClick={toggle}
              >
                {/* 日付は read-only。編集は展開バナー側（列幅を使いすぎないため）。 */}
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
                <td className={`${LIST_TD} ${COL.type}`}>
                  {row.type || t.noType}
                  {row.agency ? (
                    <span className="text-mute-light ml-2 text-xs">{row.agency}</span>
                  ) : null}
                </td>
                {/* 申請状態が行の主 status。バッジはここ 1 つだけに絞る。 */}
                <td className={LIST_TD}>
                  <Badge variant={subsidyVariant(row.status)}>
                    {c.subsidyStatusLabels[row.status]}
                  </Badge>
                </td>
                {/* 未提出は滞留の起点なので、他の未設定より強く出す。 */}
                <td className={LIST_TD_NUM}>
                  {formatDate(row.submittedDate) ?? (
                    <span className="text-danger font-medium">{t.notSubmitted}</span>
                  )}
                </td>
                <td className={`${LIST_TD_NUM} ${COL.approvedDate}`}>
                  {formatDate(row.approvedDate) ?? (
                    <span className="text-mute-light">{t.notApproved}</span>
                  )}
                </td>
                <td className={`${LIST_TD_NUM} ${COL.files}`}>
                  {row.fileCount > 0 ? (
                    t.fileCount.replace("{n}", String(row.fileCount))
                  ) : (
                    <span className="text-mute-light">{t.noFiles}</span>
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
                    <ApplicationDetail row={row} />
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
