// 販売員一覧の検索条件・並べ替え（URL クエリ → 検証済みの条件）。純関数。
//
// 「アカウント紐付け」は Salesperson.userId の有無で判定する。氏名の一致などで
// 推測しない（紐付けの設定は利用者アカウント管理側の操作）。

import { oneOf, page, sort, text, type RawParams, type SortState } from "@/lib/partner/list-query";

export const SALESPERSON_SORT_FIELDS = ["name", "kana", "employmentType", "isActive"] as const;
export type SalespersonSortField = (typeof SALESPERSON_SORT_FIELDS)[number];

export const SALESPERSON_EMPLOYMENT_VALUES = [
  "EMPLOYEE",
  "CONTRACT",
  "PART_TIME",
  "SUBCONTRACT",
  "OTHER",
] as const;
export const SALESPERSON_ACTIVE_VALUES = ["ACTIVE", "INACTIVE"] as const;
export const SALESPERSON_LINK_VALUES = ["LINKED", "UNLINKED"] as const;

export interface SalespersonListQuery {
  keyword?: string;
  employmentType?: (typeof SALESPERSON_EMPLOYMENT_VALUES)[number];
  isActive?: (typeof SALESPERSON_ACTIVE_VALUES)[number];
  link?: (typeof SALESPERSON_LINK_VALUES)[number];
  sort: SortState<SalespersonSortField>;
  page: number;
  errors: string[];
}

/** 既定は従来の並び（有効な人が先、カナ順）。 */
export const SALESPERSON_DEFAULT_SORT: SortState<SalespersonSortField> = {
  field: "isActive",
  direction: "desc",
};

export function parseSalespersonQuery(raw: RawParams): SalespersonListQuery {
  return {
    keyword: text(raw, "keyword"),
    employmentType: oneOf(raw, "employmentType", SALESPERSON_EMPLOYMENT_VALUES),
    isActive: oneOf(raw, "isActive", SALESPERSON_ACTIVE_VALUES),
    link: oneOf(raw, "link", SALESPERSON_LINK_VALUES),
    sort: sort(raw, SALESPERSON_SORT_FIELDS, SALESPERSON_DEFAULT_SORT),
    page: page(raw),
    // 日付・数値の範囲条件が無いのでこの画面に検証エラーは発生しない。
    errors: [],
  };
}
