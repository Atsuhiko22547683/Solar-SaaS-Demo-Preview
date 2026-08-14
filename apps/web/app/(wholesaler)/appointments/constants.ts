// アポイント一覧の値域・バッジ配色。
//
// customers/constants.ts と同じ役割 — "server-only" を付けないことで client
// component（filter / table）が server-only な data.ts を巻き込まずに
// 定数と型を import できる。

import type { BadgeVariant } from "@/components/ui/badge";
import type { AppointmentStatus, PreCallResult } from "@solar/db";

/** 表示順・値域の単一の真実（filter と page の searchParams 検証が共有）。 */
export const APPOINTMENT_STATUS_VALUES: AppointmentStatus[] = [
  "UNCONFIRMED",
  "PRE_CALL_DONE",
  "VISITED",
  "ABSENT",
  "CANCELLED",
  "RESCHEDULED",
];

/** 訪問済=成功 / 未確認・マエカク済=進行中 / 不在・再調整=注意 / キャンセル=終了。 */
export function appointmentStatusVariant(s: AppointmentStatus): BadgeVariant {
  switch (s) {
    case "VISITED":
      return "success";
    case "PRE_CALL_DONE":
    case "UNCONFIRMED":
      return "default";
    case "ABSENT":
    case "RESCHEDULED":
      return "warning";
    case "CANCELLED":
      return "secondary";
  }
}

/** マエカク結果のバッジ配色（承認=成功 / 折返し・日程変更=注意 / 不在・中止=灰）。 */
export function preCallResultVariant(r: PreCallResult): BadgeVariant {
  switch (r) {
    case "APPROVED":
      return "success";
    case "CALLBACK":
    case "RESCHEDULED":
      return "warning";
    case "ABSENT":
      return "default";
    case "CANCELLED":
      return "secondary";
  }
}
