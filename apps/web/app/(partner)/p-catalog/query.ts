// カタログ一覧の検索条件・並べ替え（URL クエリ → 検証済みの条件）。純関数。
//
// 価格は「卸値」（スタッフに表示している価格）を数値として扱う。仕入値・原価・粗利は
// 条件にも並べ替えにも含めない（そもそもローダーが select しない）。

import { labels } from "@/lib/i18n/labels";
import {
  numberRange,
  oneOf,
  page,
  sort,
  text,
  type NumberRange,
  type RawParams,
  type SortState,
} from "@/lib/partner/list-query";

export const CATALOG_SORT_FIELDS = [
  "name",
  "category",
  "maker",
  "dealerPrice",
  "capacity",
] as const;
export type CatalogSortField = (typeof CATALOG_SORT_FIELDS)[number];

export const BATTERY_FUNCTION_VALUES = ["SINGLE", "SPECIFIC_LOAD", "FULL_LOAD"] as const;

export interface CatalogListQuery {
  /** カテゴリ。候補（公開商品に実在するもの）との照合はローダー側で行う。 */
  category?: string;
  /** メーカー。候補との照合はローダー側で行い、対象外なら「すべて」へ戻す。 */
  maker?: string;
  /** 商品名・型番の部分一致。 */
  keyword?: string;
  dealerPrice: NumberRange;
  series?: string;
  capacity: NumberRange;
  batteryFunctionType?: (typeof BATTERY_FUNCTION_VALUES)[number];
  sort: SortState<CatalogSortField>;
  page: number;
  errors: string[];
}

export const CATALOG_DEFAULT_SORT: SortState<CatalogSortField> = {
  field: "name",
  direction: "asc",
};

export function parseCatalogQuery(raw: RawParams): CatalogListQuery {
  const errors: string[] = [];
  const f = labels.partner.catalog.filters;
  return {
    category: text(raw, "category", 40),
    maker: text(raw, "maker", 100),
    keyword: text(raw, "q"),
    dealerPrice: numberRange(raw, "priceMin", "priceMax", f.dealerPrice, errors),
    series: text(raw, "series"),
    capacity: numberRange(raw, "capacityMin", "capacityMax", f.capacity, errors),
    batteryFunctionType: oneOf(raw, "batteryFunctionType", BATTERY_FUNCTION_VALUES),
    sort: sort(raw, CATALOG_SORT_FIELDS, CATALOG_DEFAULT_SORT),
    page: page(raw),
    errors,
  };
}
