// ⑥ 稼働状況。既存の /api/health をその場で叩いて出す。監視基盤は新設しない。
// 取得できない情報は「未取得」、設定が無いものは「未連携」と出す。

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

import { getStatus, type StatusRow } from "./data";

export const dynamic = "force-dynamic";

const t = labels.systemAdmin.status;
const c = labels.systemAdmin.common;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function StatusTable({ rows }: { rows: StatusRow[] }) {
  return (
    <TableCard>
      <thead>
        <tr className="border-hairline-light bg-surface-soft/50 border-b">
          <th className={TH}>{t.columns.name}</th>
          <th className={TH}>{t.columns.state}</th>
          <th className={TH}>{t.columns.detail}</th>
        </tr>
      </thead>
      <tbody className="divide-hairline-light divide-y">
        {rows.map((r) => (
          <tr key={r.key}>
            <td className={TD_STRONG}>{r.name}</td>
            <td className={TD}>
              <StateBadge state={r.state} label={t.states[r.state]} />
            </td>
            <td className="text-body-light break-words px-3 py-2.5 text-xs">
              {r.detail ?? c.dash}
            </td>
          </tr>
        ))}
      </tbody>
    </TableCard>
  );
}

export default async function StatusPage() {
  const status = await getStatus();

  return (
    <div>
      <PageHeader title={t.title} description={t.subtitle} />

      <p className="text-mute-light mb-4 text-[13px]">
        {t.checkedAt}: <span className="tabular-nums">{formatDateTime(status.checkedAt)}</span>
        {" ／ "}
        {t.noMonitoring}
      </p>

      <Panel title={t.sitesTitle}>
        <StatusTable rows={status.sites} />
      </Panel>

      <Panel title={t.dbTitle}>
        <StatusTable rows={[status.db]} />
      </Panel>

      <Panel title={t.integrationsTitle}>
        <StatusTable rows={status.integrations} />
      </Panel>
    </div>
  );
}
