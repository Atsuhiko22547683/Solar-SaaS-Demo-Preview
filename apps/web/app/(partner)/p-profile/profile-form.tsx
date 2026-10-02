"use client";

// 個人設定のフォーム（スタッフ本人）。
//
// 直せるのは本人の連絡先・住所など。所属会社・加盟店番号・利用状態・ログイン用の
// メールアドレスは表示だけで、入力欄にしない（サーバー側でも更新しない）。

import { PartnerProfileUpdateSchema } from "@solar/contracts";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  extractFieldErrors,
  issuesToFieldErrors,
  FIELD_CLASS,
  PartnerFormActions,
  PartnerFormField,
  type FieldErrors,
} from "@/components/partner/partner-form";
import { PartnerCard, PartnerSection } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";

import { updateMyProfileAction } from "./actions";

import type { PartnerProfile } from "./data";

const t = labels.partner.profile;
const c = labels.partner.common;
const sp = labels.partner.salesperson;

const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
const EMPLOYMENTS = ["EMPLOYEE", "CONTRACT", "PART_TIME", "SUBCONTRACT", "OTHER"] as const;

interface FormState {
  name: string;
  kana: string;
  email: string;
  gender: string;
  birthDate: string;
  phone: string;
  address: string;
  residentAddress: string;
  employmentType: string;
  salesExperience: string;
}

function fromProfile(p: PartnerProfile): FormState {
  return {
    name: p.name,
    kana: p.kana ?? "",
    email: p.email ?? "",
    gender: p.gender ?? "",
    birthDate: p.birthDate ?? "",
    phone: p.phone ?? "",
    address: p.address ?? "",
    residentAddress: p.residentAddress ?? "",
    employmentType: p.employmentType ?? "",
    salesExperience: p.salesExperience ?? "",
  };
}

