// 二次店ポータル：利用者アカウント一覧（二次店管理者のみ）。
//
// 扱うのは自社（同じテナント）のログイン利用者だけ。所属二次店は招待時に決まり
// この画面では変更できないので、見出しに表示だけする。
// 検索・並べ替え・ページは URL クエリに持つ（query.ts が検証する）。

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
import { formatDateTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { listPartnerAccounts } from "./data";
import { InviteAccountForm } from "./invite-account-form";
import {
  ACCOUNT_LINK_VALUES,
  ACCOUNT_ROLE_VALUES,
  ACCOUNT_STATUS_VALUES,
  parseAccountQuery,
} from "./query";

import type { AccountSortField } from "./query";
import type { RawParams } from "@/lib/partner/list-query";

export const dynamic = "force-dynamic";

const BASE = "/p-accounts";
const t = labels.partner.account;
const c = labels.partner.common;

const SORT_OPTIONS: { field: AccountSortField; label: string }[] = [
  { field: "name", label: t.columns.name },
  { field: "email", label: t.columns.email },
  { field: "status", label: t.columns.status },
  { field: "lastLoginAt", label: t.columns.lastLoginAt },
];

export default async function PartnerAccountsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const q = parseAccountQuery(params);
  const result = await listPartnerAccounts(q);
  const hasAnyCondition = Object.keys(params).some((k) => !["sort", "dir", "page"].includes(k));
  const th = (extra = "") => `${P_TH} ${extra}`.trim();
  const col = (field: AccountSortField, label: string, extra = "") => (
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

      {/* 所属二次店は表示のみ。この画面からは変更できない。 */}
      <p className="text-mute-light mb-4 text-[13px]">
        {labels.partner.home.belongLabel}:{" "}
        <span className="text-ink">{result.dealerName ?? c.dash}</span>
        {result.franchiseNo ? (
          <>
            {"　"}
            {labels.partner.home.franchiseNoLabel}:{" "}
            <span className="text-ink tabular-nums">{result.franchiseNo}</span>
          </>
        ) : null}
        <span className="block">{t.belongNote}</span>
      </p>

      <PartnerCard className="mb-4">
        <h2 className="text-ink mb-3 text-sm font-semibold">{t.invite.title}</h2>
        <InviteAccountForm />
      </PartnerCard>

      <FilterPanel action={BASE} sort={q.sort} errors={q.errors} notes={[t.linkNote]}>
        <TextField label={t.filters.keyword} name="keyword" value={q.keyword} />
        <SelectField
          label={t.filters.role}
          name="role"
          value={q.role}
          options={ACCOUNT_ROLE_VALUES.map((v) => ({ value: v, label: t.roleLabels[v] ?? v }))}
        />
        <SelectField
          label={t.filters.status}
          name="status"
          value={q.status}
          options={ACCOUNT_STATUS_VALUES.map((v) => ({ value: v, label: t.statusLabels[v] ?? v }))}
        />
        <SelectField
          label={t.filters.link}
          name="link"
          value={q.link}
          options={ACCOUNT_LINK_VALUES.map((v) => ({ value: v, label: t.linkLabels[v] ?? v }))}
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
                  {col("email", t.columns.email, "hidden sm:table-cell")}
                  <th scope="col" className={th()}>
                    {t.columns.role}
                  </th>
                  {col("status", t.columns.status)}
                  <th scope="col" className={th("hidden md:table-cell")}>
                    {t.columns.salesperson}
                  </th>
                  {col("lastLoginAt", t.columns.lastLoginAt, "hidden lg:table-cell")}
                </tr>
              </thead>
              <tbody className="divide-hairline-light divide-y">
                {result.rows.map((r) => (
                  <tr key={r.id}>
                    <td className={P_TD}>
                      <PartnerRowLink href={`${BASE}/${r.id}`}>{r.name}</PartnerRowLink>
                      {/* 狭い画面で隠す列をラベル付きで畳む。メールは折り返す。 */}
                      <span className={`${P_SUB} break-all`}>
                        {r.email}
                        <span className="block break-normal">
                          {t.columns.salesperson}: {r.salespersonName ?? c.dash} /{" "}
                          {t.columns.lastLoginAt}:{" "}
                          {r.lastLoginAt ? formatDateTime(r.lastLoginAt) : c.dash}
                        </span>
                      </span>
                    </td>
                    <td className={`${P_TD} hidden sm:table-cell`}>{r.email}</td>
                    <td className={P_TD}>{t.roleLabels[r.role] ?? r.role}</td>
                    <td className={P_TD}>{t.statusLabels[r.status] ?? r.status}</td>
                    <td className={`${P_TD} hidden md:table-cell`}>
                      {r.salespersonName ?? c.dash}
                    </td>
                    <td className={`${P_TD} hidden tabular-nums lg:table-cell`}>
                      {r.lastLoginAt ? formatDateTime(r.lastLoginAt) : c.dash}
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
