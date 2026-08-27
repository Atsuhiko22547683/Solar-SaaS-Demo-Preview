"use client";

// ローン審査一覧の検索・絞り込みバー。構成・スタイルは S-032 顧客一覧の
// customer-filter.tsx と同型（ローカル state → 「検索」で URL クエリへ反映）。

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ListFilterPanel } from "@/components/list/list-filter-panel";
import {
  FILTER_INPUT_CLASS,
  FILTER_LABEL_CLASS,
  FILTER_SELECT_CLASS,
} from "@/components/list/list-shell";
import { labels } from "@/lib/i18n/labels";

import { DEFECT_FILTER_VALUES, LOAN_REVIEW_STATUS_VALUES } from "./constants";

interface LoanReviewFilterProps {
  query: string;
  status: string;
  defect: string;
  activeCount: number;
  defaultOpen: boolean;
}

export function LoanReviewFilter({
  query,
  status,
  defect,
  activeCount,
  defaultOpen,
}: LoanReviewFilterProps) {
  const router = useRouter();
  const t = labels.loanReviewList.filters;
  const statusLabels = labels.loanReviewList.statusLabels;
  const defectFilterLabels = labels.loanReviewList.defectFilter;

  const [queryValue, setQueryValue] = useState(query);
  const [statusValue, setStatusValue] = useState(status);
  const [defectValue, setDefectValue] = useState(defect);

  function applyFilters() {
    const params = new URLSearchParams();
    const q = queryValue.trim();
    if (q) params.set("query", q);
    if (statusValue) params.set("status", statusValue);
    if (defectValue) params.set("defect", defectValue);
    const qs = params.toString();
    router.push(qs ? `/loan-reviews?${qs}` : "/loan-reviews");
  }

  function clearFilters() {
    setQueryValue("");
    setStatusValue("");
    setDefectValue("");
    router.push("/loan-reviews");
  }

  return (
    <ListFilterPanel
      idPrefix="loan"
      activeCount={activeCount}
      defaultOpen={defaultOpen}
      onSubmit={applyFilters}
      onClear={clearFilters}
    >
      <div className="space-y-1">
        <label htmlFor="loan-query" className={FILTER_LABEL_CLASS}>
          {t.customerName}
        </label>
        <input
          id="loan-query"
          type="search"
          value={queryValue}
          onChange={(e) => setQueryValue(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          className={`${FILTER_INPUT_CLASS} w-56`}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="loan-status" className={FILTER_LABEL_CLASS}>
          {t.status}
        </label>
        <select
          id="loan-status"
          value={statusValue}
          onChange={(e) => setStatusValue(e.target.value)}
          className={FILTER_SELECT_CLASS}
        >
          <option value="">{t.all}</option>
          {LOAN_REVIEW_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="loan-defect" className={FILTER_LABEL_CLASS}>
          {t.defect}
        </label>
        <select
          id="loan-defect"
          value={defectValue}
          onChange={(e) => setDefectValue(e.target.value)}
          className={FILTER_SELECT_CLASS}
        >
          <option value="">{t.all}</option>
          {DEFECT_FILTER_VALUES.map((d) => (
            <option key={d} value={d}>
              {defectFilterLabels[d]}
            </option>
          ))}
        </select>
      </div>
    </ListFilterPanel>
  );
}
