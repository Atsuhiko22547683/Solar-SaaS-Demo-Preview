// S-032 — 卸業者側 顧客一覧・検索 (T-04-07 / F-032 / docs/04 §1.3).
//
// Card-wrapped table with four independent derived status dimensions, a
// search + filter bar (client component pushing query params) and numeric
// pagination with a page-size selector. PII masking is applied in the data
// loader according to WholesalerSettings.

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import Link from "next/link";

import { normalizeSortDirection, normalizeSortField } from "@/components/list/list-sort";
import { ListSortSelect } from "@/components/list/list-sort-select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { labels } from "@/lib/i18n/labels";

import { CONTRACT_STATUS_VALUES } from "./constants";
import { CustomerFilter } from "./customer-filter";
import { CustomerTable } from "./customer-table";
import {
  listCustomers,
  listWholesalerUsers,
  normalizePageSize,
  type ContractStatusValue,
} from "./data";
import { PageSizeSelect } from "./page-size-select";
import { StatusQuickFilter } from "./status-quick-filter";

import type { ListSortOption } from "@/components/list/list-sort";

export const dynamic = "force-dynamic";

const BASE_PATH = "/customers";

// 並び替え項目（Customer の実列）。既定は従来どおり更新日時の降順。
const SORT_OPTIONS: ListSortOption[] = [
  {
    value: "updated_at",
    label: labels.customer.sortFieldLabels.updated_at!,
    defaultDirection: "desc",
  },
  { value: "name", label: labels.customer.sortFieldLabels.name!, defaultDirection: "asc" },
  {
    value: "created_at",
    label: labels.customer.sortFieldLabels.created_at!,
    defaultDirection: "desc",
  },
];
const DEFAULT_SORT_FIELD = "updated_at";

interface PageProps {
  searchParams: Promise<{
    query?: string;
    assigneeUserId?: string;
    contractStatus?: string;
    sortField?: string;
    sortDir?: string;
    page?: string;
    pageSize?: string;
  }>;
}

const VALID_CONTRACT = CONTRACT_STATUS_VALUES;

