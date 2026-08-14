// 施工一覧 — 卸業者側の横断一覧（docs/04 §1.3 S-046 相当）。
//
// 顧客一覧（S-032）と同じ骨格:
//   タイトル + 説明 → 白カードの検索/絞り込み → 表示件数 → テーブル → ページャ。
// 行クリックで既存の /contracts/[id]/construction へ遷移する。

import { ListPagination } from "@/components/list/list-pagination";
import {
  ListFilterCard,
  ListPageHeader,
  ListResultCount,
  ListTableCard,
} from "@/components/list/list-shell";
import { labels } from "@/lib/i18n/labels";

import { ConstructionFilter } from "./construction-filter";
import { ConstructionTable } from "./construction-table";
import { listConstructions } from "./data";
import { CONSTRUCTION_STATUS_VALUES, SURVEY_STATUS_VALUES } from "../customers/constants";

import type { ConstructionStatusValue, SurveyStatusValue } from "../customers/constants";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    query?: string;
    status?: string;
    surveyStatus?: string;
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

export default async function ConstructionListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.query?.trim() ?? "";
  const status = CONSTRUCTION_STATUS_VALUES.includes(params.status as ConstructionStatusValue)
    ? (params.status as ConstructionStatusValue)
    : undefined;
  const surveyStatus = SURVEY_STATUS_VALUES.includes(params.surveyStatus as SurveyStatusValue)
    ? (params.surveyStatus as SurveyStatusValue)
    : undefined;
  const from = normalizeDate(params.from);
  const to = normalizeDate(params.to);
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const result = await listConstructions({ query, status, surveyStatus, from, to, page });

  const t = labels.constructionList;

  function pageUrl(p: number): string {
    const sp = new URLSearchParams();
    if (query) sp.set("query", query);
    if (status) sp.set("status", status);
    if (surveyStatus) sp.set("surveyStatus", surveyStatus);
    if (from) sp.set("from", from);
    if (to) sp.set("to", to);
    sp.set("page", String(p));
    return `/constructions?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <ListPageHeader title={t.title} subtitle={t.subtitle} />

      <ListFilterCard>
        <ConstructionFilter
          query={query}
          status={status ?? ""}
          surveyStatus={surveyStatus ?? ""}
          from={from ?? ""}
          to={to ?? ""}
        />
      </ListFilterCard>

      <ListResultCount total={result.total} template={t.filters.resultCount} />

      <ListTableCard
        isEmpty={result.items.length === 0}
        emptyTitle={t.empty}
        emptyBody={t.emptyCta}
      >
        <ConstructionTable constructions={result.items} />
      </ListTableCard>

      <ListPagination page={result.page} totalPages={result.totalPages} buildUrl={pageUrl} />
    </div>
  );
}
