// 催事日報一覧の検索条件・並べ替え（URL クエリ → 検証済みの条件）。純関数。

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

// 合計（抽選 / 着座 / アポ）は保存していない算出値なので、並べ替えはメモリ上で行う。
export const REPORT_SORT_FIELDS = [
  "eventDate",
  "venuePlace",
  "category",
  "venueChain",
  "lotteryTotal",
  "seatedTotal",
  "apptTotal",
  "createdAt",
] as const;
export type ReportSortField = (typeof REPORT_SORT_FIELDS)[number];

export const REPORT_CATEGORY_VALUES = ["HOUSING_EQUIPMENT", "REAL_ESTATE"] as const;
export const REPORT_CHAIN_VALUES = ["CAINZ_W", "CAINZ_V", "SHIMACHU", "KOMERI", "OTHER"] as const;

export interface ReportListQuery {
  eventDate: DateRange;
  venuePlace?: string;
  category?: (typeof REPORT_CATEGORY_VALUES)[number];
  venueChain?: (typeof REPORT_CHAIN_VALUES)[number];
  areaInFacility?: string;
  /** 提出スタッフ。管理者のときだけ効く（スタッフは本人分しか対象にならない）。 */
  submittedBy?: string;
  sort: SortState<ReportSortField>;
  page: number;
  errors: string[];
}

export const REPORT_DEFAULT_SORT: SortState<ReportSortField> = {
  field: "createdAt",
  direction: "desc",
};

export function parseReportQuery(raw: RawParams): ReportListQuery {
  const errors: string[] = [];
  const f = labels.partner.report.filters;
  return {
    eventDate: dateRange(raw, "eventDateFrom", "eventDateTo", f.eventDate, errors),
    venuePlace: text(raw, "venuePlace"),
    category: oneOf(raw, "category", REPORT_CATEGORY_VALUES),
    venueChain: oneOf(raw, "venueChain", REPORT_CHAIN_VALUES),
    areaInFacility: text(raw, "areaInFacility"),
    submittedBy: first(raw, "submittedBy"),
    sort: sort(raw, REPORT_SORT_FIELDS, REPORT_DEFAULT_SORT),
    page: page(raw),
    errors,
  };
}
