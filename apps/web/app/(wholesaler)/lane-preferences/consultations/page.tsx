// 代理店側：パートナー会社からの場所確保の相談一覧。
//
// 月次の希望提出（/lane-preferences）とは別建て。相談 1 件ごとにスレッドがある。

import Link from "next/link";

import { labels } from "@/lib/i18n/labels";
import { oneOf, text } from "@/lib/partner/list-query";

import { listAgencyConsultations } from "../answer-data";

import type { RawParams } from "@/lib/partner/list-query";

export const dynamic = "force-dynamic";

const t = labels.partner.consultation;
const c = labels.partner.common;
const STATUS_VALUES = ["OPEN", "ANSWERED", "CLOSED"] as const;

export default async function AgencyConsultationsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const status = oneOf(params, "status", STATUS_VALUES);
  const keyword = text(params, "keyword");
  const rows = await listAgencyConsultations({ status, keyword });

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <h1 className="text-xl font-bold">{t.title}</h1>

      <form method="GET" className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label htmlFor="keyword" className="text-muted-foreground block text-xs font-medium">
            {t.filters.keyword}
          </label>
          <input
            id="keyword"
            name="keyword"
            defaultValue={keyword ?? ""}
            className="h-9 rounded-md border px-3 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="status" className="text-muted-foreground block text-xs font-medium">
            {t.filters.status}
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? ""}
            className="h-9 rounded-md border px-3 text-sm"
          >
            <option value="">{labels.partner.list.all}</option>
            {STATUS_VALUES.map((v) => (
              <option key={v} value={v}>
                {t.status[v]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="h-9 rounded-md border px-3 text-sm">
          {labels.partner.list.apply}
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t.empty}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((row) => (
            <li key={row.id} className="p-3">
              <Link
                href={`/lane-preferences/consultations/${row.id}`}
                className="text-primary text-sm font-medium underline-offset-4 hover:underline"
              >
                {row.title}
              </Link>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {row.dealerName} / {t.columns.area}: {row.area ?? c.dash} / {t.columns.targetMonth}:{" "}
                {row.targetMonth ?? c.dash} / {t.status[row.status]}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
