// アポイント一覧の URL クエリ ⇄ 絞り込み条件の変換。
//
// ここに集約する理由は 2 つ。
//  1. 条件・並び替え・ページを URL に持たせて、再読み込み・戻る/進む・詳細からの
//     復帰で同じ結果に戻せるようにする。
//  2. 受け取った値を必ず値域へ丸める。不正な並べ替え項目や壊れた日付で、
//     一覧が黙って全件になったり 0 件になったりしないようにする。
//
// "use client" は付けない — page.tsx（Server Component）と filter（Client）の
// どちらからも使う純関数。

import {
  APPOINTMENT_STATUS_VALUES,
  PARTNER_APPOINTMENT_KIND_VALUES,
  PRE_CALL_FILTER_VALUES,
} from "./constants";

import type { PartnerAppointmentKindValue, PreCallFilterValue } from "./constants";
import type { AppointmentStatus } from "@solar/db";

export const APPOINTMENT_BASE_PATH = "/appointments";

/** URL に載る検索条件。すべて任意で、未指定は「すべて」を意味する。 */
export interface AppointmentQuery {
  query: string;
  /** アポ予定日の範囲。 */
  from: string;
  to: string;
  /** 登録日の範囲。アポ予定日とは別条件で、両方指定すれば AND。 */
  createdFrom: string;
  createdTo: string;
  area: string;
  assigneeUserId: string;
  relationshipId: string;
  appointmentType: string;
  partnerKind: PartnerAppointmentKindValue | "";
  eventId: string;
  eventQuery: string;
  status: AppointmentStatus | "";
  preCall: PreCallFilterValue | "";
}

export const EMPTY_APPOINTMENT_QUERY: AppointmentQuery = {
  query: "",
  from: "",
  to: "",
  createdFrom: "",
  createdTo: "",
  area: "",
  assigneeUserId: "",
  relationshipId: "",
  appointmentType: "",
  partnerKind: "",
  eventId: "",
  eventQuery: "",
  status: "",
  preCall: "",
};

/** "YYYY-MM-DD" 以外は無視する（壊れた日付で全件が消えるのを防ぐ）。 */
export function normalizeDate(value: string | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return Number.isNaN(new Date(value).getTime()) ? "" : value;
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | "" {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : "";
}

/** 期間の前後が逆転しているか。エラー表示に使う（黙って入れ替えない）。 */
export function isReversedRange(from: string, to: string): boolean {
  return from.length > 0 && to.length > 0 && from > to;
}

export function parseAppointmentQuery(
  params: Record<string, string | string[] | undefined>,
): AppointmentQuery {
  const get = (k: string): string | undefined => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    query: get("query")?.trim() ?? "",
    from: normalizeDate(get("from")),
    to: normalizeDate(get("to")),
    createdFrom: normalizeDate(get("createdFrom")),
    createdTo: normalizeDate(get("createdTo")),
    area: get("area")?.trim() ?? "",
    assigneeUserId: get("assigneeUserId")?.trim() ?? "",
    relationshipId: get("relationshipId")?.trim() ?? "",
    appointmentType: get("appointmentType")?.trim() ?? "",
    partnerKind: oneOf(get("partnerKind"), PARTNER_APPOINTMENT_KIND_VALUES),
    eventId: get("eventId")?.trim() ?? "",
    eventQuery: get("eventQuery")?.trim() ?? "",
    status: oneOf(get("status"), APPOINTMENT_STATUS_VALUES),
    preCall: oneOf(get("preCall"), PRE_CALL_FILTER_VALUES),
  };
}

/** 期間が逆転している条件は検索に使わない（0 件ではなくエラーとして見せる）。 */
export function usableQuery(q: AppointmentQuery): AppointmentQuery {
  return {
    ...q,
    ...(isReversedRange(q.from, q.to) ? { from: "", to: "" } : {}),
    ...(isReversedRange(q.createdFrom, q.createdTo) ? { createdFrom: "", createdTo: "" } : {}),
  };
}

/** 有効な条件の数。期間は開始・終了をまとめて 1 条件と数える。 */
export function countActiveFilters(q: AppointmentQuery): number {
  return [
    Boolean(q.query),
    Boolean(q.from || q.to),
    Boolean(q.createdFrom || q.createdTo),
    Boolean(q.area),
    Boolean(q.assigneeUserId),
    Boolean(q.relationshipId),
    Boolean(q.appointmentType),
    Boolean(q.partnerKind),
    Boolean(q.eventId),
    Boolean(q.eventQuery),
    Boolean(q.status),
    Boolean(q.preCall),
  ].filter(Boolean).length;
}

/** 条件を URLSearchParams へ。空の条件は載せない（URL を読みやすく保つ）。 */
export function toSearchParams(q: AppointmentQuery): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (typeof v === "string" && v.length > 0) sp.set(k, v);
  }
  return sp;
}
