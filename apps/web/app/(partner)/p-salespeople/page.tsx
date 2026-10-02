// 二次店ポータル：自社に所属する販売員の一覧（二次店管理者のみ）。
//
// 販売員情報とログインアカウントは別の管理対象。ここでは紐付け状況を見るだけで、
// 紐付けの設定は利用者アカウント管理（/p-accounts）で行う。
// 検索・並べ替え・ページは URL クエリに持つ（query.ts が検証する）。

import Link from "next/link";

import {
  FilterPanel,
  NoMatch,
  Pagination,
  ResultSummary,
  SelectField,
  SortableTh,
  TextField,
} from "@/components/partner/list-filter";
import { SortSelect } from "@/components/partner/list-sort-select";
import {
  P_SUB,
  P_TD,
  P_TH,
  PartnerCard,
  PartnerEmpty,
  PartnerPageHeader,
  PartnerRowLink,
  PartnerTableScroll,
} from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";

import { listPartnerSalespeople } from "./data";
import {
  parseSalespersonQuery,
  SALESPERSON_ACTIVE_VALUES,
  SALESPERSON_EMPLOYMENT_VALUES,
  SALESPERSON_LINK_VALUES,
} from "./query";

import type { SalespersonSortField } from "./query";
import type { RawParams } from "@/lib/partner/list-query";

export const dynamic = "force-dynamic";

const BASE = "/p-salespeople";
const t = labels.partner.salesperson;
const c = labels.partner.common;

const SORT_OPTIONS: { field: SalespersonSortField; label: string }[] = [
  { field: "name", label: t.columns.name },
  { field: "kana", label: t.columns.kana },
  { field: "employmentType", label: t.columns.employmentType },
  { field: "isActive", label: t.fields.isActive },
];

export default async function PartnerSalespeoplePage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const q = parseSalespersonQuery(params);
  const result = await listPartnerSalespeople(q);
  const hasAnyCondition = Object.keys(params).some((k) => !["sort", "dir", "page"].includes(k));
  const th = (extra = "") => `${P_TH} ${extra}`.trim();
  const col = (field: SalespersonSortField, label: string, extra = "") => (
    <SortableTh
      field={field}
      label={label}
      basePath={BASE}
      params={params}
      sort={q.sort}
      className={th(extra)}
    />
  );

  return (
    <div>
      <PartnerPageHeader
        title={t.listTitle}
        action={
          <Link
            href="/p-salespeople/new"
            className="bg-primary focus-visible:ring-primary/40 inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 sm:h-9 sm:w-auto sm:px-3"
          >
            {labels.partner.home.adminCards.salespeople.action}
          </Link>
        }
      />

      <FilterPanel action={BASE} sort={q.sort} errors={q.errors} notes={[t.linkNote]}>
        <TextField label={t.filters.keyword} name="keyword" value={q.keyword} />
        <SelectField
          label={t.filters.employmentType}
          name="employmentType"
          value={q.employmentType}
          options={SALESPERSON_EMPLOYMENT_VALUES.map((v) => ({
            value: v,
            label: t.employmentTypeLabels[v] ?? v,
          }))}
        />
        <SelectField
          label={t.filters.isActive}
          name="isActive"
          value={q.isActive}
          options={SALESPERSON_ACTIVE_VALUES.map((v) => ({
            value: v,
            label: v === "ACTIVE" ? t.activeLabels.active : t.activeLabels.inactive,
          }))}
        />
        <SelectField
          label={t.filters.link}
          name="link"
          value={q.link}
          options={SALESPERSON_LINK_VALUES.map((v) => ({ value: v, label: t.linkLabels[v] ?? v }))}
        />
      </FilterPanel>

      <ResultSummary total={result.total} page={result.page} pageCount={result.pageCount} />
      <div className="sm:hidden">
        <SortSelect basePath={BASE} params={params} sort={q.sort} options={SORT_OPTIONS} />
      </div>

      <PartnerCard className="overflow-hidden p-0">
        {result.total === 0 ? (
          hasAnyCondition ? (
            <NoMatch />
          ) : (
            <div className="px-4">
              <PartnerEmpty title={t.empty} body={t.emptyCta} />
            </div>
          )
        ) : (
          <PartnerTableScroll>
            <table className="w-full text-sm">
              <thead className="bg-surface-soft/50">
                <tr className="border-hairline-light border-b">
                  {col("name", t.columns.name)}
                  {/* 補助列は狭い画面では落とす（横スクロールを作らない）。 */}
                  {col("kana", t.columns.kana, "hidden sm:table-cell")}
                  <th scope="col" className={th("hidden md:table-cell")}>
                    {t.columns.phone}
                  </th>
                  {col("employmentType", t.columns.employmentType, "hidden md:table-cell")}
                  <th scope="col" className={th("hidden lg:table-cell")}>
                    {t.columns.account}
                  </th>
                  {col("isActive", t.fields.isActive)}
                </tr>
              </thead>
              <tbody className="divide-hairline-light divide-y">
                {result.rows.map((r) => (
                  <tr key={r.id}>
                    <td className={P_TD}>
                      <PartnerRowLink href={`/p-salespeople/${r.id}`}>{r.name}</PartnerRowLink>
                      {/* 狭い画面で隠す列をラベル付きで畳む。 */}
                      <span className={P_SUB}>
                        {r.kana ? `${t.columns.kana}: ${r.kana} / ` : null}
                        {t.columns.phone}: {r.phone ?? c.dash}
                        <span className="block">
                          {t.columns.employmentType}:{" "}
                          {r.employmentType
                            ? (t.employmentTypeLabels[
                                r.employmentType as keyof typeof t.employmentTypeLabels
                              ] ?? r.employmentType)
                            : c.dash}{" "}
                          / {t.columns.account}: {r.accountName ?? t.linkLabels["UNLINKED"]}
                        </span>
                      </span>
                    </td>
                    <td className={`${P_TD} hidden sm:table-cell`}>{r.kana ?? c.dash}</td>
                    <td className={`${P_TD} hidden md:table-cell`}>{r.phone ?? c.dash}</td>
                    <td className={`${P_TD} hidden md:table-cell`}>
                      {r.employmentType
                        ? (t.employmentTypeLabels[
                            r.employmentType as keyof typeof t.employmentTypeLabels
                          ] ?? r.employmentType)
                        : c.dash}
                    </td>
                    <td className={`${P_TD} hidden lg:table-cell`}>
                      {r.accountName ?? t.linkLabels["UNLINKED"]}
                    </td>
                    <td className={P_TD}>
                      {r.isActive ? t.activeLabels.active : t.activeLabels.inactive}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PartnerTableScroll>
        )}
      </PartnerCard>

      <Pagination basePath={BASE} params={params} page={result.page} pageCount={result.pageCount} />
    </div>
  );
}
