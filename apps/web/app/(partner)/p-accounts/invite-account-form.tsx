"use client";

// 利用者の招待フォーム。
//
// 招待できるのはメールアドレスと利用区分だけ。所属二次店は操作した管理者の
// 所属で決まる（サーバー側）ので、入力欄そのものを置かない。
//
// メールは送らない（外部送信なし）。発行した招待リンクを画面に出すので、
// 管理者が本人へ渡す。リンク先は利用区分に対応するサイトになる。

import { useState } from "react";

import {
  extractFieldErrors,
  FIELD_CLASS,
  PartnerFormField,
  type FieldErrors,
} from "@/components/partner/partner-form";
import { labels } from "@/lib/i18n/labels";

import { invitePartnerAccountAction } from "./actions";

const t = labels.partner.account;

export function InviteAccountForm() {
  const [pending, setPending] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // await をまたぐと e.currentTarget は null になるので、先に掴んでおく。
    const el = e.currentTarget;
    const form = new FormData(el);
    setPending(true);
    setMessage(null);
    setFields({});
    setInviteUrl(null);
    try {
      const result = await invitePartnerAccountAction({
        email: String(form.get("email") ?? ""),
        role: String(form.get("role") ?? "DEALER_STAFF") as "DEALER_ADMIN" | "DEALER_STAFF",
      });
      setInviteUrl(result.inviteUrl);
      el.reset();
    } catch (err) {
      const parsed = extractFieldErrors(err);
      setFields(parsed.fields);
      setMessage(parsed.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PartnerFormField
          label={t.invite.email}
          htmlFor="invite-email"
          required
          error={fields["email"]}
        >
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            aria-required="true"
            className={FIELD_CLASS}
          />
        </PartnerFormField>
        <PartnerFormField label={t.invite.role} htmlFor="invite-role" error={fields["role"]}>
          <select id="invite-role" name="role" defaultValue="DEALER_STAFF" className={FIELD_CLASS}>
            <option value="DEALER_STAFF">{t.roleLabels["DEALER_STAFF"]}</option>
            <option value="DEALER_ADMIN">{t.roleLabels["DEALER_ADMIN"]}</option>
          </select>
        </PartnerFormField>
      </div>

      {message ? (
        <p role="alert" className="text-danger text-sm">
          {message}
        </p>
      ) : null}
      {inviteUrl ? (
        <div role="status" className="space-y-1">
          <p className="text-sm text-emerald-700">{t.invite.done}</p>
          <p className="text-mute-light text-[13px]">{t.invite.linkNote}</p>
          {/* リンクは表示のみ。ここからメールは送らない。 */}
          <code className="text-ink bg-surface-soft block break-all rounded-md px-3 py-2 text-xs">
            {inviteUrl}
          </code>
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary focus-visible:ring-primary/40 inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 disabled:opacity-60 sm:h-9 sm:w-auto"
        >
          {pending ? labels.partner.common.registering : t.invite.submit}
        </button>
      </div>
    </form>
  );
}
