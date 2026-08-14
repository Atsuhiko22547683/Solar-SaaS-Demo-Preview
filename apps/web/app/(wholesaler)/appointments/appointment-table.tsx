"use client";

// アポイント一覧テーブル。行クリック / Enter・Space で該当顧客の詳細へ遷移する
// （アポイント単独の詳細画面は存在しないため、案件の実体である顧客詳細を遷移先にする）。
// 列構成・行高・フォーカスリングは S-032 顧客一覧の customer-table.tsx と同型。
//
// 各行は data-appointment-id を持ち、行内に「マエカク」リンク（既存の
// /appointments/[id]/pre-call）を置く。これは tests/e2e/uc02-precall.spec.ts が
// 前提にしているこの画面の契約に合わせたもの。

import { ChevronRight } from "lucide-react";
import Link from "next/link";
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

import { appointmentStatusVariant, preCallResultVariant } from "./constants";

import type { AppointmentListItem } from "./data";

/** 顧客一覧の次回アポ列と同じ表記（YYYY/MM/DD (曜) HH:mm）。 */
function formatScheduledAt(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
  const time = d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} (${labels.customer.weekdays[d.getDay()]}) ${time}`;
}

interface AppointmentTableProps {
  appointments: AppointmentListItem[];
}

export function AppointmentTable({ appointments }: AppointmentTableProps) {
  const t = labels.appointment.list;
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
            <th className={LIST_TH}>{t.columns.scheduledAt}</th>
            <th className={LIST_TH}>{t.columns.customerName}</th>
            <th className={LIST_TH}>{t.columns.area}</th>
            <th className={LIST_TH}>{t.columns.assignee}</th>
            <th className={LIST_TH}>{t.columns.appointmentType}</th>
            <th className={LIST_TH}>{t.columns.status}</th>
            <th className={LIST_TH}>{t.columns.preCall}</th>
            <th className={LIST_TH}>{t.columns.nextAction}</th>
            <th className={LIST_TH}>{t.columns.actions}</th>
            <th className="w-10 px-3 py-3" aria-hidden />
          </tr>
        </thead>
        <tbody className="divide-hairline-light divide-y">
          {appointments.map((row) => (
            <tr
              key={row.id}
              data-appointment-id={row.id}
              tabIndex={0}
              role="button"
              aria-label={`${row.customerName}${c.honorific} ${formatScheduledAt(row.scheduledAt)}`}
              className={LIST_ROW}
              onClick={() => goToCustomer(row.customerId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  goToCustomer(row.customerId);
                }
              }}
            >
              <td className={LIST_TD_NUM}>{formatScheduledAt(row.scheduledAt)}</td>
              <td className={LIST_TD_STRONG}>
                {row.customerName} {c.honorific}
              </td>
              <td className={LIST_TD}>{row.area ?? c.none}</td>
              <td className={LIST_TD}>{row.assigneeName ?? c.none}</td>
              <td className={LIST_TD}>{row.appointmentType ?? row.location ?? c.none}</td>
              <td className="whitespace-nowrap px-6 py-3">
                <Badge variant={appointmentStatusVariant(row.status)}>
                  {labels.appointment.statuses[row.status]}
                </Badge>
              </td>
              <td className="whitespace-nowrap px-6 py-3">
                {row.preCallResult ? (
                  <Badge variant={preCallResultVariant(row.preCallResult)}>
                    {labels.preCall.resultBadges[row.preCallResult]}
                  </Badge>
                ) : (
                  <span className="text-mute-light text-xs">{t.preCallNone}</span>
                )}
              </td>
              <td className="text-body-light max-w-[16rem] truncate px-6 py-3">
                {row.nextAction ?? c.none}
              </td>
              <td className="whitespace-nowrap px-6 py-3">
                {/* 行クリック（顧客詳細へ）と競合しないよう、リンク側で伝播を止める。 */}
                <Link
                  href={`/appointments/${row.id}/pre-call`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-primary focus-visible:ring-primary/40 rounded-sm text-sm font-medium underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2"
                >
                  {labels.appointment.actions.preCall}
                </Link>
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
