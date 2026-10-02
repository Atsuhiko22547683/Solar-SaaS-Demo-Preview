"use client";

// 自社顧客の基本情報の編集フォーム（二次店管理者のみ）。
//
// 扱うのは連絡先・住所・担当販売員・ステータス・備考だけ。契約・施工・補助金など
// 代理店側の業務項目は入力欄そのものを置かない（Zod も `.strict()` で受け付けない）。

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  extractFieldErrors,
  FIELD_CLASS,
  PartnerFormActions,
  PartnerFormField,
  TEXTAREA_CLASS,
  type FieldErrors,
} from "@/components/partner/partner-form";
import { labels } from "@/lib/i18n/labels";

import { updatePartnerCustomerAction } from "./actions";
import { CUSTOMER_STATUS_VALUES } from "./query";

import type { PartnerCustomerEditData } from "./data";

const t = labels.partner.customer;
const c = labels.partner.common;

/** 空文字は null として送る（空の文字列を保存しない）。 */
function orNull(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : null;
}

export function CustomerForm({ data }: { data: PartnerCustomerEditData }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setMessage(null);
    setFields({});
    try {
      await updatePartnerCustomerAction({
        id: data.id,
        name: String(form.get("name") ?? ""),
        kana: orNull(form.get("kana")),
        phone: String(form.get("phone") ?? ""),
        landlinePhone: orNull(form.get("landlinePhone")),
        mobilePhone: orNull(form.get("mobilePhone")),
        postalCode: orNull(form.get("postalCode")),
        prefecture: orNull(form.get("prefecture")),
        city: orNull(form.get("city")),
        addressLine: orNull(form.get("addressLine")),
        status: String(form.get("status") ?? "NEW") as (typeof CUSTOMER_STATUS_VALUES)[number],
        tossUpSalespersonId: orNull(form.get("tossUpSalespersonId")),
        closingSalespersonId: orNull(form.get("closingSalespersonId")),
        note: orNull(form.get("note")),
      });
      router.refresh();
      router.push(`/p-customers/${data.id}`);
    } catch (err) {
      const parsed = extractFieldErrors(err);
      setFields(parsed.fields);
      setMessage(parsed.message);
      setPending(false);
    }
  }

  const text = (name: keyof PartnerCustomerEditData, label: string, required = false) => (
    <PartnerFormField label={label} htmlFor={name} required={required} error={fields[name]}>
      <input
        id={name}
        name={name}
        defaultValue={(data[name] as string | null) ?? ""}
        required={required}
        aria-required={required ? "true" : undefined}
        className={FIELD_CLASS}
      />
    </PartnerFormField>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-mute-light text-[13px]">{t.admin.editHint}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {text("name", t.fields.name, true)}
        {text("kana", t.fields.kana)}
        {text("phone", t.fields.phone, true)}
        {text("landlinePhone", t.admin.fields.landlinePhone)}
        {text("mobilePhone", t.admin.fields.mobilePhone)}
        {text("postalCode", t.admin.fields.postalCode)}
        {text("prefecture", t.admin.fields.prefecture)}
        {text("city", t.admin.fields.city)}
        {text("addressLine", t.admin.fields.addressLine)}

        <PartnerFormField label={t.fields.status} htmlFor="status" error={fields["status"]}>
          <select id="status" name="status" defaultValue={data.status} className={FIELD_CLASS}>
            {CUSTOMER_STATUS_VALUES.map((v) => (
              <option key={v} value={v}>
                {t.admin.statusLabels[v] ?? v}
              </option>
            ))}
          </select>
        </PartnerFormField>

        <PartnerFormField
          label={t.admin.fields.tossUpSalesperson}
          htmlFor="tossUpSalespersonId"
          error={fields["tossUpSalespersonId"]}
        >
          <select
            id="tossUpSalespersonId"
            name="tossUpSalespersonId"
            defaultValue={data.tossUpSalespersonId ?? ""}
            className={FIELD_CLASS}
          >
            <option value="">{c.notSet}</option>
            {data.salespersonOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </PartnerFormField>

        <PartnerFormField
          label={t.admin.fields.closingSalesperson}
          htmlFor="closingSalespersonId"
          error={fields["closingSalespersonId"]}
        >
          <select
            id="closingSalespersonId"
            name="closingSalespersonId"
            defaultValue={data.closingSalespersonId ?? ""}
            className={FIELD_CLASS}
          >
            <option value="">{c.notSet}</option>
            {data.salespersonOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </PartnerFormField>
      </div>

      <PartnerFormField label={t.admin.fields.note} htmlFor="note" error={fields["note"]}>
        <textarea id="note" name="note" defaultValue={data.note ?? ""} className={TEXTAREA_CLASS} />
      </PartnerFormField>

      <PartnerFormActions
        submitLabel={c.save}
        pending={pending}
        pendingLabel={c.saving}
        cancelHref={`/p-customers/${data.id}`}
        cancelLabel={c.cancel}
        error={message}
      />
    </form>
  );
}
