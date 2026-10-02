// ② 会社管理（一覧）。
//
// フリーワード・区分・利用状態で絞り込み、ページ分割する。
// 追加・編集・停止は詳細画面で行う（一覧からは誤操作しやすいので置かない）。

import Link from "next/link";

import {
  EmptyRow,
  PageHeader,
  Pager,
  Panel,
  StateBadge,
  TD,
  TD_STRONG,
  TH,
  TableCard,
} from "@/components/system-admin/system-admin-ui";
import { labels } from "@/lib/i18n/labels";

import { CompanyCreateForm } from "./company-create-form";
import { listCompanies, listWholesalerOptions } from "./data";

export const dynamic = "force-dynamic";

const t = labels.systemAdmin.company;
const c = labels.systemAdmin.common;

type Params = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CompaniesPage({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const q = first(sp.q) ?? "";
  const type = first(sp.type) ?? "";
  const status = first(sp.status) ?? "";
  const page = Number(first(sp.page) ?? "1") || 1;

  const [result, wholesalers] = await Promise.all([
    listCompanies({ q, type, status, page }),
    listWholesalerOptions(),
  ]);

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    if (status) params.set("status", status);
    params.set("page", String(p));
    return `/s-companies?${params.toString()}`;
  };

  const field = "border-ash-light text-body-light h-9 rounded-md border bg-white px-3 text-sm";

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle} />

      <Panel>
        {/* 絞り込みは GET。URL を共有すれば同じ結果が出る。 */}
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <label htmlFor="q" className="text-mute-light block text-xs font-semibold">
              {c.keyword}
            </label>
            <input id="q" name="q" defaultValue={q} className={`${field} w-full`} />
          </div>
          <div className="space-y-1">
            <label htmlFor="type" className="text-mute-light block text-xs font-semibold">
              {t.columns.type}
            </label>
            <select id="type" name="type" defaultValue={type} className={field}>
              <option value="">{c.all}</option>
              <option value="WHOLESALER">{t.types.WHOLESALER}</option>
              <option value="DEALER">{t.types.DEALER}</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="status" className="text-mute-light block text-xs font-semibold">
              {t.columns.status}
            </label>
            <select id="status" name="status" defaultValue={status} className={field}>
              <option value="">{c.all}</option>
              <option value="ACTIVE">{t.statuses.ACTIVE}</option>
              <option value="SUSPENDED">{t.statuses.SUSPENDED}</option>
            </select>
          </div>
          <button
            type="submit"
            className="bg-primary inline-flex h-9 items-center rounded-md px-4 text-sm font-medium text-white"
          >
            {c.search}
          </button>
          <Link
            href="/s-companies"
            className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-9 items-center rounded-md border px-3 text-sm"
          >
            {c.clear}
          </Link>
        </form>
      </Panel>

      <Panel title={t.addAction}>
        <CompanyCreateForm wholesalers={wholesalers} />
      </Panel>

      <TableCard>
        <thead>
          <tr className="border-hairline-light bg-surface-soft/50 border-b">
            <th className={TH}>{t.columns.name}</th>
            <th className={TH}>{t.columns.type}</th>
            <th className={TH}>{t.columns.status}</th>
            <th className={TH}>{t.columns.userCount}</th>
            <th className={TH}>{t.columns.relation}</th>
            <th className={TH}>{t.columns.contact}</th>
          </tr>
        </thead>
        <tbody className="divide-hairline-light divide-y">
          {result.rows.length === 0 ? (
            <EmptyRow colSpan={6} />
          ) : (
            result.rows.map((r) => (
              <tr key={r.id} className="hover:bg-page transition-colors">
                <td className={TD_STRONG}>
                  <Link
                    href={`/s-companies/${r.id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className={TD}>{t.types[r.type]}</td>
                <td className={TD}>
                  <StateBadge state={r.status} label={t.statuses[r.status]} />
                </td>
                <td className={`${TD} tabular-nums`}>{r.userCount}</td>
                <td className={TD}>
                  {r.type === "DEALER"
                    ? r.relationWith
                      ? t.relationWith.replace("{name}", r.relationWith)
                      : t.relationNone
                    : c.dash}
                </td>
                <td className={TD}>{r.contactEmail ?? c.dash}</td>
              </tr>
            ))
          )}
        </tbody>
      </TableCard>

      <Pager page={result.page} pages={result.pages} total={result.total} hrefFor={hrefFor} />
    </div>
  );
}
