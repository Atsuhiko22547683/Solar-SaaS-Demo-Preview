// スタッフ一覧 — 設定配下のマスタ画面。
//
// 顧客管理配下の各一覧と同じ骨格に、所属タブ（自社 / 二次店）を足した構成:
//   タイトル + 説明 → 所属タブ → 折りたたみ検索パネル → 表示件数 + 並び替え
//   → テーブル → ページャ。
//
// スタッフは認証 User とは別概念で、ログインしない催事販売員も含めて管理する。
// 所属は Salesperson.relationshipId の有無で決まり、区分列は持たない。
// URL は互換性維持のため /salespeople のまま（表示名のみ「スタッフ一覧」へ変更）。

import { EMPLOYMENT_TYPE_VALUES } from "@solar/contracts";
import Link from "next/link";

import { ListPagination } from "@/components/list/list-pagination";
import {
  ListFilterCard,
  ListPageHeader,
  ListResultCount,
  ListTableCard,
} from "@/components/list/list-shell";
import { normalizeSortDirection, normalizeSortField } from "@/components/list/list-sort";
import { ListSortSelect } from "@/components/list/list-sort-select";
import { Button } from "@/components/ui/button";
import { labels } from "@/lib/i18n/labels";
import { assertSettingsAccess } from "@/lib/permissions/settings-guard";

import { listSalespeople, listStaffRelationshipOptions } from "./data";
import { SalespersonFilter } from "./salesperson-filter";
import { SalespersonTable } from "./salesperson-table";
import { StaffAffiliationTabs } from "./staff-affiliation-tabs";

import type { ListSortOption } from "@/components/list/list-sort";
import type { StaffAffiliation } from "@solar/contracts";

export const dynamic = "force-dynamic";

const BASE_PATH = "/salespeople";

// 並び替え項目（Salesperson の実列）。既定は氏名カナの昇順。
const SORT_OPTIONS: ListSortOption[] = [
  { value: "name", label: labels.salespersonList.sortFieldLabels.name!, defaultDirection: "asc" },
  {
    value: "company",
    label: labels.salespersonList.sortFieldLabels.company!,
    defaultDirection: "asc",
  },
  {
    value: "created_at",
    label: labels.salespersonList.sortFieldLabels.created_at!,
    defaultDirection: "desc",
  },
];
const DEFAULT_SORT_FIELD = "name";

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    query?: string;
    relationshipId?: string;
    employmentType?: string;
    sortField?: string;
    sortDir?: string;
    page?: string;
  }>;
}

export default async function SalespersonListPage({ searchParams }: PageProps) {
  // 設定配下は OWNER / SYSTEM_ADMIN のみ。URL 直打ちもここで 403 にする。
  await assertSettingsAccess();

  const params = await searchParams;
  const query = params.query?.trim() ?? "";
  // 所属タブ。値域外は自社タブへ落とす（URL 直打ちで where を壊さない）。
  const affiliation: StaffAffiliation = params.tab === "dealer" ? "dealer" : "self";
  const relationshipId = affiliation === "dealer" ? (params.relationshipId?.trim() ?? "") : "";
  // 値域外は絞り込みなしに落とす（URL 直打ちで where を壊さない）。
  const employmentType = (EMPLOYMENT_TYPE_VALUES as readonly string[]).includes(
    params.employmentType ?? "",
  )
    ? params.employmentType
    : undefined;
  const sortField = normalizeSortField(params.sortField, SORT_OPTIONS, DEFAULT_SORT_FIELD);
  const sortDirection = normalizeSortDirection(params.sortDir, sortField, SORT_OPTIONS);
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  // 逐次実行にして、1 リクエストで同時に開く DB トランザクションを 1 本に保つ。
  const result = await listSalespeople({
    affiliation,
    query,
    relationshipId: relationshipId || undefined,
    employmentType,
    sortField,
    sortDirection,
    page,
  });
  const relationships = await listStaffRelationshipOptions();

  const t = labels.salespersonList;

  // 検索パネルのバッジ／初期展開に使う有効条件数。
  const activeFilterCount = [
    Boolean(query),
    Boolean(relationshipId),
    Boolean(employmentType),
  ].filter(Boolean).length;

  function pageUrl(p: number): string {
    const sp = new URLSearchParams();
    if (affiliation === "dealer") sp.set("tab", "dealer");
    if (query) sp.set("query", query);
    if (relationshipId) sp.set("relationshipId", relationshipId);
    if (employmentType) sp.set("employmentType", employmentType);
    if (sortField !== DEFAULT_SORT_FIELD) sp.set("sortField", sortField);
    if (sortDirection !== SORT_OPTIONS.find((o) => o.value === sortField)?.defaultDirection) {
      sp.set("sortDir", sortDirection);
    }
    sp.set("page", String(p));
    return `${BASE_PATH}?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <ListPageHeader
        title={t.title}
        subtitle={t.subtitle}
        action={
          <Button asChild>
            <Link href="/salespeople/new">{t.new}</Link>
          </Button>
        }
      />

      <StaffAffiliationTabs current={affiliation} />

      <ListFilterCard>
        <SalespersonFilter
          affiliation={affiliation}
          query={query}
          relationshipId={relationshipId}
          employmentType={employmentType ?? ""}
          relationships={relationships}
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
        <SalespersonTable salespeople={result.items} affiliation={affiliation} />
      </ListTableCard>

      <ListPagination page={result.page} totalPages={result.totalPages} buildUrl={pageUrl} />
    </div>
  );
}
