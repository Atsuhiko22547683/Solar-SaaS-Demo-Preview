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
import { labels } from "@/lib/i18n/labels";

import { AppointmentFilter } from "./appointment-filter";
import { AppointmentTable } from "./appointment-table";
import { APPOINTMENT_STATUS_VALUES } from "./constants";
import { listAppointments, listWholesalerUsers } from "./data";

import type { AppointmentStatus } from "@solar/db";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
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

export default async function AppointmentListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.query?.trim() ?? "";
  const assigneeUserId = params.assigneeUserId?.trim() || undefined;
  const status = APPOINTMENT_STATUS_VALUES.includes(params.status as AppointmentStatus)
    ? (params.status as AppointmentStatus)
    : undefined;
  const from = normalizeDate(params.from);
  const to = normalizeDate(params.to);
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const [result, assignees] = await Promise.all([
    listAppointments({ query, assigneeUserId, status, from, to, page }),
    listWholesalerUsers(),
  ]);

  const t = labels.appointment.list;

  function pageUrl(p: number): string {
    const sp = new URLSearchParams();
    if (query) sp.set("query", query);
    if (assigneeUserId) sp.set("assigneeUserId", assigneeUserId);
    if (status) sp.set("status", status);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    sp.set("page", String(p));
    return `/appointments?${sp.toString()}`;
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
        />
      </ListFilterCard>

      <ListResultCount total={result.total} template={t.filters.resultCount} />

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
