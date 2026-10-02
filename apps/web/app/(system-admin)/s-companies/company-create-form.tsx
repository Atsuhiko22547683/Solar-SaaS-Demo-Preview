"use client";

// パートナー会社の追加。代理店との取引関係も同時に作る。
// 追加できるのはパートナー会社だけ（代理店の新設はこの初期版では扱わない）。

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { labels } from "@/lib/i18n/labels";

import { createPartnerCompanyAction } from "./actions";

const t = labels.systemAdmin.company;
const c = labels.systemAdmin.common;
const FIELD = "border-ash-light text-body-light h-9 rounded-md border bg-white px-3 text-sm";

export function CompanyCreateForm({
  wholesalers,
}: {
  wholesalers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [wholesalerId, setWholesalerId] = useState(wholesalers[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createPartnerCompanyAction({ name, wholesalerId });
        toast.success(labels.partner.common.created);
        setName("");
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error && err.message ? err.message : labels.common.unknownError;
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[12rem] flex-1 space-y-1">
        <label htmlFor="new-company-name" className="text-mute-light block text-xs font-semibold">
          {t.fields.name}
        </label>
        <input
          id="new-company-name"
          className={`${FIELD} w-full`}
          value={name}
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label
          htmlFor="new-company-wholesaler"
          className="text-mute-light block text-xs font-semibold"
        >
          {t.columns.relation}
        </label>
        <select
          id="new-company-wholesaler"
          className={FIELD}
          value={wholesalerId}
          disabled={pending}
          onChange={(e) => setWholesalerId(e.target.value)}
        >
          {wholesalers.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending || name.trim().length === 0 || !wholesalerId}
        className="bg-primary inline-flex h-9 items-center rounded-md px-4 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? c.saving : t.addAction}
      </button>
      {error ? (
        <p role="alert" className="text-danger w-full text-xs">
          {error}
        </p>
      ) : null}
    </form>
  );
}
