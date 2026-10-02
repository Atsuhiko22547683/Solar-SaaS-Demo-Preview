"use client";

// 製品カタログの検索・絞り込みパネル。
// 顧客管理配下の各一覧と同じ共通折りたたみパネル（ListFilterPanel）を再利用する。
//
// 検索対象は商品名 / メーカー / シリーズ / 型番の部分一致だけ。この画面のために
// 全文検索基盤は持ち込まない。並び替えは検索条件ではないので、一覧直前の
// ListSortSelect が持つ（このパネルには入れない）。

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ListFilterPanel } from "@/components/list/list-filter-panel";
import { FILTER_INPUT_CLASS, FILTER_LABEL_CLASS } from "@/components/list/list-shell";
import { labels } from "@/lib/i18n/labels";

import { categoryPath } from "./categories";

import type { CatalogCategory } from "@solar/contracts";

export function CatalogFilter({
  category,
  query,
  includeRetired,
  activeCount,
  defaultOpen,
}: {
  category: CatalogCategory;
  query: string;
  includeRetired: boolean;
  activeCount: number;
  defaultOpen: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = labels.productCatalog;

  // メーカー絞り込みはこのパネルの外（画面上部）にある独立した条件なので、
  // 検索でもクリアでも維持する。ここで消すと、絞り込んだ状態で検索した瞬間に
  // 別のカテゴリ全体が出てきたように見えてしまう。
  const maker = searchParams.get("maker");

  const [queryValue, setQueryValue] = useState(query);
  const [retiredValue, setRetiredValue] = useState(includeRetired);

  function push(params: URLSearchParams) {
    const qs = params.toString();
    const base = categoryPath(category);
    router.push(qs ? `${base}?${qs}` : base);
  }

  function applyFilters() {
    const params = new URLSearchParams();
    if (maker !== null) params.set("maker", maker);
    const q = queryValue.trim();
    if (q) params.set("query", q);
    if (retiredValue) params.set("retired", "1");
    push(params);
  }

  function clearFilters() {
    setQueryValue("");
    setRetiredValue(false);
    const params = new URLSearchParams();
    if (maker !== null) params.set("maker", maker);
    push(params);
  }

  return (
    <ListFilterPanel
      idPrefix="catalog"
      activeCount={activeCount}
      defaultOpen={defaultOpen}
      onSubmit={applyFilters}
      onClear={clearFilters}
    >
      <div className="space-y-1">
        <label htmlFor="catalog-query" className={FILTER_LABEL_CLASS}>
          {t.filters.keyword}
        </label>
        <input
          id="catalog-query"
          type="search"
          value={queryValue}
          onChange={(e) => setQueryValue(e.target.value)}
          placeholder={t.filters.keywordPlaceholder}
          aria-label={t.filters.keyword}
          className={`${FILTER_INPUT_CLASS} w-64`}
        />
      </div>

      {/* 論理削除した商品を確認・復元前提で見るための逃げ道。既定は非表示。 */}
      <div className="flex h-9 items-center">
        <label
          htmlFor="catalog-retired"
          className="text-body-light flex items-center gap-2 text-sm"
        >
          <input
            id="catalog-retired"
            type="checkbox"
            checked={retiredValue}
            onChange={(e) => setRetiredValue(e.target.checked)}
            className="border-ash-light text-primary focus:ring-primary/40 size-4 rounded border focus:ring-2"
          />
          {t.filters.includeRetired}
        </label>
      </div>
    </ListFilterPanel>
  );
}
