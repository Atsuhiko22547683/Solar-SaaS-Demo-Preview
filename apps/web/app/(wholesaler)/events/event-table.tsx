"use client";

import { useRouter } from "next/navigation";

import { COL_LG, COL_SM } from "@/components/list/list-shell";
import { Badge } from "@/components/ui/badge";
import { formatEventDate } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import type { AssignStatus, HoldingStatus, UnifiedEventRow } from "./unified-data";

function formatDateTime(iso: string): string {
  return formatEventDate(iso);
}

function holdingVariant(s: HoldingStatus): "default" | "secondary" | "destructive" {
  switch (s) {
    case "confirmed":
      return "default";
    case "pending":
      return "secondary";
    case "cancelled":
      return "destructive";
  }
}

function assignVariant(s: AssignStatus): "default" | "secondary" {
  return s === "confirmed" ? "default" : "secondary";
}

interface EventTableProps {
  events: UnifiedEventRow[];
}

export function EventTable({ events }: EventTableProps) {
  const router = useRouter();
  const t = labels.eventList;

  // 催事一覧を開く目的は「いつ・どこで・人は足りているか」。
  // 未アサインは売上ゼロに直結するため、狭い画面でも早い段に置く。
  const COL = {
    assign: "", // 未アサインの検知が最優先
    holding: COL_SM, // 開催確定/見込み
    area: COL_LG, // 絞り込みの軸
  } as const;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-hairline-light bg-surface-soft/50 border-b">
            <th scope="col" className="text-mute-light px-4 py-2.5 text-left text-xs font-semibold">
              {t.columns.scheduledDate}
            </th>
            <th
              scope="col"
              className={`text-mute-light px-4 py-2.5 text-left text-xs font-semibold ${COL.area}`}
            >
              {t.columns.area}
            </th>
            <th scope="col" className="text-mute-light px-4 py-2.5 text-left text-xs font-semibold">
              {t.columns.venue}
            </th>
            <th
              scope="col"
              className={`text-mute-light px-4 py-2.5 text-left text-xs font-semibold ${COL.holding}`}
            >
              {t.columns.holdingStatus}
            </th>
            <th scope="col" className="text-mute-light px-4 py-2.5 text-left text-xs font-semibold">
              {t.columns.assignStatus}
            </th>
          </tr>
        </thead>
        <tbody className="divide-hairline-light divide-y">
          {events.map((ev) => (
            <tr
              key={`${ev.kind}-${ev.id}`}
              className="hover:bg-surface-soft/30 cursor-pointer transition-colors"
              onClick={() => router.push(ev.detailHref)}
            >
              <td className="text-body-light whitespace-nowrap px-4 py-2.5 tabular-nums">
                {formatDateTime(ev.scheduledDate)}
              </td>
              <td className={`text-body-light px-4 py-2.5 ${COL.area}`}>{ev.area ?? "—"}</td>
              <td className="text-ink px-4 py-2.5 font-medium">{ev.venue ?? "—"}</td>
              <td className={`px-4 py-2.5 ${COL.holding}`}>
                <Badge variant={holdingVariant(ev.holdingStatus)}>
                  {t.holdingStatuses[ev.holdingStatus]}
                </Badge>
              </td>
              <td className="px-4 py-2.5">
                <Badge variant={assignVariant(ev.assignStatus)}>
                  {t.assignStatuses[ev.assignStatus]}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