// Windowed numeric pagination (max 5 buttons centred on the current page).
function pageWindow(current: number, totalPages: number): number[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
  let start = Math.max(1, current - 2);
  const end = Math.min(totalPages, start + 4);
  start = Math.max(1, end - 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export default async function WholesalerCustomerListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.query?.trim() ?? "";
  const contractStatus = VALID_CONTRACT.includes(params.contractStatus as ContractStatusValue)
    ? (params.contractStatus as ContractStatusValue)
    : undefined;
  const assigneeUserId = params.assigneeUserId?.trim() || undefined;
  const sortField = normalizeSortField(params.sortField, SORT_OPTIONS, DEFAULT_SORT_FIELD);
  const sortDirection = normalizeSortDirection(params.sortDir, sortField, SORT_OPTIONS);
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = normalizePageSize(parseInt(params.pageSize ?? "", 10) || undefined);

  const [result, assignees] = await Promise.all([
    listCustomers({
      query,
      assigneeUserId,
      contractStatus,
      sortField,
      sortDirection,
      page,
      pageSize,
    }),
    listWholesalerUsers(),
  ]);

  const t = labels.customer;

  // 検索パネルのバッジ／初期展開に使う有効条件数。
  const activeFilterCount = [
    Boolean(query),
    Boolean(assigneeUserId),
    Boolean(contractStatus),
  ].filter(Boolean).length;

  // Build pagination URL preserving other query params.
  function pageUrl(p: number): string {
    const sp = new URLSearchParams();
    if (query) sp.set("query", query);
    if (assigneeUserId) sp.set("assigneeUserId", assigneeUserId);
    if (contractStatus) sp.set("contractStatus", contractStatus);
    if (sortField !== DEFAULT_SORT_FIELD) sp.set("sortField", sortField);
    if (sortDirection !== SORT_OPTIONS.find((o) => o.value === sortField)?.defaultDirection) {
      sp.set("sortDir", sortDirection);
    }
    if (pageSize !== 20) sp.set("pageSize", String(pageSize));
    sp.set("page", String(p));
    return `${BASE_PATH}?${sp.toString()}`;
  }

  // クイック絞り込みのリンク先。契約状況だけを差し替え、他の条件は保つ。
  // ページ番号は状況を切り替えた時点で意味を失うので落とす。
  function statusUrl(status: string): string {
    const sp = new URLSearchParams();
    if (query) sp.set("query", query);
    if (assigneeUserId) sp.set("assigneeUserId", assigneeUserId);
    if (status) sp.set("contractStatus", status);
    if (sortField !== DEFAULT_SORT_FIELD) sp.set("sortField", sortField);
    if (sortDirection !== SORT_OPTIONS.find((o) => o.value === sortField)?.defaultDirection) {
      sp.set("sortDir", sortDirection);
    }
    if (pageSize !== 20) sp.set("pageSize", String(pageSize));
    const qs = sp.toString();
    return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
  }

  const pageText = t.pagination.pageOf
    .replace("{page}", String(result.page))
    .replace("{total}", String(Math.max(1, result.totalPages)));

  return (
    <div className="space-y-6">
      {/* 画面上部は「見出し + 主操作」「よく切り替える条件」「件数 + 並び替え」の
          3 段に圧縮する。以前は見出し・定型 subtitle・大きな検索カード・件数・
          並び替えで縦に 5 段を消費し、一覧が下へ押し出されていた。
          説明文（「全ての顧客情報を一覧で確認・管理できます。」）は画面名から
          読み取れる内容しか持たないため出さない。 */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-ink text-xl font-bold">{t.listTitle}</h1>
        <Button asChild>
          <Link href="/customers/new">{t.newShort}</Link>
        </Button>
      </div>

      {/* よく切り替える条件（契約状況）だけを 1 クリックで。 */}
      <div className="border-hairline-light border-b pb-2">
        <StatusQuickFilter current={contractStatus ?? ""} buildUrl={statusUrl} />
      </div>

      {/* 低頻度の条件（氏名検索・担当者・全 7 値の契約状況）は畳んだまま。 */}
      <CustomerFilter
        query={query}
        assigneeUserId={assigneeUserId ?? ""}
        contractStatus={contractStatus ?? ""}
        assignees={assignees}
        activeCount={activeFilterCount}
        defaultOpen={activeFilterCount > 0}
      />

      {/* 件数と並び替えは一覧の直上に同じ行で置く（対象件数と並び順は対で読む）。 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-mute-light text-sm tabular-nums">
          {t.filters.resultCount.replace("{total}", String(result.total))}
        </p>
        <ListSortSelect
          basePath={BASE_PATH}
          options={SORT_OPTIONS}
          sortField={sortField}
          sortDirection={sortDirection}
          defaultField={DEFAULT_SORT_FIELD}
        />
      </div>

      <Card className="overflow-hidden p-0">
        {result.items.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-ink font-medium">{t.empty}</p>
            <p className="text-mute-light mt-2 text-sm">{t.emptyCta}</p>
            <Button asChild className="mt-4">
              <Link href="/customers/new">{t.new}</Link>
            </Button>
          </div>
        ) : (
          <CustomerTable customers={result.items} />
        )}
      </Card>

      {result.items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-mute-light text-sm">{t.pageSize.displayCount}</span>
            <PageSizeSelect pageSize={result.pageSize} />
          </div>

          <div className={result.totalPages > 1 ? "flex items-center gap-1" : "hidden"}>
            <Button
              asChild={result.page > 1}
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={result.page <= 1}
              aria-label={t.pagination.first}
            >
              {result.page > 1 ? (
                <Link href={pageUrl(1)}>
                  <ChevronsLeft />
                </Link>
              ) : (
                <ChevronsLeft />
              )}
            </Button>

            <Button
              asChild={result.page > 1}
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={result.page <= 1}
              aria-label={t.pagination.prev}
            >
              {result.page > 1 ? (
                <Link href={pageUrl(result.page - 1)}>
                  <ChevronLeft />
                </Link>
              ) : (
                <ChevronLeft />
              )}
            </Button>

            {pageWindow(result.page, result.totalPages).map((p) => (
              <Button
                key={p}
                asChild={p !== result.page}
                variant={p === result.page ? "default" : "outline"}
                size="icon"
                className="h-9 w-9 tabular-nums"
              >
                {p === result.page ? <span>{p}</span> : <Link href={pageUrl(p)}>{p}</Link>}
              </Button>
            ))}

            <Button
              asChild={result.page < result.totalPages}
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={result.page >= result.totalPages}
              aria-label={t.pagination.next}
            >
              {result.page < result.totalPages ? (
                <Link href={pageUrl(result.page + 1)}>
                  <ChevronRight />
                </Link>
              ) : (
                <ChevronRight />
              )}
            </Button>

            <Button
              asChild={result.page < result.totalPages}
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={result.page >= result.totalPages}
              aria-label={t.pagination.last}
            >
              {result.page < result.totalPages ? (
                <Link href={pageUrl(result.totalPages)}>
                  <ChevronsRight />
                </Link>
              ) : (
                <ChevronsRight />
              )}
            </Button>
          </div>

          {result.totalPages > 1 ? (
            <span className="text-mute-light text-sm tabular-nums">{pageText}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}
