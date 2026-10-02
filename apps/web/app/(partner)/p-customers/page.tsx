// 二次店ポータル：担当顧客の一覧（本人が担当者として割り当てられている顧客のみ）。
// 検索・並べ替え・ページは URL クエリに持つ（query.ts が検証する）。

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
import { formatDate, formatDateTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { listMyCustomers } from "./data";
import {
  CUSTOMER_SALES_CHANNEL_VALUES,
  CUSTOMER_STATUS_VALUES,
  DEAL_STATUS_VALUES,
  parseCustomerQuery,
} from "./query";

import type { RawParams } from "@/lib/partner/list-query";

export const dynamic = "force-dynamic";

const BASE = "/p-customers";
const t = labels.partner.customer;
const c = labels.partner.common;
const l = labels.partner.list;
const channelLabels = labels.partner.appointment.salesChannelLabels;

const ASSIGNMENT_LABEL: Record<string, string> = {
  TOSS_UP: t.assignment.tossUp,
  CLOSING: t.assignment.closing,
  DEAL: t.assignment.deal,
};

export default async function PartnerCustomersPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const q = parseCustomerQuery(params);
  const result = await listMyCustomers(q);
  const hasAnyCondition = Object.keys(params).some((k) => !["sort", "dir", "page"].includes(k));
  const th = (extra = "") => `${P_TH} ${extra}`.trim();
  // マスキング中はお客様名の並べ替えを選択肢から外す（列見出しも普通の見出しにする）。
  const sortOptions = [
    ...(result.canSearchName ? [{ field: "name" as const, label: t.columns.name }] : []),
    { field: "createdAt" as const, label: t.columns.registeredAt },
    { field: "updatedAt" as const, label: t.columns.updatedAt },
  ];
  const notes =
    !result.canSearchName && (q.name || q.sort.field === "name")
      ? [l.maskedNameSearchDisabled]
      : [];

  return (
    <div>
      <PartnerPageHeader
        title={result.isAdmin ? t.admin.listTitle : t.listTitle}
        description={result.isAdmin ? t.admin.listSubtitle : t.listSubtitle}
      />

      <FilterPanel action={BASE} sort={q.sort} errors={q.errors} notes={notes}>
        <TextField
          label={t.filters.name}
          name="name"
          value={q.name}
          disabled={!result.canSearchName}
          hint={result.canSearchName ? undefined : l.maskedNameSearchDisabled}
        />
        {/* フリガナは氏名と同じ扱い（マスキング中は使わせない）。 */}
        <TextField
          label={t.filters.kana}
          name="kana"
          value={q.kana}
          disabled={!result.canSearchName}
          hint={result.canSearchName ? undefined : l.maskedNameSearchDisabled}
        />
        <TextField label={t.filters.phone} name="phone" value={q.phone} />
        <TextField label={t.filters.address} name="address" value={q.address} />
        <TextField label={t.filters.venue} name="venue" value={q.venue} />
        <SelectField
          label={result.isAdmin ? t.filters.dealStatusAdmin : t.filters.dealStatus}
          name="dealStatus"
          value={q.dealStatus}
          options={DEAL_STATUS_VALUES.map((v) => ({
            value: v,
            label: t.deal.statusLabels[v] ?? v,
          }))}
        />
        <SelectField
          label={t.filters.salesChannel}
          name="salesChannel"
          value={q.salesChannel}
          options={CUSTOMER_SALES_CHANNEL_VALUES.map((v) => ({
            value: v,
            label: channelLabels[v] ?? v,
          }))}
        />
        <DateRangeField
          label={t.filters.registeredAt}
          name="createdAt"
          from={q.createdAt.from}
          to={q.createdAt.to}
        />
        {/* 管理者だけの条件。自社全件が対象なので、担当者とステータスで絞れるようにする。 */}
        {result.isAdmin ? (
          <SelectField
            label={t.filters.status}
            name="status"
            value={q.status}
            options={CUSTOMER_STATUS_VALUES.map((v) => ({
              value: v,
              label: t.admin.statusLabels[v] ?? v,
            }))}
          />
        ) : null}
        {result.isAdmin ? (
          <SelectField
            label={t.filters.salesperson}
            name="salespersonId"
            value={q.salespersonId}
            options={result.salespersonOptions.map((s) => ({ value: s.id, label: s.name }))}
          />
        ) : null}
      </FilterPanel>

      <ResultSummary total={result.total} page={result.page} pageCount={result.pageCount} />
      <div className="sm:hidden">
        <SortSelect basePath={BASE} params={params} sort={q.sort} options={sortOptions} />
      </div>

      <PartnerCard className="overflow-hidden p-0">
        {result.total === 0 ? (
          hasAnyCondition ? (
            <NoMatch />
          ) : (
            <div className="px-4">
              <PartnerEmpty
                title={result.isAdmin ? t.admin.empty : t.empty}
                body={result.isAdmin ? t.admin.emptyCta : t.emptyCta}
              />
            </div>
          )
        ) : (
          <PartnerTableScroll>
            <table className="w-full text-sm">
              <thead className="bg-surface-soft/50">
                <tr className="border-hairline-light border-b">
                  {result.canSearchName ? (
                    <SortableTh
                      field="name"
                      label={t.columns.name}
                      basePath={BASE}
                      params={params}
                      sort={q.sort}
                      className={th()}
                    />
                  ) : (
                    <th scope="col" className={th()}>
                      {t.columns.name}
                    </th>
                  )}
                  {/* 担当区分（本人視点）はスタッフ向け。管理者には担当販売員を出す。 */}
                  {result.isAdmin ? (
                    <th scope="col" className={th("hidden sm:table-cell")}>
                      {t.admin.columns.salesperson}
                    </th>
                  ) : (
                    <th scope="col" className={th("hidden sm:table-cell")}>
                      {t.columns.assignment}
                    </th>
                  )}
                  {result.isAdmin ? (
                    <th scope="col" className={th("hidden md:table-cell")}>
                      {t.admin.columns.status}
                    </th>
                  ) : null}
                  <th scope="col" className={th()}>
                    {t.columns.dealStatus}
                  </th>
                  <SortableTh
                    field="createdAt"
                    label={t.columns.registeredAt}
                    basePath={BASE}
                    params={params}
                    sort={q.sort}
                    className={th("hidden md:table-cell")}
                  />
                  <SortableTh
                    field="updatedAt"
                    label={t.columns.updatedAt}
                    basePath={BASE}
                    params={params}
                    sort={q.sort}
                    className={th("hidden lg:table-cell")}
                  />
                </tr>
              </thead>
              <tbody className="divide-hairline-light divide-y">
                {result.rows.map((r) => (
                  <tr key={r.id}>
                    <td className={P_TD}>
                      <PartnerRowLink href={`/p-customers/${r.id}`}>{r.name}</PartnerRowLink>
                      {/* 狭い画面で隠す列をラベル付きで畳む。 */}
                      <span className={P_SUB}>
                        {result.isAdmin
                          ? `${t.admin.columns.salesperson}: ${r.salespersonNames.join(" / ") || c.dash}`
                          : `${t.columns.assignment}: ${r.assignments.map((a) => ASSIGNMENT_LABEL[a] ?? a).join(" / ") || c.dash}`}
                        <span className="block">
                          {result.isAdmin
                            ? `${t.admin.columns.status}: ${t.admin.statusLabels[r.status] ?? r.status} / `
                            : null}
                          {t.columns.registeredAt}: {formatDate(r.registeredAt)}
                        </span>
                      </span>
                    </td>
                    <td className={`${P_TD} hidden sm:table-cell`}>
                      {result.isAdmin
                        ? r.salespersonNames.join(" / ") || c.dash
                        : r.assignments.map((a) => ASSIGNMENT_LABEL[a] ?? a).join(" / ")}
                    </td>
                    {result.isAdmin ? (
                      <td className={`${P_TD} hidden md:table-cell`}>
                        {t.admin.statusLabels[r.status] ?? r.status}
                      </td>
                    ) : null}
                    <td className={P_TD}>
                      {r.latestDealStatus
                        ? (t.deal.statusLabels[r.latestDealStatus] ?? r.latestDealStatus)
                        : c.dash}
                    </td>
                    <td className={`${P_TD} hidden tabular-nums md:table-cell`}>
                      {formatDate(r.registeredAt)}
                    </td>
                    <td className={`${P_TD} hidden tabular-nums lg:table-cell`}>
                      {formatDateTime(r.updatedAt)}
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
