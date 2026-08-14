// S-040 — 卸業者側 契約一覧（F-040 / docs/04 §1.3）。
//
// 顧客一覧（S-032）と同じ骨格:
//   タイトル + 説明 → 白カードの検索/絞り込み → 表示件数 → テーブル → ページャ。
// 行クリックで既存の契約詳細（/contracts/[id]）へ遷移する。
// 「現在の後続工程」列は Contract に紐づく Construction / Application から
// 顧客一覧と同じ導出関数で算出しており、独自の状態は持たない。

import { ListPagination } from "@/components/list/list-pagination";
import {
  ListFilterCard,
  ListPageHeader,
  ListResultCount,
  ListTableCard,
} from "@/components/list/list-shell";
import { labels } from "@/lib/i18n/labels";

import { CONTRACT_STATUS_ENUM_VALUES } from "./constants";
import { ContractFilter } from "./contract-filter";
import { ContractTable } from "./contract-table";
import { listContracts, listWholesalerUsers } from "./data";

import type { ContractStatus } from "@solar/db";

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

export default async function ContractListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.query?.trim() ?? "";
  const assigneeUserId = params.assigneeUserId?.trim() || undefined;
  const status = CONTRACT_STATUS_ENUM_VALUES.includes(params.status as ContractStatus)
    ? (params.status as ContractStatus)
    : undefined;
  const from = normalizeDate(params.from);
  const to = normalizeDate(params.to);
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const [result, assignees] = await Promise.all([
    listContracts({ query, assigneeUserId, status, from, to, page }),
    listWholesalerUsers(),
  ]);

  const t = labels.contract.list;

  function pageUrl(p: number): string {
    const sp = new URLSearchParams();
    if (query) sp.set("query", query);
    if (assigneeUserId) sp.set("assigneeUserId", assigneeUserId);
    if (status) sp.set("status", status);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    sp.set("page", String(p));
    return `/contracts?${sp.toString()}`;
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
        />
      </ListFilterCard>

      <ListResultCount total={result.total} template={t.filters.resultCount} />

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
