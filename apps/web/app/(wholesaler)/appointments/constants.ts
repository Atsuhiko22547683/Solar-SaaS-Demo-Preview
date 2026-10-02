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

/** フォーム区分（初訪 / 訪問）。アポイント種別（初回訪問・見積提示…）とは別概念。 */
export const PARTNER_APPOINTMENT_KIND_VALUES = ["FIRST_VISIT", "VISIT"] as const;
export type PartnerAppointmentKindValue = (typeof PARTNER_APPOINTMENT_KIND_VALUES)[number];

/**
 * マエカク対応状況の値域。"NONE" は未実施（PreCall が無い）。
 * 表示順は「承認 → 折返し → 日程変更 → 不在 → 中止 → 未実施」の業務順で、
 * enum の文字列順には依存しない。
 */
export const PRE_CALL_FILTER_VALUES = [
  "APPROVED",
  "CALLBACK",
  "RESCHEDULED",
  "ABSENT",
  "CANCELLED",
  "NONE",
] as const;
export type PreCallFilterValue = (typeof PRE_CALL_FILTER_VALUES)[number];
