// 担当顧客一覧の検索条件・並べ替え（URL クエリ → 検証済みの条件）。純関数。
//
// お客様名の検索・並べ替えは、マスキングで名前を表示している場合には使えない
// （非表示情報を検索の抜け道にしない）。適用可否はローダーがマスキング設定を見て決める。

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

export const CUSTOMER_SORT_FIELDS = ["name", "createdAt", "updatedAt"] as const;
export type CustomerSortField = (typeof CUSTOMER_SORT_FIELDS)[number];

export const DEAL_STATUS_VALUES = [
  "VISIT_PLANNED",
  "VISITED",
  "PROPOSING",
  "QUOTED",
  "CONSIDERING",
  "LIKELY_CONTRACT",
  "CONTRACTED",
  "LOST",
] as const;

export const CUSTOMER_SALES_CHANNEL_VALUES = [
  "VISIT_SALES",
  "INBOUND",
  "EVENT",
  "REFERRAL",
  "OTHER",
] as const;

export const CUSTOMER_STATUS_VALUES = [
  "NEW",
  "PRE_CALL_WAIT",
  "PRE_CALL_DONE",
  "VISIT_PLANNED",
  "IN_NEGOTIATION",
  "CONTRACTED",
  "LOST",
  "IN_CONSTRUCTION",
  "COMPLETED",
] as const;

export interface CustomerListQuery {
  name?: string;
  dealStatus?: (typeof DEAL_STATUS_VALUES)[number];
  salesChannel?: (typeof CUSTOMER_SALES_CHANNEL_VALUES)[number];
  createdAt: DateRange;
  /** 以下は二次店管理者だけが使う条件（スタッフの画面には出さない）。 */
  status?: (typeof CUSTOMER_STATUS_VALUES)[number];
  salespersonId?: string;
  /** フリガナ。氏名と同じくマスキング中は使わせない（非表示情報の抜け道にしない）。 */
  kana?: string;
  /** 電話番号（携帯・固定・代表のいずれか）。 */
  phone?: string;
  /** 住所（都道府県・市区町村・番地のいずれか）。 */
  address?: string;
  /** 過去の催事場所（登録元の催事、または商談履歴の催事）。 */
  venue?: string;
  sort: SortState<CustomerSortField>;
  page: number;
  errors: string[];
}

export const CUSTOMER_DEFAULT_SORT: SortState<CustomerSortField> = {
  field: "createdAt",
  direction: "desc",
};

export function parseCustomerQuery(raw: RawParams): CustomerListQuery {
  const errors: string[] = [];
  const f = labels.partner.customer.filters;
  return {
    name: text(raw, "name"),
    dealStatus: oneOf(raw, "dealStatus", DEAL_STATUS_VALUES),
    salesChannel: oneOf(raw, "salesChannel", CUSTOMER_SALES_CHANNEL_VALUES),
    createdAt: dateRange(raw, "createdAtFrom", "createdAtTo", f.registeredAt, errors),
    status: oneOf(raw, "status", CUSTOMER_STATUS_VALUES),
    salespersonId: first(raw, "salespersonId"),
    kana: text(raw, "kana"),
    phone: text(raw, "phone", 32),
    address: text(raw, "address"),
    venue: text(raw, "venue"),
    sort: sort(raw, CUSTOMER_SORT_FIELDS, CUSTOMER_DEFAULT_SORT),
    page: page(raw),
    errors,
  };
}
