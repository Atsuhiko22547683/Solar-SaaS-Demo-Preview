"use client";

// 運営者管理の操作。
//
// 最後の有効な運営管理者を失う操作は、画面でも押せないようにしたうえで
// サーバー側でも拒否する（Server Action へ直接送られても止まる）。

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { labels } from "@/lib/i18n/labels";

import {
  grantOperatorAction,
  inviteOperatorAction,
  revokeOperatorAction,
  setOperatorStatusAction,
} from "./actions";

const t = labels.systemAdmin.operators;
const c = labels.systemAdmin.common;
const u = labels.systemAdmin.user;
const FIELD = "border-ash-light text-body-light h-9 rounded-md border bg-white px-3 text-sm";
const BTN =
  "border-hairline-light text-ink hover:bg-surface-soft inline-flex h-9 items-center rounded-md border px-3 text-sm disabled:opacity-60";

function useRunner() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>, ok: string) => {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        toast.success(ok);
        router.refresh();
      } catch (err) {
        const m = err instanceof Error && err.message ? err.message : labels.common.unknownError;
        setError(m);
        toast.error(m);
      }
    });
  };
  return { pending, error, run };
}

/** 一覧の行ごとの操作（停止・再開 / 権限解除）。 */
export function OperatorRowActions({
  id,
  status,
  isEffective,
  isLastEffective,
}: {
  id: string;
  status: string;
  isEffective: boolean;
  isLastEffective: boolean;
}) {
  const { pending, error, run } = useRunner();
  const nextStatus = status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
  // 最後の 1 人を止める・権限を外す操作は押せないようにする。
  const blocked = isLastEffective;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || (blocked && nextStatus === "SUSPENDED")}
          className={BTN}
          onClick={() =>
            run(
              () => setOperatorStatusAction({ id, status: nextStatus }),
              labels.partner.common.updated,
            )
          }
        >
          {status === "ACTIVE" ? t.suspend : t.resume}
        </button>
        <button
          type="button"
          disabled={pending || blocked}
          className={BTN}
          onClick={() => run(() => revokeOperatorAction({ id }), labels.partner.common.updated)}
        >
          {t.revoke}
        </button>
      </div>
      {blocked ? <p className="text-mute-light text-[11px]">{t.lastOperatorNotice}</p> : null}
      {!isEffective ? <p className="text-mute-light text-[11px]">{u.statuses.SUSPENDED}</p> : null}
      {error ? (
        <p role="alert" className="text-danger text-[11px]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** 権限の付与と、運営者の招待。 */
export function OperatorForms({
  candidates,
  tenants,
}: {
  candidates: { id: string; name: string; email: string; companyName: string }[];
  tenants: { id: string; name: string }[];
}) {
  const { pending, error, run } = useRunner();
  const [userId, setUserId] = useState(candidates[0]?.id ?? "");
  const [tenantId, setTenantId] = useState(tenants[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [issued, setIssued] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* 既存の利用者に権限を付与する */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1 space-y-1">
          <label htmlFor="grant-user" className="text-mute-light block text-xs font-semibold">
            {u.title}
          </label>
          <select
            id="grant-user"
            className={`${FIELD} w-full`}
            value={userId}
            disabled={pending || candidates.length === 0}
            onChange={(e) => setUserId(e.target.value)}
          >
            {candidates.length === 0 ? <option value="">{c.empty}</option> : null}
            {candidates.map((u2) => (
              <option key={u2.id} value={u2.id}>
                {u2.name}（{u2.email} / {u2.companyName}）
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={pending || !userId}
          className="bg-primary inline-flex h-9 items-center rounded-md px-4 text-sm font-medium text-white disabled:opacity-60"
          onClick={() =>
            run(() => grantOperatorAction({ id: userId }), labels.partner.common.updated)
          }
        >
          {t.grant}
        </button>
      </div>

      {/* 新しい運営者を招待する */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="op-tenant" className="text-mute-light block text-xs font-semibold">
            {u.columns.company}
          </label>
          <select
            id="op-tenant"
            className={FIELD}
            value={tenantId}
            disabled={pending}
            onChange={(e) => setTenantId(e.target.value)}
          >
            {tenants.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[14rem] flex-1 space-y-1">
          <label htmlFor="op-email" className="text-mute-light block text-xs font-semibold">
            {u.columns.email}
          </label>
          <input
            id="op-email"
            type="email"
            className={`${FIELD} w-full`}
            value={email}
            disabled={pending}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button
          type="button"
          disabled={pending || email.trim().length === 0 || !tenantId}
          className={BTN}
          onClick={() =>
            run(async () => {
              const res = await inviteOperatorAction({ tenantId, email });
              setIssued(res.inviteUrl);
              setEmail("");
            }, u.inviteIssued)
          }
        >
          {t.invite}
        </button>
      </div>

      {issued ? (
        <div className="border-hairline-light bg-surface-soft/40 rounded-md border p-3">
          <p className="text-ink mb-1 text-xs font-semibold">{u.inviteIssued}</p>
          <p className="text-body-light break-all text-xs">{issued}</p>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
