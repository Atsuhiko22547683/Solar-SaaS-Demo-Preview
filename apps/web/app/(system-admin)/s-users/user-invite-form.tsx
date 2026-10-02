"use client";

// 利用者の招待。既存の招待の仕組みをそのまま使う。
// 発行した招待リンクはこの画面にだけ出す（保存も監査記録もしない）。

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { labels } from "@/lib/i18n/labels";

import { inviteUserAction } from "./actions";

const t = labels.systemAdmin.user;
const c = labels.systemAdmin.common;
const FIELD = "border-ash-light text-body-light h-9 rounded-md border bg-white px-3 text-sm";

const ROLES = ["OWNER", "SYSTEM_ADMIN", "GENERAL_USER", "DEALER_ADMIN", "DEALER_STAFF"] as const;

export function UserInviteForm({ companies }: { companies: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("DEALER_STAFF");
  const [issued, setIssued] = useState<{ url: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIssued(null);
    startTransition(async () => {
      try {
        const res = await inviteUserAction({ companyId, email, role });
        setIssued({ url: res.inviteUrl, expiresAt: res.expiresAt });
        toast.success(t.inviteIssued);
        setEmail("");
        router.refresh();
      } catch (err) {
        const m = err instanceof Error && err.message ? err.message : labels.common.unknownError;
        setError(m);
        toast.error(m);
      }
    });
  }

  return (
    <>
      <p className="text-mute-light mb-3 text-[13px]">{t.inviteHint}</p>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="invite-company" className="text-mute-light block text-xs font-semibold">
            {t.columns.company}
          </label>
          <select
            id="invite-company"
            className={FIELD}
            value={companyId}
            disabled={pending}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            {companies.map((co) => (
              <option key={co.id} value={co.id}>
                {co.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[14rem] flex-1 space-y-1">
          <label htmlFor="invite-email" className="text-mute-light block text-xs font-semibold">
            {t.columns.email}
          </label>
          <input
            id="invite-email"
            type="email"
            className={`${FIELD} w-full`}
            value={email}
            disabled={pending}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="invite-role" className="text-mute-light block text-xs font-semibold">
            {t.columns.roles}
          </label>
          <select
            id="invite-role"
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
          type="submit"
          disabled={pending || email.trim().length === 0 || !companyId}
          className="bg-primary inline-flex h-9 items-center rounded-md px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? c.saving : t.invite}
        </button>
      </form>

      {issued ? (
        <div className="border-hairline-light bg-surface-soft/40 mt-3 rounded-md border p-3">
          <p className="text-ink mb-1 text-xs font-semibold">{t.inviteIssued}</p>
          <p className="text-body-light break-all text-xs">{issued.url}</p>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-danger mt-2 text-xs">
          {error}
        </p>
      ) : null}
    </>
  );
}
