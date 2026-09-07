"use client";

// アポイント一覧テーブル。
//
// 通常行は一覧性の高い短い項目だけを並べ、長文（次に必要な対応）と補助操作は
// 行を展開したときだけ出す（コール一覧と同じ操作感）。これで 1366px 幅でも
// 横スクロールを抑えつつ、文章は全文を折り返して読める。
//
// 操作の切り分け:
//   行のどこか / 右端のシェブロン → 展開・折りたたみ（アコーディオン: 1 行ずつ）
//   顧客名リンク / バナーの「案件詳細」 → 顧客詳細の商談履歴タブ（?tab=history）
//
// 各行は data-appointment-id を保持する（tests/e2e/uc02-precall.spec.ts がこの属性から
// appointmentId を取得する契約）。マエカク入力（/appointments/[id]/pre-call）は
// 「操作」という抽象的な列名をやめ、展開バナー内の明示的なリンクへ移した。

import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  COL_LG,
  COL_SM,
  COL_XL,
  LIST_ROW,
  LIST_TD,
  LIST_TD_NUM,
  LIST_TD_STRONG,
  LIST_TH,
} from "@/components/list/list-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatEventDateTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { appointmentStatusVariant } from "./constants";

import type { AppointmentListItem } from "./data";

/** 顧客一覧の次回アポ列と同じ表記（YYYY/MM/DD (曜) HH:mm）。 */
function formatScheduledAt(iso: string): string {
  return formatEventDateTime(iso);
}

/** 顧客詳細の商談履歴タブ（アポイントに最も近い既存タブ）。 */
function customerHref(customerId: string): string {
  return `/customers/${customerId}?tab=history`;
}

interface AppointmentTableProps {
  appointments: AppointmentListItem[];
}

export function AppointmentTable({ appointments }: AppointmentTableProps) {
  const t = labels.appointment.list;
  const c = labels.customer;
  const a = labels.appointment;

  // 展開状態は画面上の一時的な UI 状態（保存しない / リロードで閉じる）。
  // 一覧性を優先してアコーディオン方式にする（1 行開くと他は閉じる）。
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // アポ一覧の主目的は「いつ誰に会うか」と「マエカクが済んでいるか」。
  // 対応状況(マエカク)は未実施だとアポが無駄になるため常時表示する。
  const COL = {
    status: COL_SM,
    type: COL_LG,
    area: COL_LG,
    assignee: COL_XL,
  } as const;

  // 列幅は固定（table-fixed）。顧客一覧と同じく、内容や絞り込み結果で
  // 列の x 座標が動かないようにする。狭い画面では COL_* で列自体を落とす。
  const W = {
    scheduledAt: "w-[22%] lg:w-[15%]",
    customer: "w-[38%] lg:w-[20%]",
    area: "lg:w-[12%]",
    assignee: "xl:w-[12%]",
    type: "lg:w-[12%]",
    status: "sm:w-[12%]",
    preCall: "w-[34%] lg:w-[17%]",
    chevron: "w-[6%] lg:w-[4%]",
  } as const;

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-hairline-light bg-surface-soft/50 border-b">
            <th scope="col" className={`${LIST_TH} ${W.scheduledAt}`}>
              {t.columns.scheduledAt}
            </th>
            <th scope="col" className={`${LIST_TH} ${W.customer}`}>
              {t.columns.customerName}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.area} ${W.area}`}>
              {t.columns.area}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.assignee} ${W.assignee}`}>
              {t.columns.assignee}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.type} ${W.type}`}>
              {t.columns.appointmentType}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.status} ${W.status}`}>
              {t.columns.status}
            </th>
            <th scope="col" className={`${LIST_TH} ${W.preCall}`}>
              {t.columns.preCall}
            </th>
            <th className={W.chevron} aria-hidden />
          </tr>
        </thead>
        <tbody className="divide-hairline-light divide-y">
          {appointments.map((row) => {
            const isExpanded = expandedId === row.id;
            const bannerId = `appointment-row-detail-${row.id}`;
            const toggle = () => setExpandedId(isExpanded ? null : row.id);

            return [
              <tr
                key={row.id}
                data-appointment-id={row.id}
                className={`group ${LIST_ROW} ${isExpanded ? "bg-page" : ""}`}
                onClick={toggle}
              >
                <td className={LIST_TD_NUM}>{formatScheduledAt(row.scheduledAt)}</td>
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
                <td className={`${LIST_TD} ${COL.area}`}>{row.area ?? c.none}</td>
                <td className={`${LIST_TD} ${COL.assignee}`}>{row.assigneeName ?? c.none}</td>
                <td className={`${LIST_TD} ${COL.type}`}>
                  {row.appointmentType ?? row.location ?? c.none}
                </td>
                {/* 主 status はバッジ 1 つだけ。行に複数の色を並べない。 */}
                <td className={`${LIST_TD} ${COL.status}`}>
                  <Badge variant={appointmentStatusVariant(row.status)}>
                    {labels.appointment.statuses[row.status]}
                  </Badge>
                </td>
                {/* マエカクは「未実施だとアポが無駄になる」要対応。色付きの文字で
                    見つけやすくし、バッジは主 status に譲る。 */}
                <td className={LIST_TD}>
                  {row.preCallResult ? (
                    labels.preCall.resultBadges[row.preCallResult]
                  ) : (
                    <span className="text-danger font-medium">{t.preCallNone}</span>
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
                  <td id={bannerId} colSpan={8} className="px-6 py-4">
                    <div className="space-y-4">
                      {/* 次に必要な対応 — 文章なので通常列には置かず、ここで全文を折り返す。 */}
                      <div className="min-w-0 space-y-1">
                        <h4 className="border-hairline-light text-mute-light border-b pb-1 text-xs font-semibold">
                          {t.columns.nextAction}
                        </h4>
                        {row.nextAction && row.nextAction.length > 0 ? (
                          <p className="text-body-light whitespace-pre-line break-words text-sm">
                            {row.nextAction}
                          </p>
                        ) : (
                          <p className="text-mute-light text-sm">{c.none}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-3">
                        {/* 旧「操作」列の実体。何をする導線かが分かる名前にして残す。 */}
                        <Link
                          href={`/appointments/${row.id}/pre-call`}
                          className="text-primary focus-visible:ring-primary/40 rounded-sm text-sm font-medium underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2"
                        >
                          {a.actions.preCallEntry}
                        </Link>
                        <Button asChild size="default" className="px-5">
                          <Link href={customerHref(row.customerId)}>
                            {t.expand.detailLink}
                            <ArrowRight className="ml-1 size-4" aria-hidden />
                          </Link>
                        </Button>
                      </div>
                    </div>
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
