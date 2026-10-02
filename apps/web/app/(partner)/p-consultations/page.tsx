// 場所確保の相談の一覧（パートナー管理者のみ）。
//
// 検索はエリア・件名/内容のフリーテキスト・対象月・状態。
// 月はドロップダウンで選ぶ 1 値で、希望日程の入力とは別物。

import Link from "next/link";

import { FilterPanel, SelectField, TextField } from "@/components/partner/list-filter";
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
import { first, oneOf, text } from "@/lib/partner/list-query";

import { listPartnerConsultations } from "./data";

import type { RawParams } from "@/lib/partner/list-query";

export const dynamic = "force-dynamic";

const BASE = "/p-consultations";
const t = labels.partner.consultation;
const c = labels.partner.common;

const STATUS_VALUES = ["OPEN", "ANSWERED", "CLOSED"] as const;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export default async function PartnerConsultationsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const rawMonth = first(params, "month");
  const q = {
    status: oneOf(params, "status", STATUS_VALUES),
    keyword: text(params, "keyword"),
    month: rawMonth && MONTH_RE.test(rawMonth) ? rawMonth : undefined,
    origin: text(params, "origin", 64),
  };
  const data = await listPartnerConsultations(q);
  const hasCondition = Boolean(q.status || q.keyword || q.month || q.origin);

  return (
    <div>
      <PartnerPageHeader
        title={t.title}
        description={t.subtitle}
        action={
          <Link
            href={`${BASE}/new`}
            className="bg-primary focus-visible:ring-primary/40 inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 sm:h-9"
          >
            {t.create}
          </Link>
        }
      />

      <FilterPanel action={BASE} sort={{ field: "createdAt", direction: "desc" }} errors={[]}>
        <TextField label={t.filters.keyword} name="keyword" value={q.keyword} />
        <TextField label={t.filters.area} name="area" value={undefined} />
        <SelectField
          label={t.filters.status}
          name="status"
          value={q.status}
          options={STATUS_VALUES.map((v) => ({ value: v, label: t.status[v] }))}
        />
        {data.originOptions.length > 1 ? (
          <SelectField
            label={t.columns.origin}
            name="origin"
            value={q.origin}
            options={data.originOptions.map((o) => ({ value: o.id, label: o.name }))}
          />
        ) : null}
      </FilterPanel>

      {data.rows.length === 0 ? (
        <PartnerEmpty title={hasCondition ? t.noMatch : t.empty} body={t.subtitle} />
      ) : (
        <PartnerCard className="overflow-hidden p-0">
          <PartnerTableScroll>
            <table className="w-full text-sm">
              <thead className="bg-surface-soft/50">
                <tr className="border-hairline-light border-b">
                  <th scope="col" className={P_TH}>
                    {t.columns.title}
                  </th>
                  <th scope="col" className={`${P_TH} hidden sm:table-cell`}>
                    {t.columns.area}
                  </th>
                  <th scope="col" className={`${P_TH} hidden sm:table-cell`}>
                    {t.columns.origin}
                  </th>
                  <th scope="col" className={P_TH}>
                    {t.columns.status}
                  </th>
                  <th scope="col" className={P_TH}>
                    {t.columns.createdAt}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-hairline-light divide-y">
                {data.rows.map((row) => (
                  <tr key={row.id}>
                    <td className={P_TD}>
                      <PartnerRowLink href={`${BASE}/${row.id}`}>{row.title}</PartnerRowLink>
                      <span className={P_SUB}>
                        {t.columns.area}: {row.area ?? c.dash}
                      </span>
                      <span className={P_SUB}>
                        {t.columns.origin}: {row.originName}
                      </span>
                    </td>
                    <td className={`${P_TD} hidden sm:table-cell`}>{row.area ?? c.dash}</td>
                    <td className={`${P_TD} hidden sm:table-cell`}>{row.originName}</td>
                    <td className={P_TD}>{t.status[row.status]}</td>
                    <td className={`${P_TD} tabular-nums`}>{formatDateTime(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PartnerTableScroll>
        </PartnerCard>
      )}
    </div>
  );
}
