// ④ 運営者管理。運営権限の付与・解除はこの画面に集約する。

import {
  PageHeader,
  Panel,
  StateBadge,
  TD,
  TD_STRONG,
  TH,
  TableCard,
} from "@/components/system-admin/system-admin-ui";
import { labels } from "@/lib/i18n/labels";

import { listGrantCandidates, listOperatorTenants, listOperators } from "./data";
import { OperatorForms, OperatorRowActions } from "./operator-forms";

export const dynamic = "force-dynamic";

const t = labels.systemAdmin.operators;
const u = labels.systemAdmin.user;
const c = labels.systemAdmin.common;

function formatDateTime(iso: string | null): string {
  if (!iso) return u.neverLoggedIn;
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function OperatorsPage() {
  const [result, candidates, tenants] = await Promise.all([
    listOperators(),
    listGrantCandidates(),
    listOperatorTenants(),
  ]);

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle} />

      {/* 本番公開前の必須要件として、現状を明示する。 */}
      <p className="border-hairline-light bg-surface-soft/40 text-body-light mb-5 rounded-md border px-3 py-2 text-[13px]">
        {t.mfaNotice}
      </p>

      <TableCard>
        <thead>
          <tr className="border-hairline-light bg-surface-soft/50 border-b">
            <th className={TH}>{t.columns.name}</th>
            <th className={TH}>{t.columns.email}</th>
            <th className={TH}>{t.columns.status}</th>
            <th className={TH}>{t.columns.lastLoginAt}</th>
            <th className={TH}>{c.confirm}</th>
          </tr>
        </thead>
        <tbody className="divide-hairline-light divide-y">
          {result.rows.map((r) => (
            <tr key={r.id} className="hover:bg-page transition-colors">
              <td className={TD_STRONG}>{r.name}</td>
              <td className={TD}>{r.email}</td>
              <td className={TD}>
                <StateBadge
                  state={r.status}
                  label={u.statuses[r.status as keyof typeof u.statuses] ?? r.status}
                />
              </td>
              <td className={`${TD} tabular-nums`}>{formatDateTime(r.lastLoginAt)}</td>
              <td className={TD}>
                <OperatorRowActions
                  id={r.id}
                  status={r.status}
                  isEffective={r.isEffective}
                  // 有効な運営管理者が 1 人のときは、その人を無効化させない。
                  isLastEffective={r.isEffective && result.effectiveCount <= 1}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </TableCard>

      <div className="mt-5">
        <Panel title={t.grant}>
          <p className="text-mute-light mb-3 text-[13px]">{t.grantHint}</p>
          <OperatorForms candidates={candidates} tenants={tenants} />
        </Panel>
      </div>
    </div>
  );
}
