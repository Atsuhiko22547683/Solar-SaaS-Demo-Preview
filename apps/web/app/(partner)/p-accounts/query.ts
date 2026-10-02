// 利用者アカウント一覧の検索条件・並べ替え（URL クエリ → 検証済みの条件）。純関数。
//
// この画面には日付・数値の範囲条件が無いので検証エラーは発生しない。
// それでも errors を返すのは、他の一覧と FilterPanel の呼び出し形を揃えるため。

import { oneOf, page, sort, text, type RawParams, type SortState } from "@/lib/partner/list-query";

export const ACCOUNT_SORT_FIELDS = ["name", "email", "status", "lastLoginAt", "createdAt"] as const;
export type AccountSortField = (typeof ACCOUNT_SORT_FIELDS)[number];

export const ACCOUNT_ROLE_VALUES = ["DEALER_ADMIN", "DEALER_STAFF"] as const;
// DELETED は既定では出さないが、条件として選べば確認できる（過去の提出物を辿るため）。
export const ACCOUNT_STATUS_VALUES = ["ACTIVE", "INVITED", "SUSPENDED", "DELETED"] as const;
export const ACCOUNT_LINK_VALUES = ["LINKED", "UNLINKED"] as const;

export interface AccountListQuery {
  keyword?: string;
  role?: (typeof ACCOUNT_ROLE_VALUES)[number];
  status?: (typeof ACCOUNT_STATUS_VALUES)[number];
  link?: (typeof ACCOUNT_LINK_VALUES)[number];
  sort: SortState<AccountSortField>;
  page: number;
  errors: string[];
}

export const ACCOUNT_DEFAULT_SORT: SortState<AccountSortField> = {
  field: "name",
  direction: "asc",
};

export function parseAccountQuery(raw: RawParams): AccountListQuery {
  return {
    keyword: text(raw, "keyword"),
    role: oneOf(raw, "role", ACCOUNT_ROLE_VALUES),
    status: oneOf(raw, "status", ACCOUNT_STATUS_VALUES),
    link: oneOf(raw, "link", ACCOUNT_LINK_VALUES),
    sort: sort(raw, ACCOUNT_SORT_FIELDS, ACCOUNT_DEFAULT_SORT),
    page: page(raw),
    errors: [],
  };
}
