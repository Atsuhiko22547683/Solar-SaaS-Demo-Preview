// 二次店ポータル：手数料管理（営業フィー）。二次店管理者のみ。
//
// 上段が「適用中の手数料率」（代理店が設定する値。ここでは閲覧のみ）、
// 下段が「確定した営業フィー」の一覧。検索・並べ替え・ページは URL クエリに持つ。

import {
  DateRangeField,
  FilterPanel,
  MonthRangeField,
  NoMatch,
  NumberRangeField,
  Pagination,
  ResultSummary,
  SortableTh,
} from "@/components/partner/list-filter";
import { SortSelect } from "@/components/partner/list-sort-select";
import {
  P_SUB,
  P_TD,
  P_TH,
  PartnerCard,
  PartnerEmpty,
  PartnerField,
  PartnerFieldGrid,
  PartnerPageHeader,
  PartnerTableScroll,
} from "@/components/partner/partner-ui";
import { formatDate } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { getPartnerCommissions } from "./data";
import { parseCommissionQuery } from "./query";
import { formatYen } from "../p-catalog/format";

import type { CommissionSortField } from "./query";
import type { RawParams } from "@/lib/partner/list-query";

export const dynamic = "force-dynamic";

const BASE = "/p-commissions";
const t = labels.partner.commission;
const c = labels.partner.common;

const SORT_OPTIONS: { field: CommissionSortField; label: string }[] = [
  { field: "settledMonth", label: t.columns.settledMonth },
  { field: "amount", label: t.columns.amount },
  { field: "finalizedAt", label: t.columns.finalizedAt },
];

/** 率は Decimal 文字列（例 "12.50"）。末尾の 0 を落として % を付ける。 */
function formatRate(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return `${n}%`;
}

export default async function PartnerCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const q = parseCommissionQuery(params);
  const result = await getPartnerCommissions(q);
  const hasAnyCondition = Object.keys(params).some((k) => !["sort", "dir", "page"].includes(k));
  const th = (extra = "") => `${P_TH} ${extra}`.trim();
  const col = (field: CommissionSortField, label: string, extra = "") => (
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
      <PartnerPageHeader title={t.listTitle} description={t.listSubtitle} />

      <PartnerCard className="mb-4">
        <h2 className="text-ink mb-1 text-sm font-semibold">{t.rateSection}</h2>
        <p className="text-mute-light mb-3 text-[13px]">{t.readOnlyNote}</p>
        {result.rate ? (
          <PartnerFieldGrid>
            <PartnerField label={t.fields.tossUpRate} value={formatRate(result.rate.tossUpRate)} />
            <PartnerField
              label={t.fields.closingRate}
              value={formatRate(result.rate.closingRate)}
            />
            <PartnerField label={t.fields.applyFrom} value={formatDate(result.rate.applyFrom)} />
            <PartnerField
              label={t.fields.applyTo}
              value={result.rate.applyTo ? formatDate(result.rate.applyTo) : c.dash}
            />
            <PartnerField label={t.fields.updatedAt} value={formatDate(result.rate.updatedAt)} />
          </PartnerFieldGrid>
        ) : (
          <PartnerEmpty title={t.rateEmpty} body={t.rateEmptyCta} />
        )}
      </PartnerCard>

      <h2 className="text-ink mb-2 text-sm font-semibold">{t.listSection}</h2>

      <FilterPanel action={BASE} sort={q.sort} errors={q.errors} notes={[t.costNote]}>
        <MonthRangeField
          label={t.filters.settledMonth}
          name="month"
          from={q.monthFrom}
          to={q.monthTo}
        />
        <DateRangeField
          label={t.filters.contractDate}
          name="contractDate"
          from={q.contractDate.from}
          to={q.contractDate.to}
        />
        <NumberRangeField
          label={t.filters.amount}
          name="amount"
          min={q.amount.min}
          max={q.amount.max}
          unit={labels.common.currencySuffix}
        />
      </FilterPanel>

      <ResultSummary total={result.total} page={result.page} pageCount={result.pageCount} />
      <p className="text-mute-light mb-2 text-[13px]">
        {t.totalLabel}:{" "}
        <span className="text-ink tabular-nums">{formatYen(result.totalAmount)}</span>
      </p>
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
                  {col("settledMonth", t.columns.settledMonth)}
                  <th scope="col" className={th("hidden sm:table-cell")}>
                    {t.columns.contractDate}
                  </th>
                  <th scope="col" className={th("hidden text-right lg:table-cell")}>
                    {t.columns.targetProfit}
                  </th>
                  <th scope="col" className={th("hidden text-right md:table-cell")}>
                    {t.columns.rate}
                  </th>
                  {col("amount", t.columns.amount, "text-right")}
                  {col("finalizedAt", t.columns.finalizedAt, "hidden lg:table-cell")}
                </tr>
              </thead>
              <tbody className="divide-hairline-light divide-y">
                {result.rows.map((r) => (
                  <tr key={r.id}>
                    <td className={`${P_TD} tabular-nums`}>
                      {r.settledMonth}
                      {/* 狭い画面で隠す列（契約日 / 対象粗利 / 率 / 確定日）を畳む。 */}
                      <span className={`${P_SUB} font-normal`}>
                        {t.columns.contractDate}:{" "}
                        {r.contractDate ? formatDate(r.contractDate) : c.dash} / {t.columns.rate}:{" "}
                        {formatRate(r.rate)}
                        <span className="block">
                          {t.columns.targetProfit}: {formatYen(r.targetProfit)} /{" "}
                          {t.columns.finalizedAt}:{" "}
                          {r.finalizedAt ? formatDate(r.finalizedAt) : c.dash}
                        </span>
                      </span>
                    </td>
                    <td className={`${P_TD} hidden tabular-nums sm:table-cell`}>
                      {r.contractDate ? formatDate(r.contractDate) : c.dash}
                    </td>
                    <td className={`${P_TD} hidden text-right tabular-nums lg:table-cell`}>
                      {formatYen(r.targetProfit)}
                    </td>
                    <td className={`${P_TD} hidden text-right tabular-nums md:table-cell`}>
                      {formatRate(r.rate)}
                    </td>
                    <td className={`${P_TD} text-right tabular-nums`}>{formatYen(r.amount)}</td>
                    <td className={`${P_TD} hidden tabular-nums lg:table-cell`}>
                      {r.finalizedAt ? formatDate(r.finalizedAt) : c.dash}
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
