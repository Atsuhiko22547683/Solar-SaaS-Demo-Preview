// 成約一覧の検索条件・並べ替え（URL クエリ → 検証済みの条件）。純関数。

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

export const CONTRACT_SORT_FIELDS = [
  "contractDate",
  "tossDate",
  "tossDept",
  "salesRep",
  "referralBranch",
  "affiliation",
  "acquisitionChannel",
  "createdAt",
] as const;
export type ContractSortField = (typeof CONTRACT_SORT_FIELDS)[number];

export const AFFILIATION_VALUES = ["VE", "PS"] as const;
export const CONTRACT_CHANNEL_VALUES = [
  "VISIT_SALES",
  "TELE_APPOINTMENT",
  "REFERRAL",
  "EVENT",
  "INBOUND",
] as const;

export interface ContractListQuery {
  contractDate: DateRange;
  tossDate: DateRange;
  tossDept?: string;
  apptGetter?: string;
  salesRep?: string;
  referralBranch?: string;
  affiliation?: (typeof AFFILIATION_VALUES)[number];
  affiliationDept?: string;
  acquisitionChannel?: (typeof CONTRACT_CHANNEL_VALUES)[number];
  submittedBy?: string;
  sort: SortState<ContractSortField>;
  page: number;
  errors: string[];
}

export const CONTRACT_DEFAULT_SORT: SortState<ContractSortField> = {
  field: "createdAt",
  direction: "desc",
};

export function parseContractQuery(raw: RawParams): ContractListQuery {
  const errors: string[] = [];
  const f = labels.partner.contract.filters;
  return {
    contractDate: dateRange(raw, "contractDateFrom", "contractDateTo", f.contractDate, errors),
    tossDate: dateRange(raw, "tossDateFrom", "tossDateTo", f.tossDate, errors),
    tossDept: text(raw, "tossDept"),
    apptGetter: text(raw, "apptGetter"),
    salesRep: text(raw, "salesRep"),
    referralBranch: text(raw, "referralBranch"),
    affiliation: oneOf(raw, "affiliation", AFFILIATION_VALUES),
    affiliationDept: text(raw, "affiliationDept"),
    acquisitionChannel: oneOf(raw, "acquisitionChannel", CONTRACT_CHANNEL_VALUES),
    submittedBy: first(raw, "submittedBy"),
    sort: sort(raw, CONTRACT_SORT_FIELDS, CONTRACT_DEFAULT_SORT),
    page: page(raw),
    errors,
  };
}
