// 二次店ポータル：自社（スタッフは本人提出分）のアポイント一覧。
//
// 初訪アポ（Customer + Appointment）と訪問アポ（専用テーブル）は保存先が違うが、
// 一覧はアポ区分の列を付けて 1 本にまとめて見せる。列は「お客様名」と「クローズ部署」を
// 分け、訪問アポの部署名を顧客名として出さない。
//
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
import { formatDate, formatDateTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { listPartnerAppointments, listPartnerSalespersonOptions } from "./data";
import { parseAppointmentQuery, SALES_CHANNEL_VALUES } from "./query";

import type { RawParams } from "@/lib/partner/list-query";

export const dynamic = "force-dynamic";

const BASE = "/p-appointments";
const t = labels.partner.appointment;
const c = labels.partner.common;
const l = labels.partner.list;
const kind = labels.partner.appointmentKind;

const SORT_OPTIONS = [
  { field: "kind" as const, label: t.columns.kind },
  { field: "customerName" as const, label: t.columns.customerName },
  { field: "firstVisitAt" as const, label: t.columns.firstVisitAt },
  { field: "venuePlace" as const, label: t.columns.venuePlace },
  { field: "createdAt" as const, label: t.columns.createdAt },
];

export default async function PartnerAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const q = parseAppointmentQuery(params);
  const result = await listPartnerAppointments(q);
  // 訪問アポ専用の担当者セレクト（自社の有効な販売員。id と氏名だけ）。
  const salespeople = q.kind === "visit" ? await listPartnerSalespersonOptions() : [];
  const isVisit = q.kind === "visit";
  const isFirstVisit = q.kind === "first-visit";
  const hasAnyCondition = Object.keys(params).some((k) => !["sort", "dir", "page"].includes(k));

  const th = (extra = "") => `${P_TH} ${extra}`.trim();

  return (
    <div>
      <PartnerPageHeader
        title={t.listTitle}
        action={
          <Link
            href="/p-appointments/new"
            className="bg-primary focus-visible:ring-primary/40 inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 sm:h-9 sm:w-auto sm:px-3"
          >
            {labels.partner.home.cards.appointments.action}
          </Link>
        }
      />

      <FilterPanel
        action={BASE}
        sort={q.sort}
        errors={q.errors}
        notes={[...q.notes, l.adminScopeNote]}
        advancedActive={Boolean(
          q.createdAt.from ||
          q.createdAt.to ||
          q.tossDept ||
          q.closeDept ||
          q.salespersonId ||
          q.salesChannel ||
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
              label={t.filters.createdAt}
              name="createdAt"
              from={q.createdAt.from}
              to={q.createdAt.to}
            />
            {/* 訪問アポ専用の条件。区分が「訪問アポ」のときだけ使える。 */}
            <TextField
              label={t.filters.tossDept}
              name="tossDept"
              value={q.tossDept}
              disabled={!isVisit}
              hint={isVisit ? undefined : l.notApplicable}
            />
            <TextField
              label={t.filters.closeDept}
              name="closeDept"
              value={q.closeDept}
              disabled={!isVisit}
              hint={isVisit ? undefined : l.notApplicable}
            />
            <SelectField
              label={t.filters.salesperson}
              name="salespersonId"
              value={q.salespersonId}
              options={salespeople.map((s) => ({ value: s.id, label: s.name }))}
              disabled={!isVisit}
              hint={isVisit ? undefined : l.notApplicable}
            />
            <SelectField
              label={t.filters.channel}
              name="salesChannel"
              value={q.salesChannel}
              options={SALES_CHANNEL_VALUES.map((v) => ({
                value: v,
                label: t.salesChannelLabels[v] ?? v,
              }))}
              disabled={!isVisit}
              hint={isVisit ? undefined : l.notApplicable}
            />
          </>
        }
      >
        <SelectField
          label={t.filters.kind}
          name="kind"
          value={q.kind}
          options={[
            { value: "first-visit", label: kind.labels.FIRST_VISIT! },
            { value: "visit", label: kind.labels.VISIT! },
          ]}
        />
        {/* 初訪アポ専用の条件。区分が「訪問アポ」のときは使えない。 */}
        <TextField
          label={t.filters.customerName}
          name="customerName"
          value={q.customerName}
          disabled={isVisit}
          hint={isVisit ? l.notApplicable : undefined}
        />
        <TextField
          label={t.filters.venuePlace}
          name="venuePlace"
          value={q.venuePlace}
          disabled={isVisit}
          hint={isVisit ? l.notApplicable : undefined}
        />
        <DateRangeField
          label={t.filters.firstVisitAt}
          name="firstVisitAt"
          from={q.firstVisitAt.from}
          to={q.firstVisitAt.to}
          disabled={isVisit}
          hint={isVisit ? l.notApplicable : undefined}
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
                  <SortableTh
                    field="kind"
                    label={t.columns.kind}
                    basePath={BASE}
                    params={params}
                    sort={q.sort}
                    className={th()}
                  />
                  {!isVisit ? (
                    <SortableTh
                      field="customerName"
                      label={t.columns.customerName}
                      basePath={BASE}
                      params={params}
                      sort={q.sort}
                      className={th()}
                    />
                  ) : null}
                  {!isFirstVisit ? (
                    <th scope="col" className={th()}>
                      {t.columns.closeDept}
                    </th>
                  ) : null}
                  {!isVisit ? (
                    <SortableTh
                      field="firstVisitAt"
                      label={t.columns.firstVisitAt}
                      basePath={BASE}
                      params={params}
                      sort={q.sort}
                      className={th("hidden sm:table-cell")}
                    />
                  ) : null}
                  {!isVisit ? (
                    <SortableTh
                      field="venuePlace"
                      label={t.columns.venuePlace}
                      basePath={BASE}
                      params={params}
                      sort={q.sort}
                      className={th("hidden md:table-cell")}
                    />
                  ) : null}
                  {/* 提出者は氏名が別テーブルにあるため並べ替えの対象にしない（条件で絞る）。 */}
                  {result.isAdmin ? (
                    <th scope="col" className={th("hidden md:table-cell")}>
                      {l.submittedByColumn}
                    </th>
                  ) : null}
                  <SortableTh
                    field="createdAt"
                    label={t.columns.createdAt}
                    basePath={BASE}
                    params={params}
                    sort={q.sort}
                    className={th("hidden sm:table-cell")}
                  />
                </tr>
              </thead>
              <tbody className="divide-hairline-light divide-y">
                {result.rows.map((r) => {
                  const href =
                    r.kind === "VISIT"
                      ? `/p-appointments/visit/${r.id}`
                      : `/p-appointments/${r.id}`;
                  return (
                    <tr key={`${r.kind}-${r.id}`}>
                      <td className={P_TD}>
                        <PartnerRowLink href={href}>{kind.labels[r.kind]}</PartnerRowLink>
                        {/* 狭い画面で隠す列は、ここにラベル付きで畳んで確認できるようにする。 */}
                        <span className={P_SUB}>
                          {r.firstVisitAt
                            ? `${t.columns.firstVisitAt}: ${formatDateTime(r.firstVisitAt)}`
                            : null}
                          {r.firstVisitAt && r.venuePlace ? " / " : null}
                          {r.venuePlace ? `${t.columns.venuePlace}: ${r.venuePlace}` : null}
                          <span className="block">
                            {result.isAdmin
                              ? `${l.submittedByColumn}: ${r.submitterName ?? c.dash} / `
                              : null}
                            {t.columns.createdAt}: {formatDate(r.createdAt)}
                          </span>
                        </span>
                      </td>
                      {!isVisit ? (
                        <td className={P_TD}>
                          {r.customerName ? (
                            <PartnerRowLink href={href}>{r.customerName}</PartnerRowLink>
                          ) : (
                            <span className="text-mute-light">{c.dash}</span>
                          )}
                        </td>
                      ) : null}
                      {!isFirstVisit ? (
                        <td className={P_TD}>
                          {r.closeDept ? (
                            <PartnerRowLink href={href}>{r.closeDept}</PartnerRowLink>
                          ) : (
                            <span className="text-mute-light">{c.dash}</span>
                          )}
                        </td>
                      ) : null}
                      {!isVisit ? (
                        <td className={`${P_TD} hidden tabular-nums sm:table-cell`}>
                          {r.firstVisitAt ? formatDateTime(r.firstVisitAt) : c.dash}
                        </td>
                      ) : null}
                      {!isVisit ? (
                        <td className={`${P_TD} hidden md:table-cell`}>{r.venuePlace ?? c.dash}</td>
                      ) : null}
                      {result.isAdmin ? (
                        <td className={`${P_TD} hidden md:table-cell`}>
                          {r.submitterName ?? c.dash}
                        </td>
                      ) : null}
                      <td className={`${P_TD} hidden tabular-nums sm:table-cell`}>
                        {formatDate(r.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </PartnerTableScroll>
        )}
      </PartnerCard>

      <Pagination basePath={BASE} params={params} page={result.page} pageCount={result.pageCount} />
    </div>
  );
}
