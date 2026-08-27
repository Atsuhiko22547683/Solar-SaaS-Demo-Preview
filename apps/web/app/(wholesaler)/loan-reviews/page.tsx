// ローン審査一覧 — 卸業者側の横断一覧。
//
// 顧客詳細の「ローン審査」タブを案件横断で俯瞰する管理者向け画面。
// 顧客管理配下の各一覧と同じ骨格:
//   タイトル + 説明 → 折りたたみ検索パネル → 表示件数 + 並び替え → テーブル → ページャ。
// 行クリックで該当顧客の詳細（ローン審査タブを含む）へ遷移する。

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

import { DEFECT_FILTER_VALUES, LOAN_REVIEW_STATUS_VALUES } from "./constants";
import { listLoanReviews } from "./data";
import { LoanReviewFilter } from "./loan-review-filter";
import { LoanReviewTable } from "./loan-review-table";

import type { DefectFilterValue, LoanReviewStatusValue } from "./constants";
import type { ListSortOption } from "@/components/list/list-sort";

export const dynamic = "force-dynamic";

const BASE_PATH = "/loan-reviews";

// 並び替え項目（LoanReview の実列）。既定は従来どおり更新日時の降順。
// 一覧から「最終更新」列は外したが、並び替えのキーとしては引き続き使える。
const SORT_OPTIONS: ListSortOption[] = [
  {
    value: "updated_at",
    label: labels.loanReviewList.sortFieldLabels.updated_at!,
    defaultDirection: "desc",
  },
  {
    value: "created_at",
    label: labels.loanReviewList.sortFieldLabels.created_at!,
    defaultDirection: "desc",
  },
];
const DEFAULT_SORT_FIELD = "updated_at";

interface PageProps {
  searchParams: Promise<{
    query?: string;
    status?: string;
    defect?: string;
    sortField?: string;
    sortDir?: string;
    page?: string;
  }>;
}

export default async function LoanReviewListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.query?.trim() ?? "";
  const status = (LOAN_REVIEW_STATUS_VALUES as readonly string[]).includes(params.status ?? "")
    ? (params.status as LoanReviewStatusValue)
    : undefined;
  const defect = (DEFECT_FILTER_VALUES as readonly string[]).includes(params.defect ?? "")
    ? (params.defect as DefectFilterValue)
    : undefined;
  const sortField = normalizeSortField(params.sortField, SORT_OPTIONS, DEFAULT_SORT_FIELD);
  const sortDirection = normalizeSortDirection(params.sortDir, sortField, SORT_OPTIONS);
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const result = await listLoanReviews({ query, status, defect, sortField, sortDirection, page });

  const t = labels.loanReviewList;

  // 検索パネルのバッジ／初期展開に使う有効条件数。
  const activeFilterCount = [Boolean(query), Boolean(status), Boolean(defect)].filter(
    Boolean,
  ).length;

  function pageUrl(p: number): string {
    const sp = new URLSearchParams();
    if (query) sp.set("query", query);
    if (status) sp.set("status", status);
    if (defect) sp.set("defect", defect);
    if (sortField !== DEFAULT_SORT_FIELD) sp.set("sortField", sortField);
    if (sortDirection !== SORT_OPTIONS.find((o) => o.value === sortField)?.defaultDirection) {
      sp.set("sortDir", sortDirection);
    }
    sp.set("page", String(p));
    return `${BASE_PATH}?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <ListPageHeader title={t.title} subtitle={t.subtitle} />

      <ListFilterCard>
        <LoanReviewFilter
          query={query}
          status={status ?? ""}
          defect={defect ?? ""}
          activeCount={activeFilterCount}
          defaultOpen={activeFilterCount > 0}
        />
      </ListFilterCard>

      {/* 表示件数（左）と並び替え（右）。並び替えは検索条件ではないのでここに置く。 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListResultCount total={result.total} template={t.filters.resultCount} />
        <ListSortSelect
          basePath={BASE_PATH}
          options={SORT_OPTIONS}
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
        <LoanReviewTable reviews={result.items} />
      </ListTableCard>

      <ListPagination page={result.page} totalPages={result.totalPages} buildUrl={pageUrl} />
    </div>
  );
}
