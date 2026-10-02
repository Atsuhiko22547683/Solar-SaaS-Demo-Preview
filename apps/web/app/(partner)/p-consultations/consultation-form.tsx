"use client";

// 場所確保の相談フォーム。
//
// 月次の希望提出とは別物なので、入力も別に持つ。対象月は任意（月をまたぐ相談もある）。

import { useState } from "react";

import { PartnerOriginNotice } from "@/components/partner/origin-select";
import {
  FIELD_CLASS,
  PartnerFormActions,
  PartnerFormField,
  TEXTAREA_CLASS,
} from "@/components/partner/partner-form";
import { labels } from "@/lib/i18n/labels";

import { createVenueConsultationAction } from "./actions";

const t = labels.partner.consultation;
const c = labels.partner.common;

export function ConsultationForm({
  originOptions,
}: {
  /** 相談先の候補（表示のみ）。実際の相談先はサーバー側が確定する。 */
  originOptions: { id: string; name: string }[];
}) {
  const [targetMonth, setTargetMonth] = useState("");
  const [area, setArea] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      await createVenueConsultationAction({
        targetMonth,
        area,
        title,
        body,
      });
      setTitle("");
      setBody("");
      setMessage(c.sent);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t.errors.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* 相談先の代理店は表示のみ。サーバー側が取引関係から確定する。 */}
        <PartnerOriginNotice options={originOptions} />
        <PartnerFormField label={t.fields.targetMonth} htmlFor="targetMonth">
          <input
            id="targetMonth"
            type="month"
            value={targetMonth}
            onChange={(e) => setTargetMonth(e.target.value)}
            className={FIELD_CLASS}
          />
        </PartnerFormField>
        <PartnerFormField label={t.fields.area} hint={t.fields.areaHint} htmlFor="area">
          <input
            id="area"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className={FIELD_CLASS}
          />
        </PartnerFormField>
        <PartnerFormField label={t.fields.title} htmlFor="title" required>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={FIELD_CLASS}
          />
        </PartnerFormField>
      </div>
      <PartnerFormField label={t.fields.body} hint={t.fields.bodyHint} htmlFor="body" required>
        <textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          className={TEXTAREA_CLASS}
        />
      </PartnerFormField>
      <PartnerFormActions
        submitLabel={t.create}
        pending={pending}
        pendingLabel={c.saving}
        cancelHref="/p-consultations"
        cancelLabel={c.cancel}
        error={message}
      />
    </form>
  );
}
