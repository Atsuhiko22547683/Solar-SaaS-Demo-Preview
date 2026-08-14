// ローン審査一覧 — 卸業者側の横断一覧。
//
// 顧客詳細の「ローン審査」タブを案件横断で俯瞰する管理者向け画面。
// 顧客一覧（S-032）と同じ骨格:
//   タイトル + 説明 → 白カードの検索/絞り込み → 表示件数 → テーブル → ページャ。
// 行クリックで該当顧客の詳細（ローン審査タブを含む）へ遷移する。

import { ListPagination } from "@/components/list/list-pagination";
import {
  ListFilterCard,
  ListPageHeader,
  ListResultCount,
  ListTableCard,
} from "@/components/list/list-shell";
import { labels } from "@/lib/i18n/labels";

import { DEFECT_FILTER_VALUES, LOAN_REVIEW_STATUS_VALUES } from "./constants";
import { listLoanReviews } from "./data";
import { LoanReviewFilter } from "./loan-review-filter";
import { LoanReviewTable } from "./loan-review-table";

import type { DefectFilterValue, LoanReviewStatusValue } from "./constants";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    query?: string;
    status?: string;
    defect?: string;
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
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const result = await listLoanReviews({ query, status, defect, page });

  const t = labels.loanReviewList;

  function pageUrl(p: number): string {
    const sp = new URLSearchParams();
    if (query) sp.set("query", query);
    if (status) sp.set("status", status);
    if (defect) sp.set("defect", defect);
    sp.set("page", String(p));
    return `/loan-reviews?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <ListPageHeader title={t.title} subtitle={t.subtitle} />

      <ListFilterCard>
        <LoanReviewFilter query={query} status={status ?? ""} defect={defect ?? ""} />
      </ListFilterCard>

      <ListResultCount total={result.total} template={t.filters.resultCount} />

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