export function PartnerProfileForm({ profile }: { profile: PartnerProfile }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(fromProfile(profile));
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setError(null);

    const payload = {
      name: form.name,
      kana: form.kana,
      email: form.email,
      gender: form.gender ? (form.gender as (typeof GENDERS)[number]) : undefined,
      birthDate: form.birthDate,
      phone: form.phone,
      address: form.address,
      residentAddress: form.residentAddress,
      employmentType: form.employmentType
        ? (form.employmentType as (typeof EMPLOYMENTS)[number])
        : undefined,
      salesExperience: form.salesExperience,
    };

    // 送る前に共通スキーマで確かめ、項目ごとのメッセージを欄の近くに出す。
    const check = PartnerProfileUpdateSchema.safeParse(payload);
    if (!check.success) {
      setFieldErrors(issuesToFieldErrors(check.error.issues));
      setError(c.validationFailed);
      return;
    }

    startTransition(async () => {
      try {
        await updateMyProfileAction(payload);
        toast.success(c.updated);
        router.refresh();
      } catch (err) {
        const { fields, message } = extractFieldErrors(err);
        setFieldErrors(fields);
        setError(message ?? labels.common.unknownError);
        if (message) toast.error(message);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* 本人が直せない項目。表示だけで入力欄にしない。 */}
      <PartnerCard>
        <PartnerSection title={t.sections.fixed}>
          <p className="text-mute-light mb-3 text-[13px]">{t.fixedHint}</p>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              [t.fields.companyName, profile.companyName],
              [t.fields.franchiseNo, profile.franchiseNo ?? c.notSet],
              [t.fields.loginEmail, profile.loginEmail],
              [t.fields.isActive, profile.isActive ? t.activeYes : t.activeNo],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-mute-light text-xs">{label}</dt>
                <dd className="text-ink mt-0.5 break-words text-sm">{value}</dd>
              </div>
            ))}
          </dl>
        </PartnerSection>
      </PartnerCard>

      <PartnerCard className="space-y-4">
        <PartnerSection title={t.sections.editable}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PartnerFormField
              label={sp.fields.name}
              htmlFor="pf-name"
              required
              error={fieldErrors.name}
            >
              <input
                id="pf-name"
                className={FIELD_CLASS}
                value={form.name}
                disabled={pending}
                onChange={(e) => set("name", e.target.value)}
              />
            </PartnerFormField>

            <PartnerFormField label={sp.fields.kana} htmlFor="pf-kana" error={fieldErrors.kana}>
              <input
                id="pf-kana"
                className={FIELD_CLASS}
                value={form.kana}
                disabled={pending}
                onChange={(e) => set("kana", e.target.value)}
              />
            </PartnerFormField>

            <PartnerFormField
              label={sp.fields.email}
              htmlFor="pf-email"
              hint={t.emailHint}
              error={fieldErrors.email}
            >
              <input
                id="pf-email"
                type="email"
                className={FIELD_CLASS}
                value={form.email}
                disabled={pending}
                onChange={(e) => set("email", e.target.value)}
              />
            </PartnerFormField>

            <PartnerFormField label={sp.fields.phone} htmlFor="pf-phone" error={fieldErrors.phone}>
              <input
                id="pf-phone"
                className={FIELD_CLASS}
                value={form.phone}
                disabled={pending}
                onChange={(e) => set("phone", e.target.value)}
              />
            </PartnerFormField>

            <PartnerFormField
              label={sp.fields.gender}
              htmlFor="pf-gender"
              error={fieldErrors.gender}
            >
              <select
                id="pf-gender"
                className={FIELD_CLASS}
                value={form.gender}
                disabled={pending}
                onChange={(e) => set("gender", e.target.value)}
              >
                <option value="">{c.notSet}</option>
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {sp.genderLabels[g]}
                  </option>
                ))}
              </select>
            </PartnerFormField>

            <PartnerFormField
              label={sp.fields.birthDate}
              htmlFor="pf-birth"
              error={fieldErrors.birthDate}
            >
              <input
                id="pf-birth"
                type="date"
                className={FIELD_CLASS}
                value={form.birthDate}
                disabled={pending}
                onChange={(e) => set("birthDate", e.target.value)}
              />
            </PartnerFormField>

            <PartnerFormField
              label={sp.fields.employmentType}
              htmlFor="pf-employment"
              error={fieldErrors.employmentType}
            >
              <select
                id="pf-employment"
                className={FIELD_CLASS}
                value={form.employmentType}
                disabled={pending}
                onChange={(e) => set("employmentType", e.target.value)}
              >
                <option value="">{c.notSet}</option>
                {EMPLOYMENTS.map((v) => (
                  <option key={v} value={v}>
                    {sp.employmentTypeLabels[v]}
                  </option>
                ))}
              </select>
            </PartnerFormField>

            <PartnerFormField
              label={sp.fields.salesExperience}
              htmlFor="pf-exp"
              error={fieldErrors.salesExperience}
            >
              <input
                id="pf-exp"
                className={FIELD_CLASS}
                value={form.salesExperience}
                disabled={pending}
                onChange={(e) => set("salesExperience", e.target.value)}
              />
            </PartnerFormField>
          </div>

          <PartnerFormField
            label={sp.fields.address}
            htmlFor="pf-address"
            error={fieldErrors.address}
          >
            <input
              id="pf-address"
              className={FIELD_CLASS}
              value={form.address}
              disabled={pending}
              onChange={(e) => set("address", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={sp.fields.residentAddress}
            htmlFor="pf-resident"
            error={fieldErrors.residentAddress}
          >
            <input
              id="pf-resident"
              className={FIELD_CLASS}
              value={form.residentAddress}
              disabled={pending}
              onChange={(e) => set("residentAddress", e.target.value)}
            />
          </PartnerFormField>
        </PartnerSection>
      </PartnerCard>

      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}

      <PartnerFormActions
        pending={pending}
        submitLabel={c.save}
        pendingLabel={c.saving}
        cancelHref="/p-home"
        cancelLabel={c.cancel}
      />
    </form>
  );
}
