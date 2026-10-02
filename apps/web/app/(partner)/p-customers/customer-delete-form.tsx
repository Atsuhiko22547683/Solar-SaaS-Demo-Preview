"use client";

// 自社顧客の削除（二次店管理者のみ）。
//
// 元に戻せない操作なので、削除前に「一緒に消える関連データの件数」を必ず出し、
// そのうえでお客様名の入力を求める。一致確認はサーバー側で DB の値と突き合わせる
// （画面の値を信用しない）。
// 削除できない条件（契約あり / 添付ファイルあり）は、ここでは理由の表示だけで、
// 実際の判定もサーバー側でもう一度行う。

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  FIELD_CLASS,
  PartnerFormField,
  extractFieldErrors,
} from "@/components/partner/partner-form";
import { labels } from "@/lib/i18n/labels";

import { deletePartnerCustomerAction } from "./actions";

import type { PartnerCustomerDeletability, PartnerCustomerImpact } from "./data";

const t = labels.partner.customer.admin;

/** 0 件の関連データは出さない（読む量を減らす）。 */
function ImpactList({ impact }: { impact: PartnerCustomerImpact }) {
  const entries = Object.entries(impact)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => ({ key, label: t.impact[key] ?? key, n }));
  return (
    <div>
      <h3 className="text-ink text-xs font-semibold">{t.impactTitle}</h3>
      {entries.length === 0 ? (
        <p className="text-mute-light mt-1 text-[13px]">{t.impactNone}</p>
      ) : (
        <ul className="text-mute-light mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          {entries.map((e) => (
            <li key={e.key}>
              {e.label}: <span className="text-ink tabular-nums">{String(e.n)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CustomerDeleteForm({
  customerId,
  deletable,
}: {
  customerId: string;
  deletable: PartnerCustomerDeletability;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setMessage(null);
    try {
      await deletePartnerCustomerAction({
        id: customerId,
        confirmName: String(form.get("confirmName") ?? ""),
      });
      router.refresh();
      router.push("/p-customers");
    } catch (err) {
      setMessage(extractFieldErrors(err).message);
      setPending(false);
    }
  }

  if (!deletable.ok) {
    return (
      <div className="space-y-3">
        <p role="note" className="text-mute-light text-sm">
          {deletable.reason === "CONTRACT" ? t.blockedByContract : t.blockedByFile}
        </p>
        <ImpactList impact={deletable.impact} />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-mute-light text-[13px]">{t.deleteConfirm}</p>
      <ImpactList impact={deletable.impact} />
      <PartnerFormField label={t.deleteConfirmField} htmlFor="confirmName" required>
        <input
          id="confirmName"
          name="confirmName"
          required
          aria-required="true"
          className={FIELD_CLASS}
        />
      </PartnerFormField>
      {message ? (
        <p role="alert" className="text-danger text-sm">
          {message}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="bg-danger focus-visible:ring-danger/40 inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 disabled:opacity-60 sm:w-auto"
        >
          {t.delete}
        </button>
      </div>
    </form>
  );
}
