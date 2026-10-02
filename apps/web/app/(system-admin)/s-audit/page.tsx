// ⑤ 操作履歴。期間 / 操作者 / 対象会社 / 操作種別で絞り込み、ページ分割する。
// 読み取り専用（編集・削除の操作は用意しない）。

import Link from "next/link";

import {
  EmptyRow,
  PageHeader,
  Pager,
  Panel,
  TD,
  TD_STRONG,
  TH,
  TableCard,
} from "@/components/system-admin/system-admin-ui";
import { labels } from "@/lib/i18n/labels";

import { listAuditActors, listAuditLogs } from "./data";
import { listCompanyOptions } from "../s-users/data";

export const dynamic = "force-dynamic";

const t = labels.systemAdmin.audit;
const c = labels.systemAdmin.common;

type Params = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const ACTIONS = ["CREATE", "UPDATE", "STATUS_CHANGE", "ROLE_CHANGE", "DELETE"] as const;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return c.notSet;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default async function AuditPage({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const from = first(sp.from) ?? "";
  const to = first(sp.to) ?? "";
  const actorId = first(sp.actorId) ?? "";
  const companyId = first(sp.companyId) ?? "";
  const action = first(sp.action) ?? "";
  const page = Number(first(sp.page) ?? "1") || 1;

  const [result, actors, companies] = await Promise.all([
    listAuditLogs({ from, to, actorId, companyId, action, page }),
    listAuditActors(),
    listCompanyOptions(),
  ]);

  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ from, to, actorId, companyId, action })) {
      if (v) params.set(k, v);
    }
    params.set("page", String(p));
    return `/s-audit?${params.toString()}`;
  };

  const field = "border-ash-light text-body-light h-9 rounded-md border bg-white px-3 text-sm";

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle} />

      <Panel>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="from" className="text-mute-light block text-xs font-semibold">
              {t.filters.from}
            </label>
            <input id="from" name="from" type="date" defaultValue={from} className={field} />
          </div>
          <div className="space-y-1">
            <label htmlFor="to" className="text-mute-light block text-xs font-semibold">
              {t.filters.to}
            </label>
            <input id="to" name="to" type="date" defaultValue={to} className={field} />
          </div>
          <div className="space-y-1">
            <label htmlFor="actorId" className="text-mute-light block text-xs font-semibold">
              {t.filters.actor}
            </label>
            <select id="actorId" name="actorId" defaultValue={actorId} className={field}>
              <option value="">{c.all}</option>
              {actors.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="companyId" className="text-mute-light block text-xs font-semibold">
              {t.filters.company}
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
            <label htmlFor="action" className="text-mute-light block text-xs font-semibold">
              {t.filters.action}
            </label>
            <select id="action" name="action" defaultValue={action} className={field}>
              <option value="">{c.all}</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {t.actions[a]}
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
            href="/s-audit"
            className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-9 items-center rounded-md border px-3 text-sm"
          >
            {c.clear}
          </Link>
        </form>
      </Panel>

      <p className="text-mute-light mb-2 text-xs">{t.readOnlyNotice}</p>

      <TableCard>
        <thead>
          <tr className="border-hairline-light bg-surface-soft/50 border-b">
            <th className={TH}>{t.columns.createdAt}</th>
            <th className={TH}>{t.columns.actor}</th>
            <th className={TH}>{t.columns.target}</th>
            <th className={TH}>{t.columns.action}</th>
            <th className={TH}>{t.columns.changes}</th>
            <th className={TH}>{t.columns.result}</th>
          </tr>
        </thead>
        <tbody className="divide-hairline-light divide-y">
          {result.rows.length === 0 ? (
            <EmptyRow colSpan={6} />
          ) : (
            result.rows.map((r) => (
              <tr key={r.id}>
                <td className={`${TD} tabular-nums`}>{formatDateTime(r.createdAt)}</td>
                <td className={TD}>{r.actorName ?? c.dash}</td>
                <td className={TD_STRONG}>
                  {t.targetTypes[r.targetType as keyof typeof t.targetTypes] ?? r.targetType}
                  {r.targetLabel ? `: ${r.targetLabel}` : ""}
                  {r.companyName ? (
                    <span className="text-mute-light ml-1 text-xs">（{r.companyName}）</span>
                  ) : null}
                </td>
                <td className={TD}>{t.actions[r.action as keyof typeof t.actions] ?? r.action}</td>
                <td className="text-body-light px-3 py-2.5 text-xs">
                  {r.changes.length === 0 ? (
                    t.noChanges
                  ) : (
                    <ul className="space-y-0.5">
                      {r.changes.map((ch) => (
                        <li key={ch.field}>
                          {ch.field}: {renderValue(ch.before)} → {renderValue(ch.after)}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                {/* 記録は成功した更新だけ（失敗時はトランザクションごと戻る）。 */}
                <td className={TD}>{t.resultOk}</td>
              </tr>
            ))
          )}
        </tbody>
      </TableCard>

      <Pager page={result.page} pages={result.pages} total={result.total} hrefFor={hrefFor} />
    </div>
  );
}
