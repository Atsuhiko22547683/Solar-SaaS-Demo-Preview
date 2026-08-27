"use client";

// 施工一覧の検索・絞り込みパネル。
// 顧客管理配下の各一覧で共通の折りたたみパネル（ListFilterPanel）+ 検索範囲
// （ListDateRangeField）を使う。検索条件そのもの・URL クエリ名は従来どおり。
// 並び替えは検索パネルではなく一覧直前（表示件数の横）の ListSortSelect が持つ。

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ListDateRangeField, ListFilterPanel } from "@/components/list/list-filter-panel";
import {
  FILTER_INPUT_CLASS,
  FILTER_LABEL_CLASS,
  FILTER_SELECT_CLASS,
} from "@/components/list/list-shell";
import { labels } from "@/lib/i18n/labels";

import { CONSTRUCTION_STATUS_VALUES, SURVEY_STATUS_VALUES } from "../customers/constants";

const BASE_PATH = "/constructions";

interface ConstructionFilterProps {
  query: string;
  status: string;
  surveyStatus: string;
  dateField: string;
  from: string;
  to: string;
  activeCount: number;
  defaultOpen: boolean;
}

export function ConstructionFilter({
  query,
  status,
  surveyStatus,
  dateField,
  from,
  to,
  activeCount,
  defaultOpen,
}: ConstructionFilterProps) {
  const router = useRouter();
  const t = labels.constructionList.filters;
  const l = labels.constructionList;
  const c = labels.customer;

  const [queryValue, setQueryValue] = useState(query);
  const [statusValue, setStatusValue] = useState(status);
  const [surveyValue, setSurveyValue] = useState(surveyStatus);
  const [dateFieldValue, setDateFieldValue] = useState(dateField);
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);

  function applyFilters() {
    const params = new URLSearchParams();
    const q = queryValue.trim();
    if (q) params.set("query", q);
    if (statusValue) params.set("status", statusValue);
    if (surveyValue) params.set("surveyStatus", surveyValue);
    // 日付対象は期間が指定されているときだけ意味を持つ。
    if (fromValue || toValue) {
      if (dateFieldValue && dateFieldValue !== "all") params.set("dateField", dateFieldValue);
      if (fromValue) params.set("from", fromValue);
      if (toValue) params.set("to", toValue);
    }
    const qs = params.toString();
    router.push(qs ? `${BASE_PATH}?${qs}` : BASE_PATH);
  }

  function clearFilters() {
    setQueryValue("");
    setStatusValue("");
    setSurveyValue("");
    setDateFieldValue("all");
    setFromValue("");
    setToValue("");
    router.push(BASE_PATH);
  }

  return (
    <ListFilterPanel
      idPrefix="con"
      activeCount={activeCount}
      defaultOpen={defaultOpen}
      onSubmit={applyFilters}
      onClear={clearFilters}
    >
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

      {/* 検索範囲（左）→ 日付対象（右）は 1 つの塊として扱う。
          別々に flex-wrap させると折り返しで左右が入れ替わって見えるため、
          この 2 つだけは同じコンテナに入れて必ず「範囲 → 対象」の並びを保つ。
          日付対象の既定は「すべて」= 施工予定日 / 着工日 / 完工日 を横断。 */}
      <div className="flex flex-wrap items-end gap-3">
        <ListDateRangeField
          idPrefix="con"
          from={fromValue}
          to={toValue}
          onFromChange={setFromValue}
          onToChange={setToValue}
        />

        <div className="space-y-1">
          <label htmlFor="con-date-field" className={FILTER_LABEL_CLASS}>
            {t.dateField}
          </label>
          <select
            id="con-date-field"
            value={dateFieldValue}
            onChange={(e) => setDateFieldValue(e.target.value)}
            className={FILTER_SELECT_CLASS}
          >
            {(["all", "planned", "started", "completed"] as const).map((v) => (
              <option key={v} value={v}>
                {l.dateFieldLabels[v]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </ListFilterPanel>
  );
}
