// 製品カタログのカテゴリ ↔ URL スラッグ、および一覧の並び替え項目。
//
// カテゴリそのもの（値・順序・項目要否）は @solar/contracts の
// CATALOG_CATEGORY_VALUES / CATALOG_FIELDS が唯一の情報源。ここが持つのは
// 「URL でどう表すか」「どの列で並び替えられるか」という画面側の都合だけ。
//
// "use client" は付けない — page.tsx（Server Component）と
// カタログのクライアント部品の両方から import する。

import { CATALOG_CATEGORY_VALUES, type CatalogCategory } from "@solar/contracts";

import { labels } from "@/lib/i18n/labels";

import type { ListSortOption } from "@/components/list/list-sort";

export const CATALOG_BASE_PATH = "/product-catalog";

/** URL スラッグ。表示順は CATALOG_CATEGORY_VALUES の順に従う。 */
export const CATEGORY_SLUGS: Record<CatalogCategory, string> = {
  PV: "pv",
  BT: "bt",
  ECO_CUTE: "eco-cute",
  IH: "ih",
  GIFT: "gift",
  OTHER: "other",
};

const SLUG_TO_CATEGORY = new Map<string, CatalogCategory>(
  CATALOG_CATEGORY_VALUES.map((c) => [CATEGORY_SLUGS[c], c]),
);

/** 既定のカテゴリ（/product-catalog を開いたときの行き先）。 */
export const DEFAULT_CATEGORY: CatalogCategory = CATALOG_CATEGORY_VALUES[0];

/** URL スラッグ → カテゴリ。値域外は null（page 側で notFound にする）。 */
export function categoryFromSlug(slug: string | undefined): CatalogCategory | null {
  if (!slug) return null;
  return SLUG_TO_CATEGORY.get(slug) ?? null;
}

/** カテゴリ一覧のパス。 */
export function categoryPath(category: CatalogCategory): string {
  return `${CATALOG_BASE_PATH}/${CATEGORY_SLUGS[category]}`;
}

// ---------------------------------------------------------------------------
// 並び替え
// ---------------------------------------------------------------------------
//
// 全カテゴリで同じ選択肢に揃えない。そのカテゴリで意味を持たない列
// （プレゼント品の「容量」など）を選べても、並び順が変わらないだけで
// 「壊れている」ようにしか見えないため。

export const DEFAULT_SORT_FIELD = "updated_at";

const SORT_LABELS = labels.productCatalog.sortFieldLabels;

function option(value: string, defaultDirection: "asc" | "desc"): ListSortOption {
  return { value, label: SORT_LABELS[value] ?? value, defaultDirection };
}

const COMMON_SORT: ListSortOption[] = [option("updated_at", "desc"), option("created_at", "desc")];

const PRICE_SORT: ListSortOption[] = [option("purchasePrice", "asc"), option("dealerPrice", "asc")];

export function sortOptionsFor(category: CatalogCategory): ListSortOption[] {
  switch (category) {
    case "PV":
    case "IH":
      return [...COMMON_SORT, option("maker", "asc"), option("modelNo", "asc"), ...PRICE_SORT];
    case "BT":
      return [
        ...COMMON_SORT,
        option("maker", "asc"),
        option("series", "asc"),
        option("capacity", "asc"),
        ...PRICE_SORT,
      ];
    case "ECO_CUTE":
      return [
        ...COMMON_SORT,
        option("maker", "asc"),
        option("series", "asc"),
        option("modelNo", "asc"),
        ...PRICE_SORT,
      ];
    case "GIFT":
    case "OTHER":
      return [...COMMON_SORT, option("name", "asc"), option("maker", "asc"), ...PRICE_SORT];
  }
}
