// S-034 — 卸業者側 アポイント一覧（F-034 / docs/04 §1.3）。
//
// 顧客一覧（S-032）と同じ情報設計・同じ骨格:
//   タイトル + 説明 → 白カードの検索/絞り込み → 表示件数 → テーブル → ページャ。
// 全ての列は実 DB 列（Appointment / Customer / PreCall / User / Relationship / Event）から
// 供給しており、見た目のためのダミー項目は持たない。
//
// 処理の順番は 権限限定 → 検索 → 並べ替え → ページ分割。
// （取得した 1 ページだけを後から絞り込んだり並べ替えたりしない。件数も同じ where で数える。）

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
import { listAppointmentFilterOptions, listAppointments, listWholesalerUsers } from "./data";
import {
  APPOINTMENT_BASE_PATH,
  countActiveFilters,
  isReversedRange,
  parseAppointmentQuery,
  toSearchParams,
  usableQuery,
} from "./query";

import type { ListSortOption } from "@/components/list/list-sort";

export const dynamic = "force-dynamic";

// 並び替え項目。ここに無い値は既定へ丸める（任意の列を並べさせない）。
// 既定の向きは「日付・新しい順」「名前・五十音順」のように、その項目にとって自然な方。
const L = labels.appointment.list.sortFieldLabels;
const SORT_OPTIONS: ListSortOption[] = [
  { value: "scheduled_at", label: L.scheduled_at!, defaultDirection: "desc" },
  { value: "created_at", label: L.created_at!, defaultDirection: "desc" },
  { value: "customer_name", label: L.customer_name!, defaultDirection: "asc" },
  { value: "area", label: L.area!, defaultDirection: "asc" },
  { value: "assignee", label: L.assignee!, defaultDirection: "asc" },
  { value: "company", label: L.company!, defaultDirection: "asc" },
  { value: "appointment_type", label: L.appointment_type!, defaultDirection: "asc" },
  { value: "partner_kind", label: L.partner_kind!, defaultDirection: "asc" },
  { value: "event", label: L.event!, defaultDirection: "asc" },
  { value: "status", label: L.status!, defaultDirection: "asc" },
  { value: "pre_call", label: L.pre_call!, defaultDirection: "asc" },
];
const DEFAULT_SORT_FIELD = "scheduled_at";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AppointmentListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = parseAppointmentQuery(params);
  // 逆転した期間は検索に使わない。0 件として見せず、条件欄にエラーを出す。
  const effective = usableQuery(q);
  const rangeErrors = {
    scheduled: isReversedRange(q.from, q.to),
    created: isReversedRange(q.createdFrom, q.createdTo),
  };

  const sortField = normalizeSortField(
    Array.isArray(params.sortField) ? params.sortField[0] : params.sortField,
    SORT_OPTIONS,
    DEFAULT_SORT_FIELD,
  );
  const sortDirection = normalizeSortDirection(
    Array.isArray(params.sortDir) ? params.sortDir[0] : params.sortDir,
    sortField,
    SORT_OPTIONS,
  );
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const [result, assignees, options] = await Promise.all([
    listAppointments({
      query: effective.query || undefined,
      from: effective.from || undefined,
      to: effective.to || undefined,
      createdFrom: effective.createdFrom || undefined,
      createdTo: effective.createdTo || undefined,
      area: effective.area || undefined,
      assigneeUserId: effective.assigneeUserId || undefined,
      relationshipId: effective.relationshipId || undefined,
      appointmentType: effective.appointmentType || undefined,
      partnerKind: effective.partnerKind || undefined,
      eventId: effective.eventId || undefined,
      eventQuery: effective.eventQuery || undefined,
      status: effective.status || undefined,
      preCall: effective.preCall || undefined,
      sortField,
      sortDirection,
      page,
    }),
    listWholesalerUsers(),
    listAppointmentFilterOptions(),
  ]);

  const t = labels.appointment.list;
  const activeFilterCount = countActiveFilters(q);

  function pageUrl(p: number): string {
    const sp = toSearchParams(q);
    if (sortField !== DEFAULT_SORT_FIELD) sp.set("sortField", sortField);
    if (sortDirection !== SORT_OPTIONS.find((o) => o.value === sortField)?.defaultDirection) {
      sp.set("sortDir", sortDirection);
    }
    sp.set("page", String(p));
    return `${APPOINTMENT_BASE_PATH}?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <ListPageHeader title={t.title} />

      <ListFilterCard>
        <AppointmentFilter
          value={q}
          assignees={assignees}
          options={options}
          activeCount={activeFilterCount}
          defaultOpen={activeFilterCount > 0}
          rangeErrors={rangeErrors}
        />
      </ListFilterCard>

      {/* 表示件数（左）と並び替え（右）。並び替えは検索条件ではないのでここに置く。 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListResultCount total={result.total} template={t.filters.resultCount} />
        <ListSortSelect
          basePath={APPOINTMENT_BASE_PATH}
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
