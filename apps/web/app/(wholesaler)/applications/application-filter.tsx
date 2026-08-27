"use client";

// 設置申請一覧の検索・絞り込みバー。構成・スタイルは S-032 顧客一覧の
// customer-filter.tsx と同型（ローカル state → 「検索」で URL クエリへ反映）。
// 申請種別の選択肢は DB 実データ（Application.type の distinct）から供給される。

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ListDateRangeField, ListFilterPanel } from "@/components/list/list-filter-panel";
import {
  FILTER_INPUT_CLASS,
  FILTER_LABEL_CLASS,
  FILTER_SELECT_CLASS,
} from "@/components/list/list-shell";
import { labels } from "@/lib/i18n/labels";

import { APPLICATION_FILTER_VALUES } from "./constants";

interface ApplicationFilterProps {
  query: string;
  status: string;
  type: string;
  from: string;
  to: string;
  types: string[];
  activeCount: number;
  defaultOpen: boolean;
}

export function ApplicationFilter({
  query,
  status,
  type,
  from,
  to,
  types,
  activeCount,
  defaultOpen,
}: ApplicationFilterProps) {
  const router = useRouter();
  const t = labels.applicationList.filters;
  const c = labels.customer;

  const [queryValue, setQueryValue] = useState(query);
  const [statusValue, setStatusValue] = useState(status);
  const [typeValue, setTypeValue] = useState(type);
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);

  function applyFilters() {
    const params = new URLSearchParams();
    const q = queryValue.trim();
    if (q) params.set("query", q);
    if (statusValue) params.set("status", statusValue);
    if (typeValue) params.set("type", typeValue);
    if (fromValue) params.set("from", fromValue);
    if (toValue) params.set("to", toValue);
    const qs = params.toString();
    router.push(qs ? `/applications?${qs}` : "/applications");
  }

  function clearFilters() {
    setQueryValue("");
    setStatusValue("");
    setTypeValue("");
    setFromValue("");
    setToValue("");
    router.push("/applications");
  }

  return (
    <ListFilterPanel
      idPrefix="app"
      activeCount={activeCount}
      defaultOpen={defaultOpen}
      onSubmit={applyFilters}
      onClear={clearFilters}
    >
      <div className="space-y-1">
        <label htmlFor="app-query" className={FILTER_LABEL_CLASS}>
          {t.customerName}
        </label>
        <input
          id="app-query"
          type="search"
          value={queryValue}
          onChange={(e) => setQueryValue(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          className={`${FILTER_INPUT_CLASS} w-56`}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="app-status" className={FILTER_LABEL_CLASS}>
          {t.status}
        </label>
        <select
          id="app-status"
          value={statusValue}
          onChange={(e) => setStatusValue(e.target.value)}
          className={FILTER_SELECT_CLASS}
        >
          <option value="">{t.all}</option>
          {APPLICATION_FILTER_VALUES.map((s) => (
            <option key={s} value={s}>
              {c.subsidyStatusLabels[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="app-type" className={FILTER_LABEL_CLASS}>
          {t.type}
        </label>
        <select
          id="app-type"
          value={typeValue}
          onChange={(e) => setTypeValue(e.target.value)}
          className={FILTER_SELECT_CLASS}
        >
          <option value="">{t.all}</option>
          {types.map((ty) => (
            <option key={ty} value={ty}>
              {ty}
            </option>
          ))}
        </select>
      </div>

      <ListDateRangeField
        idPrefix="app"
        from={fromValue}
        to={toValue}
        onFromChange={setFromValue}
        onToChange={setToValue}
      />
    </ListFilterPanel>
  );
}
