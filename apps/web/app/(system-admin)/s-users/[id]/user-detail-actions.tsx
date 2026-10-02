"use client";

// 利用者詳細の操作（停止・再開 / 利用区分変更 / セッション失効 / パスワード再設定案内）。
//
// パスワードそのものは扱わない。所属会社の異動は用意しない。
// 運営権限（SAAS_ADMIN）の付与・解除はここには置かない（運営者管理に集約）。

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/system-admin/system-admin-ui";
import { labels } from "@/lib/i18n/labels";

import {
  issuePasswordResetAction,
  revokeUserSessionsAction,
  setUserRoleAction,
  setUserStatusAction,
} from "../actions";

const t = labels.systemAdmin.user;
const c = labels.systemAdmin.common;
const FIELD = "border-ash-light text-body-light h-9 rounded-md border bg-white px-3 text-sm";
const BTN =
  "border-hairline-light text-ink hover:bg-surface-soft inline-flex h-9 items-center rounded-md border px-4 text-sm disabled:opacity-60";

const ROLES = ["OWNER", "SYSTEM_ADMIN", "GENERAL_USER", "DEALER_ADMIN", "DEALER_STAFF"] as const;

export function UserDetailActions({
  id,
  status,
  roles,
}: {
  id: string;
  status: string;
  roles: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState<(typeof ROLES)[number]>(
    (ROLES.find((r) => roles.includes(r)) ?? "DEALER_STAFF") as (typeof ROLES)[number],
  );
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>, okMessage: string) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        toast.success(okMessage);
        router.refresh();
      } catch (err) {
        const m = err instanceof Error && err.message ? err.message : labels.common.unknownError;
        setError(m);
        toast.error(m);
      }
    });
  }

  const nextStatus = status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

  return (
    <Panel title={c.confirm}>
      <div className="space-y-4">
        {/* 利用停止・再開 */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            className={BTN}
            onClick={() =>
              run(
                () => setUserStatusAction({ id, status: nextStatus }),
                labels.partner.common.updated,
              )
            }
          >
            {status === "ACTIVE" ? t.suspend : t.resume}
          </button>

          {/* セッション失効 */}
          <button
            type="button"
            disabled={pending}
            className={BTN}
            onClick={() =>
              run(() => revokeUserSessionsAction({ id }), labels.partner.common.updated)
            }
          >
            {t.revokeSessions}
          </button>

          {/* パスワード再設定の案内（パスワードは表示しない） */}
          <button
            type="button"
            disabled={pending}
            className={BTN}
            onClick={() => run(() => issuePasswordResetAction({ id }), t.resetIssued)}
          >
            {t.sendReset}
          </button>
        </div>
        <p className="text-mute-light text-xs">
          {t.revokeHint} {t.resetHint}
        </p>

        {/* 利用区分の変更 */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="user-role" className="text-mute-light block text-xs font-semibold">
              {t.columns.roles}
            </label>
            <select
              id="user-role"
              className={FIELD}
              value={role}
              disabled={pending}
              onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={pending}
            className={BTN}
            onClick={() =>
              run(() => setUserRoleAction({ id, role }), labels.partner.common.updated)
            }
          >
            {t.changeRole}
          </button>
        </div>

        {error ? (
          <p role="alert" className="text-danger text-xs">
            {error}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
