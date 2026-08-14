// 設置申請一覧 — 卸業者側の横断一覧（docs/04 §1.3 S-047 相当）。
//
// 顧客一覧（S-032）と同じ骨格:
//   タイトル + 説明 → 白カードの検索/絞り込み → 表示件数 → テーブル → ページャ。
// 行クリックで既存の /contracts/[id]/application へ遷移する。

import { ListPagination } from "@/components/list/list-pagination";
import {
  ListFilterCard,
  ListPageHeader,
  ListResultCount,
  ListTableCard,
} from "@/components/list/list-shell";
import { labels } from "@/lib/i18n/labels";

import { ApplicationFilter } from "./application-filter";
import { ApplicationTable } from "./application-table";
import { APPLICATION_FILTER_VALUES } from "./constants";
import { listApplications, listApplicationTypes } from "./data";

import type { ApplicationFilterValue } from "./constants";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    query?: string;
    status?: string;
    type?: string;
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

export default async function ApplicationListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.query?.trim() ?? "";
  const status = (APPLICATION_FILTER_VALUES as readonly string[]).includes(params.status ?? "")
    ? (params.status as ApplicationFilterValue)
    : undefined;
  const from = normalizeDate(params.from);
  const to = normalizeDate(params.to);
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const types = await listApplicationTypes();
  // 種別は自由入力なので、DB に実在する値のときだけ where に効かせる。
  const type = params.type && types.includes(params.type) ? params.type : undefined;

  const result = await listApplications({ query, status, type, from, to, page });

  const t = labels.applicationList;

  function pageUrl(p: number): string {
    const sp = new URLSearchParams();
    if (query) sp.set("query", query);
    if (status) sp.set("status", status);
    if (type) sp.set("type", type);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    sp.set("page", String(p));
    return `/applications?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <ListPageHeader title={t.title} subtitle={t.subtitle} />

      <ListFilterCard>
        <ApplicationFilter
          query={query}
          status={status ?? ""}
          type={type ?? ""}
          from={from ?? ""}
          to={to ?? ""}
          types={types}
        />
      </ListFilterCard>

      <ListResultCount total={result.total} template={t.filters.resultCount} />

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
