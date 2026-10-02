"use client";

// 利用者アカウントの設定フォーム（利用区分 / 利用状況 / 販売員との紐付け）。
//
// 変えられない組み合わせは入力欄を無効にして理由を出すが、判定の正はサーバー側。
// 無効化を外して送っても Server Action が同じ条件で弾く。

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  extractFieldErrors,
  FIELD_CLASS,
  PartnerFormActions,
  PartnerFormField,
  type FieldErrors,
} from "@/components/partner/partner-form";
import { labels } from "@/lib/i18n/labels";

import { updatePartnerAccountAction } from "./actions";

import type { PartnerAccountDetail } from "./data";

const t = labels.partner.account;
const c = labels.partner.common;

export function AccountForm({ account }: { account: PartnerAccountDetail }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});

  // 自分自身の区分・状態は変えられない。最後の管理者も降格・停止できない。
  const lockedSelf = account.isSelf;
  const lockedLastAdmin = account.role === "DEALER_ADMIN" && !account.hasOtherActiveAdmin;
  const locked = lockedSelf || lockedLastAdmin;
  const lockReason = lockedSelf ? t.guards.self : lockedLastAdmin ? t.guards.lastAdmin : undefined;
  // 招待済み（未ログイン）は利用状況を触らせない。ここで ACTIVE にしても
  // パスワード未設定でサインインできず、状態だけがずれる。
  const invited = account.status === "INVITED";
  const statusLocked = locked || invited;
  const statusHint = invited ? t.guards.invited : lockReason;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setMessage(null);
    setFields({});
    try {
      const salespersonId = String(form.get("salespersonId") ?? "");
      await updatePartnerAccountAction({
        id: account.id,
        // 変更できない項目は送らない（サーバー側でも同じ条件で弾く）。
        ...(locked
          ? {}
          : { role: String(form.get("role") ?? "") as "DEALER_ADMIN" | "DEALER_STAFF" }),
        ...(statusLocked
          ? {}
          : { status: String(form.get("status") ?? "") as "ACTIVE" | "SUSPENDED" }),
        salespersonId: salespersonId === "" ? null : salespersonId,
      });
      router.refresh();
      router.push("/p-accounts");
    } catch (err) {
      const parsed = extractFieldErrors(err);
      setFields(parsed.fields);
      setMessage(parsed.message);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PartnerFormField
          label={t.columns.role}
          htmlFor="role"
          hint={lockReason}
          error={fields["role"]}
        >
          <select
            id="role"
            name="role"
            defaultValue={account.role}
            disabled={locked}
            className={`${FIELD_CLASS} disabled:bg-surface-soft disabled:text-mute-light`}
          >
            <option value="DEALER_STAFF">{t.roleLabels["DEALER_STAFF"]}</option>
            <option value="DEALER_ADMIN">{t.roleLabels["DEALER_ADMIN"]}</option>
          </select>
        </PartnerFormField>

        <PartnerFormField
          label={t.columns.status}
          htmlFor="status"
          hint={statusHint}
          error={fields["status"]}
        >
          <select
            id="status"
            name="status"
            defaultValue={account.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE"}
            disabled={statusLocked}
            className={`${FIELD_CLASS} disabled:bg-surface-soft disabled:text-mute-light`}
          >
            <option value="ACTIVE">{t.actions.activate}</option>
            <option value="SUSPENDED">{t.actions.suspend}</option>
          </select>
        </PartnerFormField>

        <PartnerFormField
          label={t.actions.salespersonSelect}
          htmlFor="salespersonId"
          hint={t.linkNote}
          error={fields["salespersonId"]}
        >
          <select
            id="salespersonId"
            name="salespersonId"
            defaultValue={account.salespersonId ?? ""}
            className={FIELD_CLASS}
          >
            <option value="">{t.actions.salespersonNone}</option>
            {account.salespersonOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </PartnerFormField>
      </div>

      <PartnerFormActions
        submitLabel={c.save}
        pending={pending}
        pendingLabel={c.saving}
        cancelHref="/p-accounts"
        cancelLabel={c.cancel}
        error={message}
      />
    </form>
  );
}
