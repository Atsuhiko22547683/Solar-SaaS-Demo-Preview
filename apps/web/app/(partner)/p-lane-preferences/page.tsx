// パートナーポータル：出店希望の一覧（パートナー管理者のみ）。
//
// 提出は「対象月 × 依頼先代理店」で 1 件。複数の代理店から依頼を受けている場合は
// 代理店ごとに別の行になる。ここでは提出済みのものを探して詳細へ入る。
//
// 検索の軸は対象月（ドロップダウン）・依頼先代理店・状態・店舗名/住所。
// 対象月は 1 値の絞り込みで、提出内容の「希望日程」（複数日）とは別の入力。

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
import { ListQueryScope } from "@/components/partner/list-query-scope";
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
import { RememberListQuery } from "@/components/partner/remember-list-query";
import { formatDateTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { listPartnerLanePreferences } from "./data";
import { LANE_PREFERENCE_STATUS_VALUES, monthOptions, parseLanePreferenceQuery } from "./query";

import type { RawParams } from "@/lib/partner/list-query";

export const dynamic = "force-dynamic";

const BASE = "/p-lane-preferences";
const t = labels.partner.lanePreference;
const c = labels.partner.common;

export default async function PartnerLanePreferencesPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const q = parseLanePreferenceQuery(params);
  const data = await listPartnerLanePreferences(q);
  const hasCondition = Boolean(q.month || q.origin || q.status || q.venue || q.area);

  return (
    <div>
      <ListQueryScope scope={`lane-preferences:${BASE}`} />
      <RememberListQuery basePath={BASE} />

      <PartnerPageHeader
        title={t.listTitle}
        description={t.listSubtitle}
        action={
          <Link
            href={`${BASE}/new`}
            className="bg-primary focus-visible:ring-primary/40 inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 sm:h-9"
          >
            {t.newSubmission}
          </Link>
        }
      />

      <FilterPanel action={BASE} sort={q.sort} errors={q.errors}>
        {/* 月はドロップダウンで簡単に選べるようにする。 */}
        <SelectField
          label={t.listFilters.month}
          name="month"
          value={q.month}
          options={monthOptions().map((m) => ({ value: m.value, label: m.label }))}
        />
        {data.originOptions.length > 1 ? (
          <SelectField
            label={t.listFilters.origin}
            name="origin"
            value={q.origin}
            options={data.originOptions.map((o) => ({ value: o.id, label: o.name }))}
          />
        ) : null}
        <SelectField
          label={t.listFilters.status}
          name="status"
          value={q.status}
          options={LANE_PREFERENCE_STATUS_VALUES.map((v) => ({ value: v, label: t.status[v] }))}
        />
        <TextField label={t.listFilters.venue} name="venue" value={q.venue} />
      </FilterPanel>

      <ResultSummary total={data.total} page={data.page} pageCount={data.pageCount} />

      {data.total === 0 ? (
        hasCondition ? (
          <NoMatch />
        ) : (
          <PartnerEmpty title={t.empty} body={t.listSubtitle} />
        )
      ) : (
        <>
          <PartnerCard className="overflow-hidden p-0">
            <PartnerTableScroll>
              <table className="w-full text-sm">
                <thead className="bg-surface-soft/50">
                  <tr className="border-hairline-light border-b">
                    <SortableTh
                      basePath={BASE}
                      params={params}
                      sort={q.sort}
                      className={P_TH}
                      field="targetMonth"
                      label={t.listColumns.targetMonth}
                    />
                    <th scope="col" className={`${P_TH} hidden sm:table-cell`}>
                      {t.listColumns.origin}
                    </th>
                    <th scope="col" className={`${P_TH} hidden sm:table-cell`}>
                      {t.listColumns.laneCount}
                    </th>
                    <SortableTh
                      basePath={BASE}
                      params={params}
                      sort={q.sort}
                      className={P_TH}
                      field="status"
                      label={t.listColumns.status}
                    />
                    <SortableTh
                      basePath={BASE}
                      params={params}
                      sort={q.sort}
                      className={P_TH}
                      field="submittedAt"
                      label={t.listColumns.submittedAt}
                    />
                  </tr>
                </thead>
                <tbody className="divide-hairline-light divide-y">
                  {data.rows.map((row) => (
                    <tr key={row.id}>
                      <td className={`${P_TD} tabular-nums`}>
                        <PartnerRowLink href={`${BASE}/${row.id}`}>
                          {row.targetMonth}
                        </PartnerRowLink>
                        {/* 狭い画面で隠れる列は行内に折り返して出す。 */}
                        <span className={P_SUB}>
                          {t.listColumns.origin}: {row.originName}
                        </span>
                        <span className={P_SUB}>
                          {t.listColumns.laneCount}: {row.laneCount ?? c.dash}
                        </span>
                      </td>
                      <td className={`${P_TD} hidden sm:table-cell`}>{row.originName}</td>
                      <td className={`${P_TD} hidden tabular-nums sm:table-cell`}>
                        {row.laneCount ?? c.dash}
                      </td>
                      <td className={P_TD}>
                        {t.status[row.status]}
                        {row.hasAnswer ? (
                          <span className="text-primary ml-1 text-xs">●</span>
                        ) : null}
                      </td>
                      <td className={`${P_TD} tabular-nums`}>
                        {formatDateTime(row.submittedAt)}
                        <span className={P_SUB}>
                          {t.listColumns.submittedBy}: {row.submittedByName ?? c.dash}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PartnerTableScroll>
          </PartnerCard>
          <Pagination basePath={BASE} params={params} page={data.page} pageCount={data.pageCount} />
        </>
      )}
    </div>
  );
}
