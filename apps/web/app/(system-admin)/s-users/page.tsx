// ③ 利用者管理（一覧）。フリーワード・会社・状態で絞り込み、ページ分割する。

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

import { listCompanyOptions, listUsers } from "./data";
import { UserInviteForm } from "./user-invite-form";

export const dynamic = "force-dynamic";

const t = labels.systemAdmin.user;
const c = labels.systemAdmin.common;

type Params = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function formatDateTime(iso: string | null): string {
  if (!iso) return t.neverLoggedIn;
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function UsersPage({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const q = first(sp.q) ?? "";
  const companyId = first(sp.companyId) ?? "";
  const status = first(sp.status) ?? "";
  const page = Number(first(sp.page) ?? "1") || 1;

  const [result, companies] = await Promise.all([
    listUsers({ q, companyId, status, page }),
    listCompanyOptions(),
  ]);

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (companyId) params.set("companyId", companyId);
    if (status) params.set("status", status);
    params.set("page", String(p));
    return `/s-users?${params.toString()}`;
  };

  const field = "border-ash-light text-body-light h-9 rounded-md border bg-white px-3 text-sm";

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle} />

      <Panel>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <label htmlFor="q" className="text-mute-light block text-xs font-semibold">
              {c.keyword}
            </label>
            <input id="q" name="q" defaultValue={q} className={`${field} w-full`} />
          </div>
          <div className="space-y-1">
            <label htmlFor="companyId" className="text-mute-light block text-xs font-semibold">
              {t.columns.company}
            </label>
            <select id="companyId" name="companyId" defaultValue={companyId} className={field}>
              <option value="">{c.all}</option>
              {companies.map((co) => (
                <option key={co.id} value={co.id}>
                  {co.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="status" className="text-mute-light block text-xs font-semibold">
              {t.columns.status}
            </label>
            <select id="status" name="status" defaultValue={status} className={field}>
              <option value="">{c.all}</option>
              {(["INVITED", "ACTIVE", "SUSPENDED", "LOCKED"] as const).map((s) => (
                <option key={s} value={s}>
                  {t.statuses[s]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="bg-primary inline-flex h-9 items-center rounded-md px-4 text-sm font-medium text-white"
          >
            {c.search}
          </button>
          <Link
            href="/s-users"
            className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-9 items-center rounded-md border px-3 text-sm"
          >
            {c.clear}
          </Link>
        </form>
      </Panel>

      <Panel title={t.inviteTitle}>
        <UserInviteForm companies={companies} />
      </Panel>

      <TableCard>
        <thead>
          <tr className="border-hairline-light bg-surface-soft/50 border-b">
            <th className={TH}>{t.columns.name}</th>
            <th className={TH}>{t.columns.email}</th>
            <th className={TH}>{t.columns.company}</th>
            <th className={TH}>{t.columns.sites}</th>
            <th className={TH}>{t.columns.status}</th>
            <th className={TH}>{t.columns.lastLoginAt}</th>
            <th className={TH}>{t.columns.salesperson}</th>
          </tr>
        </thead>
        <tbody className="divide-hairline-light divide-y">
          {result.rows.length === 0 ? (
            <EmptyRow colSpan={7} />
          ) : (
            result.rows.map((r) => (
              <tr key={r.id} className="hover:bg-page transition-colors">
                <td className={TD_STRONG}>
                  <Link
                    href={`/s-users/${r.id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className={TD}>{r.email}</td>
                <td className={TD}>{r.companyName}</td>
                <td className={TD}>
                  {r.sites.length === 0
                    ? c.dash
                    : r.sites.map((s) => t.sites[s as keyof typeof t.sites]).join(" / ")}
                </td>
                <td className={TD}>
                  <StateBadge
                    state={r.status}
                    label={t.statuses[r.status as keyof typeof t.statuses] ?? r.status}
                  />
                </td>
                <td className={`${TD} tabular-nums`}>{formatDateTime(r.lastLoginAt)}</td>
                <td className={TD}>
                  {r.salespersonName
                    ? t.linkedYes.replace("{name}", r.salespersonName)
                    : t.linkedNo}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableCard>

      <Pager page={result.page} pages={result.pages} total={result.total} hrefFor={hrefFor} />
    </div>
  );
}
