// 催事で獲得したアポイントの一覧（イベント詳細・レーン日付ポップアップ共通）。
//
// 表示のたびに作るデモ値ではなく、DB の Appointment をそのまま出す。
// 行から顧客詳細へ進めるようにして、架空の内容を出すダイアログは置かない。

import Link from "next/link";

import { labels } from "@/lib/i18n/labels";

import type { AcquiredAppointmentRow } from "@/app/(wholesaler)/event-detail/acquired-appointment-data";

const TH = "px-3 py-2 text-left text-xs font-semibold text-mute-light";

export function AcquiredAppointmentsTable({ rows }: { rows: AcquiredAppointmentRow[] }) {
  const a = labels.eventList.appointmentColumns;

  if (rows.length === 0) {
    return <p className="text-mute-light text-sm">{labels.eventList.appointmentPlaceholder}</p>;
  }

  return (
    <div className="border-hairline-light overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-hairline-light bg-surface-soft/50 border-b">
            <th className={TH}>{a.customerName}</th>
            <th className={TH}>{a.dateTime}</th>
            <th className={TH}>{a.address}</th>
            <th className={TH}>{a.company}</th>
            <th className={TH}>{a.memo}</th>
          </tr>
        </thead>
        <tbody className="divide-hairline-light divide-y">
          {rows.map((r) => (
            <tr key={r.appointmentId} className="hover:bg-page transition-colors">
              <td className="whitespace-nowrap px-3 py-2.5 font-medium">
                <Link
                  href={`/customers/${r.customerId}`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {r.customerName}
                  {labels.customer.honorific}
                </Link>
              </td>
              <td className="text-body-light whitespace-nowrap px-3 py-2.5 tabular-nums">
                {r.dateTime}
              </td>
              <td className="text-body-light px-3 py-2.5">{r.address}</td>
              <td className="text-body-light px-3 py-2.5">
                {r.companyName ?? labels.partner.common.dash}
              </td>
              <td className="text-body-light px-3 py-2.5">{r.memo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
