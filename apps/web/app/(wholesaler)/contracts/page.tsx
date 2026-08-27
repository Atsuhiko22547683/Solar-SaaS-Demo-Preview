// S-040 — 卸業者側 契約一覧（F-040 / docs/04 §1.3）。
//
// 顧客一覧（S-032）と同じ骨格:
//   タイトル + 説明 → 白カードの検索/絞り込み → 表示件数 → テーブル → ページャ。
// 行クリックで既存の契約詳細（/contracts/[id]）へ遷移する。
// 施工 / 設置申請の状況は専用一覧（/constructions, /applications）へ集約したため
// この一覧では扱わず、代わりに入金状況を表示・変更できる。

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

import { CONTRACT_STATUS_ENUM_VALUES } from "./constants";
import { ContractFilter } from "./contract-filter";
import { ContractTable } from "./contract-table";
import { listContracts, listWholesalerUsers } from "./data";

import type { ListSortOption } from "@/components/list/list-sort";
import type { ContractStatus } from "@solar/db";

export const dynamic = "force-dynamic";

const BASE_PATH = "/contracts";

// 並び替え項目（Contract の実列）。既定は従来どおり契約日の降順。
const SORT_OPTIONS: ListSortOption[] = [
  {
    value: "contract_date",
    label: labels.contract.list.sortFieldLabels.contract_date!,
    defaultDirection: "desc",
  },
  {
    value: "contract_amount",
    label: labels.contract.list.sortFieldLabels.contract_amount!,
    defaultDirection: "desc",
  },
  {
    value: "created_at",
    label: labels.contract.list.sortFieldLabels.created_at!,
    defaultDirection: "desc",
  },
];
const DEFAULT_SORT_FIELD = "contract_date";

interface PageProps {
  searchParams: Promise<{
    sortField?: string;
    sortDir?: string;
    query?: string;
    assigneeUserId?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

/** "YYYY-MM-DD" 以外は無視する（不正な日付で全件が消えるのを防ぐ）。 */
function normalizeDate(value: string | undefined): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return Number.isNaN(new Date(value).getTime()) ? undefined : value;
}

export default async function ContractListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.query?.trim() ?? "";
  const assigneeUserId = params.assigneeUserId?.trim() || undefined;
  const status = CONTRACT_STATUS_ENUM_VALUES.includes(params.status as ContractStatus)
    ? (params.status as ContractStatus)
    : undefined;
  const from = normalizeDate(params.from);
  const to = normalizeDate(params.to);
  const sortField = normalizeSortField(params.sortField, SORT_OPTIONS, DEFAULT_SORT_FIELD);
  const sortDirection = normalizeSortDirection(params.sortDir, sortField, SORT_OPTIONS);
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const [result, assignees] = await Promise.all([
    listContracts({ query, assigneeUserId, status, from, to, sortField, sortDirection, page }),
    listWholesalerUsers(),
  ]);

  const t = labels.contract.list;

  // 検索パネルのバッジ／初期展開に使う有効条件数（期間はセットで 1 条件）。
  const activeFilterCount = [
    Boolean(query),
    Boolean(assigneeUserId),
    Boolean(status),
    Boolean(from || to),
  ].filter(Boolean).length;

  function pageUrl(p: number): string {
    const sp = new URLSearchParams();
    if (query) sp.set("query", query);
    if (assigneeUserId) sp.set("assigneeUserId", assigneeUserId);
    if (status) sp.set("status", status);
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
      <ListPageHeader title={t.title} subtitle={t.subtitle} />

      <ListFilterCard>
        <ContractFilter
          query={query}
          assigneeUserId={assigneeUserId ?? ""}
          status={status ?? ""}
          from={from ?? ""}
          to={to ?? ""}
          assignees={assignees}
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
        <ContractTable contracts={result.items} />
      </ListTableCard>

      <ListPagination page={result.page} totalPages={result.totalPages} buildUrl={pageUrl} />
    </div>
  );
}
