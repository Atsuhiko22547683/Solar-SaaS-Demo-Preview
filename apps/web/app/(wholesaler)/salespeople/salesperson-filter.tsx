"use client";

// 販売員一覧の検索・絞り込みパネル。
// 顧客管理配下の各一覧と同じ共通折りたたみパネル（ListFilterPanel）を再利用する。
// 並び替えは検索パネルではなく一覧直前（表示件数の横）の ListSortSelect が持つ。

import { EMPLOYMENT_TYPE_VALUES } from "@solar/contracts";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ListFilterPanel } from "@/components/list/list-filter-panel";
import {
  FILTER_INPUT_CLASS,
  FILTER_LABEL_CLASS,
  FILTER_SELECT_CLASS,
} from "@/components/list/list-shell";
import { labels } from "@/lib/i18n/labels";

const BASE_PATH = "/salespeople";

interface RelationshipChoice {
  id: string;
  dealerName: string;
}

interface SalespersonFilterProps {
  /** 現在のタブ。絞り込みを適用しても所属タブは維持する。 */
  affiliation: "self" | "dealer";
  query: string;
  relationshipId: string;
  employmentType: string;
  /** 二次店タブでの所属絞り込みの選択肢。自社タブでは使わない。 */
  relationships: RelationshipChoice[];
  activeCount: number;
  defaultOpen: boolean;
}

export function SalespersonFilter({
  affiliation,
  query,
  relationshipId,
  employmentType,
  relationships,
  activeCount,
  defaultOpen,
}: SalespersonFilterProps) {
  const router = useRouter();
  const t = labels.salespersonList.filters;
  const l = labels.salespersonList;

  const [queryValue, setQueryValue] = useState(query);
  const [relationshipValue, setRelationshipValue] = useState(relationshipId);
  const [employmentValue, setEmploymentValue] = useState(employmentType);

  /** 所属タブは絞り込みと独立なので、常に URL へ引き継ぐ。 */
  function withTab(params: URLSearchParams): string {
    if (affiliation === "dealer") params.set("tab", "dealer");
    const qs = params.toString();
    return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
  }

  function applyFilters() {
    const params = new URLSearchParams();
    const q = queryValue.trim();
    if (q) params.set("query", q);
    if (affiliation === "dealer" && relationshipValue) {
      params.set("relationshipId", relationshipValue);
    }
    if (employmentValue) params.set("employmentType", employmentValue);
    router.push(withTab(params));
  }

  function clearFilters() {
    setQueryValue("");
    setRelationshipValue("");
    setEmploymentValue("");
    router.push(withTab(new URLSearchParams()));
  }

  return (
    <ListFilterPanel
      idPrefix="sp"
      activeCount={activeCount}
      defaultOpen={defaultOpen}
      onSubmit={applyFilters}
      onClear={clearFilters}
    >
      <div className="space-y-1">
        <label htmlFor="sp-query" className={FILTER_LABEL_CLASS}>
          {t.name}
        </label>
        <input
          id="sp-query"
          type="search"
          value={queryValue}
          onChange={(e) => setQueryValue(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          className={`${FILTER_INPUT_CLASS} w-56`}
        />
      </div>

      {/* 所属二次店での絞り込みは二次店スタッフタブでのみ意味を持つ。 */}
      {affiliation === "dealer" ? (
        <div className="space-y-1">
          <label htmlFor="sp-relationship-filter" className={FILTER_LABEL_CLASS}>
            {t.company}
          </label>
          <select
            id="sp-relationship-filter"
            value={relationshipValue}
            onChange={(e) => setRelationshipValue(e.target.value)}
            className={FILTER_SELECT_CLASS}
          >
            <option value="">{t.all}</option>
            {relationships.map((r) => (
              <option key={r.id} value={r.id}>
                {r.dealerName}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-1">
        <label htmlFor="sp-employment" className={FILTER_LABEL_CLASS}>
          {t.employmentType}
        </label>
        <select
          id="sp-employment"
          value={employmentValue}
          onChange={(e) => setEmploymentValue(e.target.value)}
          className={FILTER_SELECT_CLASS}
        >
          <option value="">{t.all}</option>
          {EMPLOYMENT_TYPE_VALUES.map((v) => (
            <option key={v} value={v}>
              {l.employmentTypeLabels[v] ?? v}
            </option>
          ))}
        </select>
      </div>
    </ListFilterPanel>
  );
}
