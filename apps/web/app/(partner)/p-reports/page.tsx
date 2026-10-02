// 二次店ポータル：自社（スタッフは本人提出分）の催事日報一覧。
// 検索・並べ替え・ページは URL クエリに持つ（query.ts が検証する）。

import Link from "next/link";

import {
  DateRangeField,
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
import { formatDate } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { listPartnerReports } from "./data";
import { parseReportQuery, REPORT_CATEGORY_VALUES, REPORT_CHAIN_VALUES } from "./query";

import type { ReportSortField } from "./query";
import type { RawParams } from "@/lib/partner/list-query";

export const dynamic = "force-dynamic";

const BASE = "/p-reports";
const t = labels.partner.report;
const l = labels.partner.list;

const SORT_OPTIONS: { field: ReportSortField; label: string }[] = [
  { field: "eventDate", label: t.columns.eventDate },
  { field: "venuePlace", label: t.columns.venuePlace },
  { field: "category", label: t.columns.category },
  { field: "venueChain", label: t.columns.venueChain },
  { field: "lotteryTotal", label: t.columns.lotteryTotal },
  { field: "seatedTotal", label: t.columns.seatedTotal },
  { field: "apptTotal", label: t.columns.apptTotal },
  { field: "createdAt", label: t.columns.createdAt },
];

export default async function PartnerReportsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const q = parseReportQuery(params);
  const result = await listPartnerReports(q);
  const hasAnyCondition = Object.keys(params).some((k) => !["sort", "dir", "page"].includes(k));
  const th = (extra = "") => `${P_TH} ${extra}`.trim();
  const col = (field: ReportSortField, label: string, extra = "") => (
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
            href="/p-reports/new"
            className="bg-primary focus-visible:ring-primary/40 inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 sm:h-9 sm:w-auto sm:px-3"
          >
            {labels.partner.home.cards.reports.action}
          </Link>
        }
      />

      <FilterPanel
        action={BASE}
        sort={q.sort}
        errors={q.errors}
        notes={[l.adminScopeNote]}
        advancedActive={Boolean(q.category || q.areaInFacility || q.submittedBy)}
        advanced={
          <>
            {result.isAdmin ? (
              <SelectField
                label={l.submittedBy}
                name="submittedBy"
                value={q.submittedBy}
                options={result.staffOptions.map((u) => ({ value: u.id, label: u.name }))}
              />
            ) : null}
            <SelectField
              label={t.filters.category}
              name="category"
              value={q.category}
              options={REPORT_CATEGORY_VALUES.map((v) => ({
                value: v,
                label: t.categoryLabels[v] ?? v,
              }))}
            />
            <TextField
              label={t.filters.areaInFacility}
              name="areaInFacility"
              value={q.areaInFacility}
            />
          </>
        }
      >
        <DateRangeField
          label={t.filters.eventDate}
          name="eventDate"
          from={q.eventDate.from}
          to={q.eventDate.to}
        />
        <TextField label={t.filters.venuePlace} name="venuePlace" value={q.venuePlace} />
        <SelectField
          label={t.filters.venueChain}
          name="venueChain"
          value={q.venueChain}
          options={REPORT_CHAIN_VALUES.map((v) => ({
            value: v,
            label: t.venueChainLabels[v] ?? v,
          }))}
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
                  {col("eventDate", t.columns.eventDate)}
                  {col("venuePlace", t.columns.venuePlace)}
                  {col("category", t.columns.category, "hidden md:table-cell")}
                  {col("venueChain", t.columns.venueChain, "hidden sm:table-cell")}
                  {col("lotteryTotal", t.columns.lotteryTotal, "hidden lg:table-cell text-right")}
                  {col("seatedTotal", t.columns.seatedTotal, "hidden lg:table-cell text-right")}
                  {col("apptTotal", t.columns.apptTotal, "text-right")}
                  {/* 提出者は氏名が別テーブルにあるため並べ替えの対象にしない（条件で絞る）。 */}
                  {result.isAdmin ? (
                    <th scope="col" className={th("hidden md:table-cell")}>
                      {l.submittedByColumn}
                    </th>
                  ) : null}
                  {col("createdAt", t.columns.createdAt, "hidden lg:table-cell")}
                </tr>
              </thead>
              <tbody className="divide-hairline-light divide-y">
                {result.rows.map((r) => (
                  <tr key={r.id}>
                    <td className={`${P_TD} tabular-nums`}>
                      <PartnerRowLink href={`/p-reports/${r.id}`}>
                        {formatDate(r.eventDate)}
                      </PartnerRowLink>
                      {/* 狭い画面では抽選 / 着座の合計と種別を畳んで見せる
                          （両面・片面の内訳は詳細で確認する）。 */}
                      <span className={P_SUB}>
                        {t.columns.lotteryTotal}: {r.lotteryTotal} / {t.columns.seatedTotal}:{" "}
                        {r.seatedTotal}
                        <span className="block">
                          {t.columns.category}:{" "}
                          {t.categoryLabels[r.category as keyof typeof t.categoryLabels] ??
                            r.category}
                          {result.isAdmin
                            ? ` / ${l.submittedByColumn}: ${r.submitterName ?? labels.partner.common.dash}`
                            : null}
                        </span>
                      </span>
                    </td>
                    <td className={P_TD}>{r.venuePlace}</td>
                    <td className={`${P_TD} hidden md:table-cell`}>
                      {t.categoryLabels[r.category as keyof typeof t.categoryLabels] ?? r.category}
                    </td>
                    <td className={`${P_TD} hidden sm:table-cell`}>
                      {t.venueChainLabels[r.venueChain as keyof typeof t.venueChainLabels] ??
                        r.venueChain}
                    </td>
                    <td className={`${P_TD} hidden text-right tabular-nums lg:table-cell`}>
                      {r.lotteryTotal}
                    </td>
                    <td className={`${P_TD} hidden text-right tabular-nums lg:table-cell`}>
                      {r.seatedTotal}
                    </td>
                    <td className={`${P_TD} text-right tabular-nums`}>{r.apptTotal}</td>
                    {result.isAdmin ? (
                      <td className={`${P_TD} hidden md:table-cell`}>
                        {r.submitterName ?? labels.partner.common.dash}
                      </td>
                    ) : null}
                    <td className={`${P_TD} hidden tabular-nums lg:table-cell`}>
                      {formatDate(r.createdAt)}
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
