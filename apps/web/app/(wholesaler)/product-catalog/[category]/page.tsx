// 製品カタログ — カテゴリごとの商品一覧。
//
// 画面の骨格は顧客管理配下の各一覧と同じ:
//   見出し（製品カタログ / カテゴリ名） + 右上アクション → メーカー絞り込み
//   → 折りたたみ検索パネル → 表示件数 + 並び替え → テーブル → ページャ。
//
// 小分類（PV / BT / エコキュート / IH / プレゼント品 / その他）の切替は
// サイドバーが唯一の導線。以前は画面中央にも同じ 6 カテゴリのタブを置いていたが、
// 同じ操作が 2 か所にあるだけで何も足していなかったので外した。空いた位置は
// 「そのカテゴリの中で絞る」= メーカー絞り込みに使う。いまどのカテゴリにいるかは
// 見出し（製品カタログ > カテゴリ名）とサイドバーの選択状態で分かる。
//
// 権限は data.ts のローダー内で product.read を assertCan する。製品カタログは
// 通常機能なので、設定配下のような追加のロール制限は掛けない。

import { notFound } from "next/navigation";

import { ListPagination } from "@/components/list/list-pagination";
import {
  ListFilterCard,
  ListPageHeader,
  ListResultCount,
  ListTableCard,
} from "@/components/list/list-shell";
import { normalizeSortDirection, normalizeSortField } from "@/components/list/list-sort";
import { ListSortSelect } from "@/components/list/list-sort-select";
import { labels } from "@/lib/i18n/labels";

import { CatalogFilter } from "../catalog-filter";
import { CatalogTable } from "../catalog-table";
import { categoryFromSlug, categoryPath, DEFAULT_SORT_FIELD, sortOptionsFor } from "../categories";
import { CreateProductButton } from "../create-product-button";
import { listAllCatalogMakers, listCatalogMakers, listCatalogProducts } from "../data";
import { MakerFilter } from "../maker-filter";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{
    maker?: string;
    query?: string;
    retired?: string;
    sortField?: string;
    sortDir?: string;
    page?: string;
  }>;
}

export default async function ProductCatalogPage({ params, searchParams }: PageProps) {
  const { category: slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) notFound();

  const sp = await searchParams;
  // maker は「未指定（すべて）」と「空文字（メーカー未設定）」を区別する。
  // ?maker= を付けると "" が届き、付けなければ undefined が届く。
  const maker = sp.maker;
  const query = sp.query?.trim() ?? "";
  const includeRetired = sp.retired === "1";
  const sortOptions = sortOptionsFor(category);
  const sortField = normalizeSortField(sp.sortField, sortOptions, DEFAULT_SORT_FIELD);
  const sortDirection = normalizeSortDirection(sp.sortDir, sortField, sortOptions);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  // 逐次実行にして、1 リクエストで同時に開く DB トランザクションを 1 本に保つ。
  const result = await listCatalogProducts({
    category,
    maker,
    query,
    includeRetired,
    sortField,
    sortDirection,
    page,
  });
  // 絞り込みの候補はこのカテゴリの商品から、登録フォームの候補は全カテゴリから。
  // メーカーは本来カテゴリをまたぐ共通概念なので、入力補完まで category で
  // 区切ると同じ名前を何度も打ち直すことになる。
  const makerOptions = await listCatalogMakers(category, includeRetired);
  const allMakers = await listAllCatalogMakers();

  const t = labels.productCatalog;
  const basePath = categoryPath(category);
  const activeFilterCount = [Boolean(query), includeRetired].filter(Boolean).length;

  function pageUrl(p: number): string {
    const params = new URLSearchParams();
    if (maker !== undefined) params.set("maker", maker);
    if (query) params.set("query", query);
    if (includeRetired) params.set("retired", "1");
    if (sortField !== DEFAULT_SORT_FIELD) params.set("sortField", sortField);
    if (sortDirection !== sortOptions.find((o) => o.value === sortField)?.defaultDirection) {
      params.set("sortDir", sortDirection);
    }
    params.set("page", String(p));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <ListPageHeader
        eyebrow={t.title}
        title={t.categories[category]!}
        action={<CreateProductButton category={category} makerOptions={allMakers} />}
      />

      <MakerFilter
        basePath={basePath}
        makers={makerOptions.makers}
        hasUnset={makerOptions.hasUnset}
        selected={maker}
      />

      <ListFilterCard>
        <CatalogFilter
          category={category}
          query={query}
          includeRetired={includeRetired}
          activeCount={activeFilterCount}
          defaultOpen={activeFilterCount > 0}
        />
      </ListFilterCard>

      {/* 表示件数（左）と並び替え（右）。並び替えは検索条件ではないのでここに置く。 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListResultCount total={result.total} template={t.filters.resultCount} />
        <ListSortSelect
          basePath={basePath}
          options={sortOptions}
          sortField={sortField}
          sortDirection={sortDirection}
          defaultField={DEFAULT_SORT_FIELD}
        />
      </div>

      <ListTableCard
        isEmpty={result.items.length === 0}
        emptyTitle={t.empty}
        emptyBody={t.emptyCta}
      >
        <CatalogTable category={category} products={result.items} makerOptions={allMakers} />
      </ListTableCard>

      <ListPagination page={result.page} totalPages={result.totalPages} buildUrl={pageUrl} />
    </div>
  );
}
