// 手数料（営業フィー）一覧の検索条件・並べ替え（URL クエリ → 検証済みの条件）。純関数。
//
// 対象月は 'YYYY-MM' の文字列列（Incentive.settledMonth）なので、範囲は
// 文字列の大小比較で足りる（桁が固定なので辞書順＝時系列順）。

import { labels } from "@/lib/i18n/labels";
import {
  dateRange,
  first,
  numberRange,
  page,
  sort,
  type DateRange,
  type NumberRange,
  type RawParams,
  type SortState,
} from "@/lib/partner/list-query";

export const COMMISSION_SORT_FIELDS = ["settledMonth", "amount", "finalizedAt"] as const;
export type CommissionSortField = (typeof COMMISSION_SORT_FIELDS)[number];

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface CommissionListQuery {
  monthFrom?: string;
  monthTo?: string;
  /** 対象案件を契約日で絞る（Incentive → Contract.contractDate）。 */
  contractDate: DateRange;
  amount: NumberRange;
  sort: SortState<CommissionSortField>;
  page: number;
  errors: string[];
}

export const COMMISSION_DEFAULT_SORT: SortState<CommissionSortField> = {
  field: "settledMonth",
  direction: "desc",
};

/** 'YYYY-MM' だけを受け付ける。形式違いは条件に使わず、その旨をエラーに出す。 */
function month(raw: RawParams, key: string, label: string, errors: string[]): string | undefined {
  const v = first(raw, key);
  if (!v) return undefined;
  if (!MONTH_RE.test(v)) {
    errors.push(`${label}の指定が正しくありません`);
    return undefined;
  }
  return v;
}

export function parseCommissionQuery(raw: RawParams): CommissionListQuery {
  const errors: string[] = [];
  const f = labels.partner.commission.filters;
  const monthFrom = month(raw, "monthFrom", f.settledMonth, errors);
  const monthTo = month(raw, "monthTo", f.settledMonth, errors);
  if (monthFrom && monthTo && monthFrom > monthTo) {
    errors.push(`${f.settledMonth}の開始日が終了日より後になっています`);
    return {
      contractDate: dateRange(raw, "contractDateFrom", "contractDateTo", f.contractDate, errors),
      amount: numberRange(raw, "amountMin", "amountMax", f.amount, errors),
      sort: sort(raw, COMMISSION_SORT_FIELDS, COMMISSION_DEFAULT_SORT),
      page: page(raw),
      errors,
    };
  }
  return {
    monthFrom,
    monthTo,
    contractDate: dateRange(raw, "contractDateFrom", "contractDateTo", f.contractDate, errors),
    amount: numberRange(raw, "amountMin", "amountMax", f.amount, errors),
    sort: sort(raw, COMMISSION_SORT_FIELDS, COMMISSION_DEFAULT_SORT),
    page: page(raw),
    errors,
  };
}
