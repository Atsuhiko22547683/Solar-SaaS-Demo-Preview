// S-034 — 卸業者側 アポイント一覧（F-034 / docs/04 §1.3）。
//
// 顧客一覧（S-032）と同じ情報設計・同じ骨格:
//   タイトル + 説明 → 白カードの検索/絞り込み → 表示件数 → テーブル → ページャ。
// 行クリックで該当顧客の詳細へ遷移する。
// 全ての列は実 DB 列（Appointment / Customer / PreCall / User）から供給しており、
// 見た目のためのダミー項目は持たない。

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

import { AppointmentFilter } from "./appointment-filter";
import { AppointmentTable } from "./appointment-table";
import { APPOINTMENT_STATUS_VALUES } from "./constants";
import { listAppointments, listWholesalerUsers } from "./data";

import type { ListSortOption } from "@/components/list/list-sort";
import type { AppointmentStatus } from "@solar/db";

export const dynamic = "force-dynamic";

const BASE_PATH = "/appointments";

// 並び替え項目（Appointment の実列）。既定は従来どおりアポ日時の降順。
const SORT_OPTIONS: ListSortOption[] = [
  {
    value: "scheduled_at",
    label: labels.appointment.list.sortFieldLabels.scheduled_at!,
    defaultDirection: "desc",
  },
  {
    value: "created_at",
    label: labels.appointment.list.sortFieldLabels.created_at!,
    defaultDirection: "desc",
  },
];
const DEFAULT_SORT_FIELD = "scheduled_at";

interface PageProps {
  searchParams: Promise<{
    query?: string;
    assigneeUserId?: string;
    status?: string;
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

export default async function AppointmentListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.query?.trim() ?? "";
  const assigneeUserId = params.assigneeUserId?.trim() || undefined;
  const status = APPOINTMENT_STATUS_VALUES.includes(params.status as AppointmentStatus)
    ? (params.status as AppointmentStatus)
    : undefined;
  const from = normalizeDate(params.from);
  const to = normalizeDate(params.to);
  const sortField = normalizeSortField(params.sortField, SORT_OPTIONS, DEFAULT_SORT_FIELD);
  const sortDirection = normalizeSortDirection(params.sortDir, sortField, SORT_OPTIONS);
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const [result, assignees] = await Promise.all([
    listAppointments({ query, assigneeUserId, status, from, to, sortField, sortDirection, page }),
    listWholesalerUsers(),
  ]);

  const t = labels.appointment.list;

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
        <AppointmentFilter
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
        <AppointmentTable appointments={result.items} />
      </ListTableCard>

      <ListPagination page={result.page} totalPages={result.totalPages} buildUrl={pageUrl} />
    </div>
  );
}
