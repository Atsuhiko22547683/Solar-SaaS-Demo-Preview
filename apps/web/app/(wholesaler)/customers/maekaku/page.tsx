// 顧客管理配下「コール一覧」— 顧客詳細「コール」タブの内容を顧客横断で俯瞰する一覧画面。
//
// 表示名は「コール一覧」だが、既存リンク・E2E・ルーティングへの影響を抑えるため
// URL は /customers/maekaku のまま（ディレクトリ名も同様）。
//
// 骨格は S-032 顧客一覧と同一:
//   タイトル + 説明 → 白カードの検索/絞り込み → 表示件数 → テーブル → 表示件数選択 + ページャ。
// レイアウト部品は components/list/（ListPageHeader / ListFilterCard / ListResultCount /
// ListTableCard / ListPagination）を、表示件数セレクトは顧客一覧の PageSizeSelect を再利用する。
//
// 一覧は閲覧専用（各コール情報の編集は顧客詳細のコールタブ）。行クリックで
// /customers/{id}?tab=calls へ遷移する。

import { ListPagination } from "@/components/list/list-pagination";
import {
  ListFilterCard,
  ListPageHeader,
  ListResultCount,
  ListTableCard,
} from "@/components/list/list-shell";
import { ListSortSelect } from "@/components/list/list-sort-select";
import { labels } from "@/lib/i18n/labels";

import { DEFAULT_PAGE_SIZE, normalizePageSize } from "../constants";
import { PageSizeSelect } from "../page-size-select";
import {
  CALL_SORT_FIELD_VALUES,
  DEFAULT_CALL_DATE_FIELD,
  DEFAULT_CALL_SORT_FIELD,
  DEFAULT_CALL_TYPE,
  defaultDirectionFor,
  normalizeCallDateField,
  normalizeCallType,
  normalizeDateParam,
  normalizeSortDirection,
  normalizeSortField,
  normalizeStatusForCallType,
} from "./constants";
import { listCallCustomers, listWholesalerUsers } from "./data";
import { CallFilter } from "./maekaku-filter";
import { CallTable } from "./maekaku-table";

import type { ListSortOption } from "@/components/list/list-sort";

export const dynamic = "force-dynamic";

// 並び替え項目（Customer の実列）。既定は「更新が新しい順」。
// 値域・既定方向は constants.ts と共有し、共通 ListSortSelect の形へ写す。
const SORT_OPTIONS: ListSortOption[] = CALL_SORT_FIELD_VALUES.map((v) => ({
  value: v,
  label: labels.customer.calls.sortFieldLabels[v] ?? v,
  defaultDirection: defaultDirectionFor(v),
}));

const BASE_PATH = "/customers/maekaku";

interface PageProps {
  searchParams: Promise<{
    query?: string;
    assigneeUserId?: string;
    callType?: string;
    callStatus?: string;
    dateField?: string;
    dateFrom?: string;
    dateTo?: string;
    sortField?: string;
    sortDir?: string;
    page?: string;
    pageSize?: string;
  }>;
}

export default async function CallListPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const query = params.query?.trim() ?? "";
  const assigneeUserId = params.assigneeUserId?.trim() || undefined;
  const callType = normalizeCallType(params.callType);
  // ステータスは対象項目に属する CODE のみ通す（種別違いは絞り込みなしに落とす）。
  const callStatus = normalizeStatusForCallType(callType, params.callStatus);
  const dateField = normalizeCallDateField(params.dateField);
  const dateFrom = normalizeDateParam(params.dateFrom);
  const dateTo = normalizeDateParam(params.dateTo);
  const sortField = normalizeSortField(params.sortField);
  const sortDirection = normalizeSortDirection(params.sortDir, sortField);
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = normalizePageSize(parseInt(params.pageSize ?? "", 10) || undefined);

  const [result, assignees] = await Promise.all([
    listCallCustomers({
      query,
      assigneeUserId,
      callType,
      callStatus,
      dateField,
      dateFrom,
      dateTo,
      sortField,
      sortDirection,
      page,
      pageSize,
    }),
    listWholesalerUsers(),
  ]);

  const t = labels.customer.calls;

  // 有効な検索条件の数。検索パネルのヘッダバッジと、初期展開の判定に使う。
  // 期間（開始日 / 終了日）はセットで 1 条件として数える。日付対象だけの指定は条件ではない。
  const activeFilterCount = [
    Boolean(query),
    Boolean(assigneeUserId),
    callType !== DEFAULT_CALL_TYPE,
    Boolean(callStatus),
    Boolean(dateFrom || dateTo),
  ].filter(Boolean).length;

  // ページ遷移では他の検索条件を保持する（検索条件の変更側は page を載せず 1 ページ目へ戻る）。
  function pageUrl(p: number): string {
    const sp = new URLSearchParams();
    if (query) sp.set("query", query);
    if (assigneeUserId) sp.set("assigneeUserId", assigneeUserId);
    if (callType !== DEFAULT_CALL_TYPE) sp.set("callType", callType);
    if (callStatus) sp.set("callStatus", callStatus);
    if (dateFrom || dateTo) {
      if (dateField !== DEFAULT_CALL_DATE_FIELD) sp.set("dateField", dateField);
      if (dateFrom) sp.set("dateFrom", dateFrom);
      if (dateTo) sp.set("dateTo", dateTo);
    }
    if (sortField !== DEFAULT_CALL_SORT_FIELD) sp.set("sortField", sortField);
    // 並び順はその項目にとって自然な向きのときだけ省略する（URL を短く保つ）。
    if (sortDirection !== defaultDirectionFor(sortField)) sp.set("sortDir", sortDirection);
    if (pageSize !== DEFAULT_PAGE_SIZE) sp.set("pageSize", String(pageSize));
    sp.set("page", String(p));
    return `${BASE_PATH}?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <ListPageHeader title={t.title} />

      <ListFilterCard>
        <CallFilter
          query={query}
          assigneeUserId={assigneeUserId ?? ""}
          callType={callType}
          callStatus={callStatus ?? ""}
          dateField={dateField}
          dateFrom={dateFrom ?? ""}
          dateTo={dateTo ?? ""}
          assignees={assignees}
          pageSize={result.pageSize}
          defaultPageSize={DEFAULT_PAGE_SIZE}
          activeCount={activeFilterCount}
          // 検索条件付き URL で開いたときだけ、どの条件で絞り込まれているか見えるよう開いておく。
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
          defaultField={DEFAULT_CALL_SORT_FIELD}
        />
      </div>

      <ListTableCard
        isEmpty={result.items.length === 0}
        emptyTitle={t.empty}
        emptyBody={t.emptyCta}
      >
        <CallTable rows={result.items} />
      </ListTableCard>

      {result.items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-mute-light text-sm">{labels.customer.pageSize.displayCount}</span>
            <PageSizeSelect pageSize={result.pageSize} basePath={BASE_PATH} />
          </div>

          <ListPagination page={result.page} totalPages={result.totalPages} buildUrl={pageUrl} />
        </div>
      )}
    </div>
  );
}
