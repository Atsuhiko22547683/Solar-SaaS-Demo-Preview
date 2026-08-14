"use client";

// 施工一覧の検索・絞り込みバー。構成・スタイルは S-032 顧客一覧の
// customer-filter.tsx と同型（ローカル state → 「検索」で URL クエリへ反映）。

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  FILTER_INPUT_CLASS,
  FILTER_LABEL_CLASS,
  FILTER_SELECT_CLASS,
} from "@/components/list/list-shell";
import { Button } from "@/components/ui/button";
import { labels } from "@/lib/i18n/labels";

import { CONSTRUCTION_STATUS_VALUES, SURVEY_STATUS_VALUES } from "../customers/constants";

interface ConstructionFilterProps {
  query: string;
  status: string;
  surveyStatus: string;
  from: string;
  to: string;
}

export function ConstructionFilter({
  query,
  status,
  surveyStatus,
  from,
  to,
}: ConstructionFilterProps) {
  const router = useRouter();
  const t = labels.constructionList.filters;
  const c = labels.customer;

  const [queryValue, setQueryValue] = useState(query);
  const [statusValue, setStatusValue] = useState(status);
  const [surveyValue, setSurveyValue] = useState(surveyStatus);
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);

  function applyFilters() {
    const params = new URLSearchParams();
    const q = queryValue.trim();
    if (q) params.set("query", q);
    if (statusValue) params.set("status", statusValue);
    if (surveyValue) params.set("surveyStatus", surveyValue);
    if (fromValue) params.set("from", fromValue);
    if (toValue) params.set("to", toValue);
    const qs = params.toString();
    router.push(qs ? `/constructions?${qs}` : "/constructions");
  }

  function clearFilters() {
    setQueryValue("");
    setStatusValue("");
    setSurveyValue("");
    setFromValue("");
    setToValue("");
    router.push("/constructions");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        applyFilters();
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="con-query" className={FILTER_LABEL_CLASS}>
            {t.customerName}
          </label>
          <input
            id="con-query"
            type="search"
            value={queryValue}
            onChange={(e) => setQueryValue(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchPlaceholder}
            className={`${FILTER_INPUT_CLASS} w-56`}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="con-status" className={FILTER_LABEL_CLASS}>
            {t.status}
          </label>
          <select
            id="con-status"
            value={statusValue}
            onChange={(e) => setStatusValue(e.target.value)}
            className={FILTER_SELECT_CLASS}
          >
            <option value="">{t.all}</option>
            {CONSTRUCTION_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {c.constructionStatusLabels[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="con-survey" className={FILTER_LABEL_CLASS}>
            {t.surveyStatus}
          </label>
          <select
            id="con-survey"
            value={surveyValue}
            onChange={(e) => setSurveyValue(e.target.value)}
            className={FILTER_SELECT_CLASS}
          >
            <option value="">{t.all}</option>
            {SURVEY_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {c.surveyStatusLabels[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="con-from" className={FILTER_LABEL_CLASS}>
            {t.from}
          </label>
          <input
            id="con-from"
            type="date"
            value={fromValue}
            onChange={(e) => setFromValue(e.target.value)}
            className={`${FILTER_INPUT_CLASS} w-40`}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="con-to" className={FILTER_LABEL_CLASS}>
            {t.to}
          </label>
          <input
            id="con-to"
            type="date"
            value={toValue}
            onChange={(e) => setToValue(e.target.value)}
            className={`${FILTER_INPUT_CLASS} w-40`}
          />
        </div>

        <Button type="submit">{t.search}</Button>
        <Button type="button" variant="outline" onClick={clearFilters}>
          {t.clear}
        </Button>
      </div>
    </form>
  );
}
