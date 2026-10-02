// ③ 利用者管理（詳細）。所属・利用可能サイト・関連する履歴と、運営者の操作。

import Link from "next/link";
import { notFound } from "next/navigation";

import {
  PageHeader,
  Panel,
  StateBadge,
  TD,
  TH,
  TableCard,
} from "@/components/system-admin/system-admin-ui";
import { labels } from "@/lib/i18n/labels";

import { UserDetailActions } from "./user-detail-actions";
import { getUser } from "../data";

export const dynamic = "force-dynamic";

const t = labels.systemAdmin.user;
const c = labels.systemAdmin.common;
const at = labels.systemAdmin.audit;

function formatDateTime(iso: string | null): string {
  if (!iso) return t.neverLoggedIn;
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser(id);
  if (!user) notFound();

  return (
    <div>
      <PageHeader title={t.detailTitle} />

      <p className="mb-4">
        <Link
          href="/s-users"
          className="text-primary text-[13px] underline-offset-4 hover:underline"
        >
          {c.backToList}
        </Link>
      </p>

      <Panel>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-mute-light text-xs">{t.columns.name}</dt>
            <dd className="text-ink mt-0.5 text-sm font-semibold">{user.name}</dd>
          </div>
          <div>
            <dt className="text-mute-light text-xs">{t.columns.email}</dt>
            <dd className="text-ink mt-0.5 break-words text-sm">{user.email}</dd>
          </div>
          <div>
            <dt className="text-mute-light text-xs">{t.columns.company}</dt>
            <dd className="text-ink mt-0.5 text-sm">
              <Link
                href={`/s-companies/${user.companyId}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {user.companyName}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-mute-light text-xs">{t.columns.roles}</dt>
            <dd className="text-ink mt-0.5 text-sm">{user.roles.join(" / ") || c.dash}</dd>
          </div>
          <div>
            <dt className="text-mute-light text-xs">{t.columns.sites}</dt>
            <dd className="text-ink mt-0.5 text-sm">
              {user.sites.length === 0
                ? c.dash
                : user.sites.map((s) => t.sites[s as keyof typeof t.sites]).join(" / ")}
            </dd>
          </div>
          <div>
            <dt className="text-mute-light text-xs">{t.columns.status}</dt>
            <dd className="mt-0.5">
              <StateBadge
                state={user.status}
                label={t.statuses[user.status as keyof typeof t.statuses] ?? user.status}
              />
            </dd>
          </div>
          <div>
            <dt className="text-mute-light text-xs">{t.columns.lastLoginAt}</dt>
            <dd className="text-ink mt-0.5 text-sm tabular-nums">
              {formatDateTime(user.lastLoginAt)}
            </dd>
          </div>
          <div>
            <dt className="text-mute-light text-xs">{t.columns.salesperson}</dt>
            <dd className="text-ink mt-0.5 text-sm">
              {user.salespersonName
                ? t.linkedYes.replace("{name}", user.salespersonName)
                : t.linkedNo}
            </dd>
          </div>
        </dl>
      </Panel>

      <UserDetailActions id={user.id} status={user.status} roles={user.roles} />

      <Panel title={t.relatedAudit}>
        {user.recentAudit.length === 0 ? (
          <p className="text-mute-light text-sm">{c.empty}</p>
        ) : (
          <TableCard>
            <thead>
              <tr className="border-hairline-light bg-surface-soft/50 border-b">
                <th className={TH}>{at.columns.createdAt}</th>
                <th className={TH}>{at.columns.actor}</th>
                <th className={TH}>{at.columns.action}</th>
              </tr>
            </thead>
            <tbody className="divide-hairline-light divide-y">
              {user.recentAudit.map((a) => (
                <tr key={a.id}>
                  <td className={`${TD} tabular-nums`}>{formatDateTime(a.createdAt)}</td>
                  <td className={TD}>{a.actorName ?? c.dash}</td>
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
