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
  LIST_CHEVRON_BUTTON,
  LIST_CHEVRON_TD,
  LIST_ROW,
  LIST_TD,
  LIST_TD_NUM,
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
    // 予定日時はスマホでは列にせず、顧客セルの 2 行目へ寄せる
    // （78px の列に「2026/08/15 (金) 18:00」は入らず、隣へ溢れて重なって見えるため）。
    scheduledAt: COL_SM,
    status: COL_SM,
    type: COL_LG,
    area: COL_LG,
    assignee: COL_XL,
  } as const;

  // 列幅は固定（table-fixed）。内容や絞り込み結果で列の x 座標が動かないようにする。
  //
  // 開閉ボタンの欄は **固定幅** にする。以前は百分率だったうえ、各 breakpoint で
  // 表示中の列の合計が 100% になっていなかった（sm で 88%、xl で 104%）。
  // 余り・不足をブラウザが内容なりに配分するため、本文の長さで矢印の位置が動いていた。
  // 固定幅の欄を 1 つ置き、残りの列だけで 100% を作れば、本文に引っ張られなくなる。
  //
  // COL_* で落とした列は display:none になり、表の列数そのものが減る。だから
  // 「非表示列に w-0 を置いて数を合わせる」ことはできない。breakpoint ごとに
  // 表示される列だけで 100% を組む。
  const W = {
    //            base(customer+preCall)  sm(+日時,状態)  lg(+エリア,種別)  xl(+担当者)
    scheduledAt: "w-0 sm:w-[22%] lg:w-[16%] xl:w-[15%]",
    customer: "w-[60%] sm:w-[30%] lg:w-[22%] xl:w-[20%]",
    area: "w-0 lg:w-[13%] xl:w-[12%]",
    assignee: "w-0 xl:w-[13%]",
    type: "w-0 lg:w-[14%] xl:w-[13%]",
    status: "w-0 sm:w-[16%] lg:w-[13%] xl:w-[11%]",
    preCall: "w-[40%] sm:w-[32%] lg:w-[22%] xl:w-[16%]",
    /** 操作欄。押しやすさ（44px）を確保しつつ、本文の長さで動かない固定幅。 */
    chevron: "w-14 sm:w-12",
  } as const;

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-hairline-light bg-surface-soft/50 border-b">
            <th scope="col" className={`${LIST_TH} ${COL.scheduledAt} ${W.scheduledAt}`}>
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
                <td className={`${LIST_TD_NUM} ${COL.scheduledAt} truncate`}>
                  {formatScheduledAt(row.scheduledAt)}
                </td>
                {/* 顧客名だけは遷移リンク。行クリック（= 展開）と取り違えないよう伝播を止める。
                    スマホでは予定日時の列が無いので、2 行目に日時を出す。 */}
                <td className="whitespace-nowrap px-4 py-2.5 align-top">
                  <span className="block">
                    <Link
                      href={customerHref(row.customerId)}
                      onClick={(e) => e.stopPropagation()}
                      className="text-ink focus-visible:ring-primary/40 block truncate rounded-sm text-sm font-medium leading-5 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2"
                    >
                      {row.customerName} {c.honorific}
                    </Link>
                    <span className="text-mute-light block truncate text-xs tabular-nums leading-4 sm:hidden">
                      {formatScheduledAt(row.scheduledAt)}
                    </span>
                  </span>
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
                <td className={LIST_CHEVRON_TD}>
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={bannerId}
                    aria-label={`${row.customerName}${c.honorific} ${isExpanded ? t.expand.close : t.expand.open}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle();
                    }}
                    className={LIST_CHEVRON_BUTTON}
                  >
                    <ChevronDown
                      className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                </td>
              </tr>,

              isExpanded ? (
                <tr key={`${row.id}-detail`} className="bg-surface-soft/40">
                  {/* colSpan は表示中の列数に合わせる必要がある。breakpoint で列が落ちるので
                      固定値（8）では合わなくなる。実際の列数より大きい値を渡してブラウザに
                      丸めさせ、どの幅でも常に全幅になるようにする。 */}
                  <td id={bannerId} colSpan={99} className="px-4 py-4 sm:px-6">
                    <div className="space-y-4">
                      {/* 狭い画面で列から落とした項目は、ここで必ず読めるようにする。
                          担当者・予定日時・エリアなどを見失わせない。 */}
                      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                        <div className="min-w-0">
                          <dt className="text-mute-light text-xs">{t.columns.scheduledAt}</dt>
                          <dd className="text-body-light tabular-nums">
                            {formatScheduledAt(row.scheduledAt)}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-mute-light text-xs">{t.columns.area}</dt>
                          <dd className="text-body-light break-words">{row.area ?? c.none}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-mute-light text-xs">{t.columns.assignee}</dt>
                          <dd className="text-body-light break-words">
                            {row.assigneeName ?? c.none}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-mute-light text-xs">{t.columns.company}</dt>
                          <dd className="text-body-light break-words">
                            {row.companyName ?? t.ownCompany}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-mute-light text-xs">{t.columns.appointmentType}</dt>
                          <dd className="text-body-light break-words">
                            {row.appointmentType ?? c.none}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-mute-light text-xs">{t.columns.partnerKind}</dt>
                          <dd className="text-body-light break-words">
                            {row.partnerKind ? t.partnerKindLabels[row.partnerKind] : c.none}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-mute-light text-xs">{t.columns.event}</dt>
                          <dd className="text-body-light break-words">
                            {row.eventCandidateId && row.eventVenue ? (
                              <Link
                                href={`/event-detail/${row.eventCandidateId}`}
                                className="text-link-light underline underline-offset-2"
                              >
                                {row.eventVenue}
                              </Link>
                            ) : (
                              c.none
                            )}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-mute-light text-xs">{t.columns.location}</dt>
                          <dd className="text-body-light break-words">{row.location ?? c.none}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-mute-light text-xs">{t.columns.createdAt}</dt>
                          <dd className="text-body-light tabular-nums">
                            {formatScheduledAt(row.createdAt)}
                          </dd>
                        </div>
                      </dl>

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

                      {/* 操作欄。狭い画面では縦に並べ、押しやすい高さ（44px）を保つ。 */}
                      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                        {/* 旧「操作」列の実体。何をする導線かが分かる名前にして残す。 */}
                        <Link
                          href={`/appointments/${row.id}/pre-call`}
                          className="text-primary focus-visible:ring-primary/40 inline-flex min-h-11 items-center justify-center rounded-sm text-sm font-medium underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 sm:min-h-0 sm:justify-start"
                        >
                          {a.actions.preCallEntry}
                        </Link>
                        <Button asChild size="default" className="w-full px-5 sm:w-auto">
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
