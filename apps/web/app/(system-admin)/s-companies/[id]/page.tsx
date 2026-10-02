// ② 会社管理（詳細）。基本情報の編集・利用停止／再開・所属利用者・関連する履歴。

import Link from "next/link";
import { notFound } from "next/navigation";

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

import { CompanyDetailForms } from "./company-detail-forms";
import { getCompany } from "../data";

export const dynamic = "force-dynamic";

const t = labels.systemAdmin.company;
const c = labels.systemAdmin.common;
const u = labels.systemAdmin.user;
const at = labels.systemAdmin.audit;

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) notFound();

  return (
    <div>
      <PageHeader title={t.detailTitle} />

      <p className="mb-4">
        <Link
          href="/s-companies"
          className="text-primary text-[13px] underline-offset-4 hover:underline"
        >
          {c.backToList}
        </Link>
      </p>

      {company.status === "SUSPENDED" ? (
        <p className="border-danger/30 bg-danger/5 text-danger mb-4 rounded-md border px-3 py-2 text-sm">
          {t.suspendedNotice}
        </p>
      ) : null}

      <Panel title={t.fields.name}>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-mute-light text-xs">{t.columns.name}</dt>
            <dd className="text-ink mt-0.5 text-sm font-semibold">{company.name}</dd>
          </div>
          <div>
            <dt className="text-mute-light text-xs">{t.columns.type}</dt>
            <dd className="text-ink mt-0.5 text-sm">{t.types[company.type]}</dd>
          </div>
          <div>
            <dt className="text-mute-light text-xs">{t.columns.status}</dt>
            <dd className="mt-0.5">
              <StateBadge state={company.status} label={t.statuses[company.status]} />
            </dd>
          </div>
          <div>
            <dt className="text-mute-light text-xs">{t.columns.relation}</dt>
            <dd className="text-ink mt-0.5 text-sm">
              {company.type === "DEALER"
                ? company.relationWith
                  ? t.relationWith.replace("{name}", company.relationWith)
                  : t.relationNone
                : c.dash}
            </dd>
          </div>
          <div>
            <dt className="text-mute-light text-xs">{t.columns.contact}</dt>
            <dd className="text-ink mt-0.5 break-words text-sm">
              {company.contactEmail ?? c.dash}
            </dd>
          </div>
          <div>
            <dt className="text-mute-light text-xs">{t.columns.userCount}</dt>
            <dd className="text-ink mt-0.5 text-sm tabular-nums">{company.userCount}</dd>
          </div>
        </dl>
      </Panel>

      <CompanyDetailForms
        id={company.id}
        name={company.name}
        type={company.type}
        status={company.status}
        impact={company.impact}
      />

      <Panel title={u.title}>
        <TableCard>
          <thead>
            <tr className="border-hairline-light bg-surface-soft/50 border-b">
              <th className={TH}>{u.columns.name}</th>
              <th className={TH}>{u.columns.email}</th>
              <th className={TH}>{u.columns.status}</th>
            </tr>
          </thead>
          <tbody className="divide-hairline-light divide-y">
            {company.users.map((member) => (
              <tr key={member.id}>
                <td className={TD_STRONG}>
                  <Link
                    href={`/s-users/${member.id}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {member.name}
                  </Link>
                </td>
                <td className={TD}>{member.email}</td>
                <td className={TD}>
                  {u.statuses[member.status as keyof typeof u.statuses] ?? member.status}
                </td>
              </tr>
            ))}
          </tbody>
        </TableCard>
      </Panel>

      <Panel title={at.title}>
        {company.recentAudit.length === 0 ? (
          <p className="text-mute-light text-sm">{c.empty}</p>
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
              {company.recentAudit.map((a) => (
                <tr key={a.id}>
                  <td className={`${TD} tabular-nums`}>{formatDateTime(a.createdAt)}</td>
                  <td className={TD}>{a.actorName ?? c.dash}</td>
                  <td className={TD}>
                    {at.targetTypes[a.targetType as keyof typeof at.targetTypes] ?? a.targetType}
                  </td>
                  <td className={TD}>
                    {at.actions[a.action as keyof typeof at.actions] ?? a.action}
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
