// 二次店ポータル：カタログ一覧（閲覧専用）。
//
// カテゴリ → メーカー → 商品名・型番 / 卸値の範囲 / 商品仕様 の順に絞り込める。
// カテゴリ・メーカーを変えても並べ替えは解除しない（URL クエリの sort / dir を引き継ぐ）。
// 仕入値は出さない（ローダーが select しない）。

import Link from "next/link";

import {
  FilterPanel,
  NoMatch,
  NumberRangeField,
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
import { withParams, type RawParams } from "@/lib/partner/list-query";

import { listPartnerCatalog } from "./data";
import { formatYen } from "./format";
import { BATTERY_FUNCTION_VALUES, parseCatalogQuery } from "./query";

export const dynamic = "force-dynamic";

const BASE = "/p-catalog";
const t = labels.partner.catalog;
const l = labels.partner.list;

const SORT_OPTIONS = [
  { field: "name" as const, label: t.columns.name },
  { field: "category" as const, label: t.columns.category },
  { field: "maker" as const, label: t.columns.maker },
  { field: "dealerPrice" as const, label: t.columns.dealerPrice },
  { field: "capacity" as const, label: t.columns.capacity },
];

export default async function PartnerCatalogPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const q = parseCatalogQuery(params);
  const result = await listPartnerCatalog(q);
  const hasAnyCondition = Object.keys(params).some((k) => !["sort", "dir", "page"].includes(k));
  const notes = result.makerReset ? [l.makerReset] : [];
  const th = (extra = "") => `${P_TH} ${extra}`.trim();
  const col = (field: (typeof SORT_OPTIONS)[number]["field"], label: string, extra = "") => (
    <SortableTh
      field={field}
      label={label}
      basePath={BASE}
      params={params}
      sort={q.sort}
      className={th(extra)}
    />
  );
  const isBattery = result.category === "BATTERY";

  return (
    <div>
      <PartnerPageHeader title={t.listTitle} description={t.listSubtitle} />

      {/* カテゴリ切替。他の条件と並べ替えは引き継ぐ（メーカーが対象外ならローダーが「すべて」へ戻す）。 */}
      <nav aria-label={t.filterAriaLabel} className="mb-4">
        <ul className="flex flex-wrap gap-2">
          {[undefined, ...result.categories].map((cat) => {
            const active = cat === result.category;
            return (
              <li key={cat ?? "__all"}>
                <Link
                  href={withParams(BASE, params, { category: cat, page: undefined })}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "focus-visible:ring-primary/40 inline-flex h-11 items-center rounded-full border px-4 text-sm focus:outline-none focus-visible:ring-2 sm:h-9 sm:px-3",
                    active
                      ? "border-primary bg-primary/5 text-ink font-medium"
                      : "border-hairline-light text-mute-light hover:text-ink",
                  ].join(" ")}
                >
                  {cat ? (t.categoryLabels[cat] ?? cat) : t.allCategories}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <FilterPanel
        action={BASE}
        sort={q.sort}
        errors={q.errors}
        notes={notes}
        advancedActive={Boolean(
          q.series ||
          q.dealerPrice.min !== undefined ||
          q.dealerPrice.max !== undefined ||
          q.capacity.min !== undefined ||
          q.capacity.max !== undefined,
        )}
        advanced={
          <>
            <TextField label={t.filters.series} name="series" value={q.series} />
            <NumberRangeField
              label={t.filters.capacity}
              name="capacity"
              min={q.capacity.min}
              max={q.capacity.max}
            />
            {isBattery ? (
              <SelectField
                label={t.filters.batteryFunctionType}
                name="batteryFunctionType"
                value={q.batteryFunctionType}
                options={BATTERY_FUNCTION_VALUES.map((v) => ({
                  value: v,
                  label: t.batteryFunctionTypeLabels[v] ?? v,
                }))}
              />
            ) : null}
          </>
        }
      >
        {/* カテゴリはタブで選ぶが、フォーム送信でも保持されるよう hidden に載せる。 */}
        {result.category ? <input type="hidden" name="category" value={result.category} /> : null}
        <SelectField
          label={t.filters.maker}
          name="maker"
          value={result.maker}
          options={result.makers.map((m) => ({ value: m, label: m }))}
        />
        <TextField label={t.filters.keyword} name="q" value={q.keyword} />
        <NumberRangeField
          label={t.filters.dealerPrice}
          name="price"
          min={q.dealerPrice.min}
          max={q.dealerPrice.max}
          unit="円"
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
                  {col("category", t.columns.category, "hidden sm:table-cell")}
                  {col("maker", t.columns.maker, "hidden sm:table-cell")}
                  <th scope="col" className={th("hidden lg:table-cell")}>
                    {t.columns.modelNo}
                  </th>
                  {col("capacity", t.columns.capacity, "hidden md:table-cell text-right")}
                  {col("dealerPrice", t.columns.dealerPrice, "text-right")}
                </tr>
              </thead>
              <tbody className="divide-hairline-light divide-y">
                {result.rows.map((r) => (
                  <tr key={r.id}>
                    <td className={P_TD}>
                      <PartnerRowLink href={`/p-catalog/${r.id}`}>{r.name}</PartnerRowLink>
                      {/* 狭い幅で隠す列（カテゴリ / メーカー / 型番 / 容量）を畳む。 */}
                      <span className={P_SUB}>
                        {t.categoryLabels[r.category] ?? r.category} / {r.maker}
                        <span className="block break-all">
                          {r.modelNo ? `${t.columns.modelNo}: ${r.modelNo}` : null}
                          {r.modelNo && r.capacity ? " / " : null}
                          {r.capacity ? `${t.columns.capacity}: ${r.capacity} ${r.unit}` : null}
                        </span>
                      </span>
                    </td>
                    <td className={`${P_TD} hidden sm:table-cell`}>
                      {t.categoryLabels[r.category] ?? r.category}
                    </td>
                    <td className={`${P_TD} hidden sm:table-cell`}>{r.maker}</td>
                    <td className={`${P_TD} hidden lg:table-cell`}>{r.modelNo ?? "—"}</td>
                    <td className={`${P_TD} hidden text-right tabular-nums md:table-cell`}>
                      {r.capacity ? `${r.capacity} ${r.unit}` : "—"}
                    </td>
                    <td className={`${P_TD} text-right tabular-nums`}>
                      {formatYen(r.dealerPrice)}
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
