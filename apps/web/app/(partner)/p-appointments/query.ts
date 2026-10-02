// アポイント一覧の検索条件・並べ替え（URL クエリ → 検証済みの条件）。
//
// 初訪アポと訪問アポは保存先も項目も違う。条件は「両方に効くもの」「初訪だけ」
// 「訪問だけ」に分け、区分の選択に応じて適用・無効化する。使えない条件は
// 黙って無視せず、画面に注記を出す（notes）。
//
// "use client" も "server-only" も付けない純関数。ページとローダーが同じ結果を見る。

import { labels } from "@/lib/i18n/labels";
import {
  dateRange,
  first,
  oneOf,
  page,
  sort,
  text,
  type DateRange,
  type RawParams,
  type SortState,
} from "@/lib/partner/list-query";

export const APPOINTMENT_SORT_FIELDS = [
  "kind",
  "customerName",
  "firstVisitAt",
  "venuePlace",
  "createdAt",
] as const;
export type AppointmentSortField = (typeof APPOINTMENT_SORT_FIELDS)[number];

export const KIND_FILTER_VALUES = ["first-visit", "visit"] as const;
export type KindFilter = (typeof KIND_FILTER_VALUES)[number];

export const SALES_CHANNEL_VALUES = [
  "VISIT_SALES",
  "INBOUND",
  "EVENT",
  "REFERRAL",
  "OTHER",
] as const;

export interface AppointmentListQuery {
  kind?: KindFilter;
  // 初訪アポにだけ効く条件
  customerName?: string;
  venuePlace?: string;
  firstVisitAt: DateRange;
  // 両方に効く条件
  createdAt: DateRange;
  // 訪問アポにだけ効く条件（区分が「訪問アポ」のときだけ受け付ける）
  tossDept?: string;
  closeDept?: string;
  salespersonId?: string;
  salesChannel?: (typeof SALES_CHANNEL_VALUES)[number];
  /** 提出スタッフ。管理者のときだけ効く（初訪・訪問の両方に適用する）。 */
  submittedBy?: string;
  sort: SortState<AppointmentSortField>;
  page: number;
  errors: string[];
  notes: string[];
  /** 初訪専用の条件が 1 つでも入っているか（区分「すべて」で訪問アポを除外する根拠）。 */
  firstVisitOnlyActive: boolean;
}

export const APPOINTMENT_DEFAULT_SORT: SortState<AppointmentSortField> = {
  field: "createdAt",
  direction: "desc",
};

export function parseAppointmentQuery(raw: RawParams): AppointmentListQuery {
  const errors: string[] = [];
  const notes: string[] = [];
  const f = labels.partner.appointment.filters;
  const kind = oneOf(raw, "kind", KIND_FILTER_VALUES);

  const customerName = kind === "visit" ? undefined : text(raw, "customerName");
  const venuePlace = kind === "visit" ? undefined : text(raw, "venuePlace");
  const firstVisitAt =
    kind === "visit"
      ? {}
      : dateRange(raw, "firstVisitAtFrom", "firstVisitAtTo", f.firstVisitAt, errors);
  const createdAt = dateRange(raw, "createdAtFrom", "createdAtTo", f.createdAt, errors);

  const tossDept = kind === "visit" ? text(raw, "tossDept") : undefined;
  const closeDept = kind === "visit" ? text(raw, "closeDept") : undefined;
  const salespersonId = kind === "visit" ? first(raw, "salespersonId") : undefined;
  const salesChannel =
    kind === "visit" ? oneOf(raw, "salesChannel", SALES_CHANNEL_VALUES) : undefined;

  const firstVisitOnlyActive = Boolean(
    customerName || venuePlace || firstVisitAt.from || firstVisitAt.to,
  );
  if (!kind && firstVisitOnlyActive) {
    notes.push(labels.partner.list.firstVisitOnlyApplied);
  }

  return {
    kind,
    submittedBy: first(raw, "submittedBy"),
    customerName,
    venuePlace,
    firstVisitAt,
    createdAt,
    tossDept,
    closeDept,
    salespersonId,
    salesChannel,
    sort: sort(raw, APPOINTMENT_SORT_FIELDS, APPOINTMENT_DEFAULT_SORT),
    page: page(raw),
    errors,
    notes,
    firstVisitOnlyActive,
  };
}
