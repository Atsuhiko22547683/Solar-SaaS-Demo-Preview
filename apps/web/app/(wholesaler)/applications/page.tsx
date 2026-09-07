// 設置申請一覧 — 卸業者側の横断一覧（docs/04 §1.3 S-047 相当）。
//
// 顧客管理配下の各一覧と同じ骨格:
//   タイトル + 説明 → 折りたたみ検索パネル → 表示件数 + 並び替え → テーブル → ページャ。
// 行クリックで既存の /contracts/[id]/application へ遷移する。
// 一覧の列・ステータス・取得内容は従来どおりで、変更したのは検索/並び替えの UI だけ。

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

import { ApplicationFilter } from "./application-filter";
import { ApplicationTable } from "./application-table";
import { APPLICATION_FILTER_VALUES } from "./constants";
import { listApplications, listApplicationTypes } from "./data";

import type { ApplicationFilterValue } from "./constants";
import type { ListSortOption } from "@/components/list/list-sort";

export const dynamic = "force-dynamic";

const BASE_PATH = "/applications";

// 並び替え項目（いずれも Application の実列）。既定は従来どおり「申請予定日が近い順」。
const SORT_OPTIONS: ListSortOption[] = [
  {
    value: "planned_date",
    label: labels.applicationList.sortFieldLabels.planned_date!,
    defaultDirection: "asc",
  },
  {
    value: "created_at",
    label: labels.applicationList.sortFieldLabels.created_at!,
    defaultDirection: "desc",
  },
];
const DEFAULT_SORT_FIELD = "planned_date";

interface PageProps {
  searchParams: Promise<{
    query?: string;
    status?: string;
    type?: string;
    from?: string;
    to?: string;
    sortField?: string;
    sortDir?: string;
    page?: string;
  }>;
}

/** "YYYY-MM-DD" 以外は無視する（不正な日付で全件が消えるのを防ぐ）。 */
function normalizeDate(value: string | undefined): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return Number.isNaN(new Date(value).getTime()) ? undefined : value;
}

export default async function ApplicationListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.query?.trim() ?? "";
  const status = (APPLICATION_FILTER_VALUES as readonly string[]).includes(params.status ?? "")
    ? (params.status as ApplicationFilterValue)
    : undefined;
  const from = normalizeDate(params.from);
  const to = normalizeDate(params.to);
  const sortField = normalizeSortField(params.sortField, SORT_OPTIONS, DEFAULT_SORT_FIELD);
  const sortDirection = normalizeSortDirection(params.sortDir, sortField, SORT_OPTIONS);
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const types = await listApplicationTypes();
  // 種別は自由入力なので、DB に実在する値のときだけ where に効かせる。
  const type = params.type && types.includes(params.type) ? params.type : undefined;

  const result = await listApplications({
    query,
    status,
    type,
    from,
    to,
    sortField,
    sortDirection,
    page,
  });

  const t = labels.applicationList;

  // 検索パネルのバッジ／初期展開に使う有効条件数（期間はセットで 1 条件）。
  const activeFilterCount = [
    Boolean(query),
    Boolean(status),
    Boolean(type),
    Boolean(from || to),
  ].filter(Boolean).length;

  function pageUrl(p: number): string {
    const sp = new URLSearchParams();
    if (query) sp.set("query", query);
    if (status) sp.set("status", status);
    if (type) sp.set("type", type);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    if (sortField !== DEFAULT_SORT_FIELD) sp.set("sortField", sortField);
    if (sortDirection !== SORT_OPTIONS.find((o) => o.value === sortField)?.defaultDirection) {
      sp.set("sortDir", sortDirection);
    }
    sp.set("page", String(p));
    return `${BASE_PATH}?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <ListPageHeader title={t.title} />

      <ListFilterCard>
        <ApplicationFilter
          query={query}
          status={status ?? ""}
          type={type ?? ""}
          from={from ?? ""}
          to={to ?? ""}
          types={types}
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
        <ApplicationTable applications={result.items} />
      </ListTableCard>

      <ListPagination page={result.page} totalPages={result.totalPages} buildUrl={pageUrl} />
    </div>
  );
}
