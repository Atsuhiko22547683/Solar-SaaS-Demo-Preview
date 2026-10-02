"use client";

// 会社詳細の操作（基本情報の編集・利用停止／再開）。
//
// 停止はデータ削除と分ける。押す前に影響する範囲を出し、確認してから実行する。

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/system-admin/system-admin-ui";
import { labels } from "@/lib/i18n/labels";

import { setCompanyStatusAction, updateCompanyAction } from "../actions";

const t = labels.systemAdmin.company;
const c = labels.systemAdmin.common;
const FIELD = "border-ash-light text-body-light h-9 rounded-md border bg-white px-3 text-sm";

export function CompanyDetailForms({
  id,
  name,
  type,
  status,
  impact,
}: {
  id: string;
  name: string;
  type: "WHOLESALER" | "DEALER";
  status: "ACTIVE" | "SUSPENDED";
  impact: { users: number; relationships: number };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draftName, setDraftName] = useState(name);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextStatus = status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
  // 代理店本体の停止はこの初期版では扱わない。
  const canChangeStatus = !(type === "WHOLESALER" && nextStatus === "SUSPENDED");

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await updateCompanyAction({ id, name: draftName });
        toast.success(labels.partner.common.updated);
        router.refresh();
      } catch (err) {
        const m = err instanceof Error && err.message ? err.message : labels.common.unknownError;
        setError(m);
        toast.error(m);
      }
    });
  }

  function changeStatus() {
    setError(null);
    startTransition(async () => {
      try {
        await setCompanyStatusAction({ id, status: nextStatus });
        toast.success(labels.partner.common.updated);
        setConfirming(false);
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
      <Panel title={t.editTitle}>
        <form onSubmit={save} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1 space-y-1">
            <label htmlFor="company-name" className="text-mute-light block text-xs font-semibold">
              {t.fields.name}
            </label>
            <input
              id="company-name"
              className={`${FIELD} w-full`}
              value={draftName}
              disabled={pending}
              onChange={(e) => setDraftName(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={pending || draftName.trim().length === 0}
            className="bg-primary inline-flex h-9 items-center rounded-md px-4 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? c.saving : c.save}
          </button>
        </form>
      </Panel>

      <Panel title={status === "ACTIVE" ? t.suspendTitle : t.resumeTitle}>
        <p className="text-mute-light mb-3 text-[13px]">
          {status === "ACTIVE" ? t.suspendHint : t.resumeHint}
        </p>

        {status === "ACTIVE" ? (
          <div className="border-hairline-light bg-surface-soft/40 mb-3 rounded-md border p-3">
            <p className="text-ink mb-1 text-xs font-semibold">{t.impactTitle}</p>
            <ul className="text-body-light space-y-0.5 text-xs">
              <li>・{t.impactUsers.replace("{n}", String(impact.users))}</li>
              <li>・{t.impactRelationships.replace("{n}", String(impact.relationships))}</li>
              <li>・{t.impactOthers}</li>
            </ul>
          </div>
        ) : null}

        {!canChangeStatus ? (
          <p className="text-mute-light text-sm">{t.errors.cannotSuspendWholesaler}</p>
        ) : confirming ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={changeStatus}
              className="bg-danger inline-flex h-9 items-center rounded-md px-4 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? c.saving : c.confirm}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-9 items-center rounded-md border px-3 text-sm"
            >
              {c.cancel}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(true)}
            className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-9 items-center rounded-md border px-4 text-sm"
          >
            {status === "ACTIVE" ? t.suspend : t.resume}
          </button>
        )}

        {error ? (
          <p role="alert" className="text-danger mt-2 text-xs">
            {error}
          </p>
        ) : null}
      </Panel>
    </>
  );
}
