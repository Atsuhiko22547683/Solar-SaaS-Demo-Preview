// 二次店ポータル：自社（スタッフは本人提出分）の成約一覧。
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

import { listPartnerContracts } from "./data";
import { AFFILIATION_VALUES, CONTRACT_CHANNEL_VALUES, parseContractQuery } from "./query";

import type { RawParams } from "@/lib/partner/list-query";

export const dynamic = "force-dynamic";

const BASE = "/p-contracts";
const t = labels.partner.contract;
const l = labels.partner.list;

const SORT_OPTIONS = [
  { field: "contractDate" as const, label: t.columns.contractDate },
  { field: "tossDate" as const, label: t.columns.tossDate },
  { field: "tossDept" as const, label: t.columns.tossDept },
  { field: "salesRep" as const, label: t.columns.salesRep },
  { field: "referralBranch" as const, label: t.columns.referralBranch },
  { field: "affiliation" as const, label: t.columns.affiliation },
  { field: "acquisitionChannel" as const, label: t.columns.acquisitionChannel },
  { field: "createdAt" as const, label: t.columns.createdAt },
];

export default async function PartnerContractsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const q = parseContractQuery(params);
  const result = await listPartnerContracts(q);
  const hasAnyCondition = Object.keys(params).some((k) => !["sort", "dir", "page"].includes(k));
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

  return (
    <div>
      <PartnerPageHeader
        title={t.listTitle}
        action={
          <Link
            href="/p-contracts/new"
            className="bg-primary focus-visible:ring-primary/40 inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 sm:h-9 sm:w-auto sm:px-3"
          >
            {labels.partner.home.cards.contracts.action}
          </Link>
        }
      />

      <FilterPanel
        action={BASE}
        sort={q.sort}
        errors={q.errors}
        notes={[l.adminScopeNote]}
        advancedActive={Boolean(
          q.tossDate.from ||
          q.tossDate.to ||
          q.tossDept ||
          q.apptGetter ||
          q.affiliationDept ||
          q.affiliation ||
          q.acquisitionChannel ||
          q.submittedBy,
        )}
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
            <DateRangeField
              label={t.filters.tossDate}
              name="tossDate"
              from={q.tossDate.from}
              to={q.tossDate.to}
            />
            <TextField label={t.filters.tossDept} name="tossDept" value={q.tossDept} />
            <TextField label={t.filters.apptGetter} name="apptGetter" value={q.apptGetter} />
            <TextField
              label={t.filters.affiliationDept}
              name="affiliationDept"
              value={q.affiliationDept}
            />
            <SelectField
              label={t.filters.affiliation}
              name="affiliation"
              value={q.affiliation}
              options={AFFILIATION_VALUES.map((v) => ({
                value: v,
                label: t.affiliationLabels[v] ?? v,
              }))}
            />
            <SelectField
              label={t.filters.acquisitionChannel}
              name="acquisitionChannel"
              value={q.acquisitionChannel}
              options={CONTRACT_CHANNEL_VALUES.map((v) => ({
                value: v,
                label: t.acquisitionChannelLabels[v] ?? v,
              }))}
            />
          </>
        }
      >
        <DateRangeField
          label={t.filters.contractDate}
          name="contractDate"
          from={q.contractDate.from}
          to={q.contractDate.to}
        />
        <TextField label={t.filters.salesRep} name="salesRep" value={q.salesRep} />
        <TextField
          label={t.filters.referralBranch}
          name="referralBranch"
          value={q.referralBranch}
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
                  {col("contractDate", t.columns.contractDate)}
                  {col("salesRep", t.columns.salesRep)}
                  {col("tossDate", t.columns.tossDate, "hidden sm:table-cell")}
                  {col("referralBranch", t.columns.referralBranch, "hidden md:table-cell")}
                  {col("affiliation", t.columns.affiliation, "hidden md:table-cell")}
                  {col("acquisitionChannel", t.columns.acquisitionChannel, "hidden lg:table-cell")}
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
                      <PartnerRowLink href={`/p-contracts/${r.id}`}>
                        {formatDate(r.contractDate)}
                      </PartnerRowLink>
                      {/* 狭い画面で隠す列をラベル付きで畳む。 */}
                      <span className={P_SUB}>
                        {t.columns.tossDate}: {formatDate(r.tossDate)} / {t.columns.referralBranch}:{" "}
                        {r.referralBranch}
                        <span className="block">
                          {t.columns.affiliation}:{" "}
                          {t.affiliationLabels[r.affiliation] ?? r.affiliation} /{" "}
                          {t.columns.acquisitionChannel}:{" "}
                          {t.acquisitionChannelLabels[r.acquisitionChannel] ?? r.acquisitionChannel}
                        </span>
                        {result.isAdmin ? (
                          <span className="block">
                            {l.submittedByColumn}: {r.submitterName ?? labels.partner.common.dash}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className={P_TD}>{r.salesRep}</td>
                    <td className={`${P_TD} hidden tabular-nums sm:table-cell`}>
                      {formatDate(r.tossDate)}
                    </td>
                    <td className={`${P_TD} hidden md:table-cell`}>{r.referralBranch}</td>
                    <td className={`${P_TD} hidden md:table-cell`}>
                      {t.affiliationLabels[r.affiliation] ?? r.affiliation}
                    </td>
                    <td className={`${P_TD} hidden lg:table-cell`}>
                      {t.acquisitionChannelLabels[r.acquisitionChannel] ?? r.acquisitionChannel}
                    </td>
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
