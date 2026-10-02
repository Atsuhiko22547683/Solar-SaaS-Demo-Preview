// ① ダッシュボード。
//
// 並びは 要対応事項 → 利用状況 → 稼働状態・直近の操作。
// メニューと同じ入口を並べるボタン群や営業グラフは置かない。
// 数値はその場で数え、取れないものは「未取得」と出す（0 件と決めつけない）。

import Link from "next/link";

import {
  Metric,
  PageHeader,
  Panel,
  StateBadge,
  TD,
  TD_STRONG,
  TH,
  TableCard,
} from "@/components/system-admin/system-admin-ui";
import { labels } from "@/lib/i18n/labels";
import { requireSystemAdmin } from "@/lib/system-admin/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import { listAuditLogs } from "../s-audit/data";
import { getStatus } from "../s-status/data";

export const dynamic = "force-dynamic";

const t = labels.systemAdmin.dashboard;
const c = labels.systemAdmin.common;
const st = labels.systemAdmin.status;
const at = labels.systemAdmin.audit;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function SystemAdminDashboardPage() {
  const { ctx } = await requireSystemAdmin("system_admin.access");

  const counts = await withTenant(ctx, async (tx) => {
    const [activeCompanies, suspendedCompanies, users, pendingInvitations, operators] =
      await Promise.all([
        tx.tenant.count({ where: { status: "ACTIVE" } }),
        tx.tenant.count({ where: { status: "SUSPENDED" } }),
        tx.user.count(),
        tx.userInvitation.count({ where: { acceptedAt: null, expiresAt: { gt: new Date() } } }),
        tx.user.count({ where: { roles: { some: { role: "SAAS_ADMIN" } }, status: "ACTIVE" } }),
      ]);
    return { activeCompanies, suspendedCompanies, users, pendingInvitations, operators };
  });

  const [status, recent] = await Promise.all([getStatus(), listAuditLogs({ page: 1 })]);
  const downSites = status.sites.filter((s) => s.state !== "up").length;

  // 要対応事項。該当が無ければ「ありません」と出す（作り物を並べない）。
  const attention: string[] = [];
  if (counts.suspendedCompanies > 0) {
    attention.push(
      t.attention.suspendedCompanies.replace("{n}", String(counts.suspendedCompanies)),
    );
  }
  if (counts.pendingInvitations > 0) {
    attention.push(
      t.attention.pendingInvitations.replace("{n}", String(counts.pendingInvitations)),
    );
  }
  if (downSites > 0) {
    attention.push(t.attention.siteDown.replace("{n}", String(downSites)));
  }
  // 運営者の多要素認証は本番公開の必須要件。現状は強制していないので常に出す。
  attention.push(t.attention.noOperatorMfa);

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle} />

      {/* 1. 要対応事項 */}
      <Panel title={t.sections.attention}>
        {attention.length === 0 ? (
          <p className="text-mute-light text-sm">{t.attentionNone}</p>
        ) : (
          <ul className="space-y-1.5">
            {attention.map((a) => (
              <li key={a} className="text-body-light text-sm">
                ・{a}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* 2. 利用状況 */}
      <Panel title={t.sections.usage}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            label={t.metrics.activeCompanies}
            value={counts.activeCompanies}
            unit={t.unit}
            href="/s-companies?status=ACTIVE"
          />
          <Metric
            label={t.metrics.suspendedCompanies}
            value={counts.suspendedCompanies}
            unit={t.unit}
            href="/s-companies?status=SUSPENDED"
          />
          <Metric label={t.metrics.users} value={counts.users} unit={t.unitUser} href="/s-users" />
          <Metric
            label={t.metrics.pendingInvitations}
            value={counts.pendingInvitations}
            unit={t.unitCase}
            href="/s-users?status=INVITED"
          />
        </div>
      </Panel>

      {/* 3. 稼働状態・直近の操作 */}
      <Panel
        title={t.sections.statusAndRecent}
        action={
          <Link
            href="/s-status"
            className="text-primary text-[13px] underline-offset-4 hover:underline"
          >
            {t.openStatus}
          </Link>
        }
      >
        <ul className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[...status.sites, status.db].map((row) => (
            <li
              key={row.key}
              className="border-hairline-light flex items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <span className="text-ink min-w-0 truncate text-sm">{row.name}</span>
              <StateBadge state={row.state} label={st.states[row.state]} />
            </li>
          ))}
        </ul>

        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-ink text-sm font-semibold">{t.recentTitle}</h3>
          <Link
            href="/s-audit"
            className="text-primary text-[13px] underline-offset-4 hover:underline"
          >
            {t.openAudit}
          </Link>
        </div>
        {recent.rows.length === 0 ? (
          <p className="text-mute-light text-sm">{t.recentEmpty}</p>
        ) : (
          <TableCard>
            <thead>
              <tr className="border-hairline-light bg-surface-soft/50 border-b">
                <th className={TH}>{at.columns.createdAt}</th>
                <th className={TH}>{at.columns.actor}</th>
                <th className={TH}>{at.columns.target}</th>
                <th className={TH}>{at.columns.action}</th>
              </tr>
            </thead>
            <tbody className="divide-hairline-light divide-y">
              {recent.rows.slice(0, 5).map((r) => (
                <tr key={r.id}>
                  <td className={`${TD} tabular-nums`}>{formatDateTime(r.createdAt)}</td>
                  <td className={TD}>{r.actorName ?? c.dash}</td>
                  <td className={TD_STRONG}>
                    {at.targetTypes[r.targetType as keyof typeof at.targetTypes] ?? r.targetType}
                    {r.targetLabel ? `: ${r.targetLabel}` : ""}
                  </td>
                  <td className={TD}>
                    {at.actions[r.action as keyof typeof at.actions] ?? r.action}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </Panel>
    </div>
  );
}
