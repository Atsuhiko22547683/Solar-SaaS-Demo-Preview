"use client";

// 販売員の登録 / 編集フォーム（Google フォームの販売員登録準拠）。
//
// 加盟店番号は認証情報から自動設定するため入力欄を出さない（表示のみ）。
// 必須は氏名（漢字）だけ — フォームに無い必須制約を足さない。

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  extractFieldErrors,
  FIELD_CLASS,
  PartnerFormActions,
  PartnerFormField,
  type FieldErrors,
} from "@/components/partner/partner-form";
import { PartnerCard } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";

import { createPartnerSalespersonAction, updatePartnerSalespersonAction } from "./actions";

import type { PartnerSalespersonDetail } from "./data";

const t = labels.partner.salesperson;
const c = labels.partner.common;

const LIST_PATH = "/p-salespeople";

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
  isActive: boolean;
  isGuest: boolean;
}

const EMPTY: FormState = {
  name: "",
  kana: "",
  email: "",
  gender: "",
  birthDate: "",
  phone: "",
  address: "",
  residentAddress: "",
  employmentType: "",
  salesExperience: "",
  isActive: true,
  isGuest: false,
};

function fromDetail(d: PartnerSalespersonDetail): FormState {
  return {
    name: d.name,
    kana: d.kana ?? "",
    email: d.email ?? "",
    gender: d.gender ?? "",
    birthDate: d.birthDate ?? "",
    phone: d.phone ?? "",
    address: d.address ?? "",
    residentAddress: d.residentAddress ?? "",
    employmentType: d.employmentType ?? "",
    salesExperience: d.salesExperience ?? "",
    isActive: d.isActive,
    isGuest: d.isGuest ?? false,
  };
}

export function PartnerSalespersonForm({
  mode,
  initial,
  franchiseNo,
}: {
  mode: "create" | "edit";
  initial?: PartnerSalespersonDetail;
  /** 加盟店番号（表示のみ。保存はサーバー側で行う）。 */
  franchiseNo: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(initial ? fromDetail(initial) : EMPTY);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setError(null);

    startTransition(async () => {
      // 空文字はスキーマ側で undefined に寄るので、そのまま渡してよい。
      const payload = {
        name: form.name,
        kana: form.kana,
        email: form.email,
        gender: form.gender ? (form.gender as "MALE") : undefined,
        birthDate: form.birthDate,
        phone: form.phone,
        address: form.address,
        residentAddress: form.residentAddress,
        employmentType: form.employmentType ? (form.employmentType as "EMPLOYEE") : undefined,
        salesExperience: form.salesExperience,
        isGuest: form.isGuest,
      };
      try {
        if (mode === "edit" && initial) {
          await updatePartnerSalespersonAction({
            ...payload,
            id: initial.id,
            isActive: form.isActive,
          });
          toast.success(c.updated);
          router.push(`${LIST_PATH}/${initial.id}`);
        } else {
          const created = await createPartnerSalespersonAction(payload);
          toast.success(c.created);
          router.push(`${LIST_PATH}/${created.id}`);
        }
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
      <PartnerCard className="space-y-4">
        {/* 加盟店番号は自動設定。入力欄にしない（§6）。 */}
        <p className="text-mute-light text-[13px]">
          {t.fields.franchiseNo}:{" "}
          <span className="text-ink tabular-nums">{franchiseNo ?? c.notSet}</span>
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PartnerFormField
            label={t.fields.name}
            htmlFor="sp-name"
            required
            error={fieldErrors.name}
          >
            <input
              id="sp-name"
              className={FIELD_CLASS}
              value={form.name}
              disabled={pending}
              onChange={(e) => set("name", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField label={t.fields.kana} htmlFor="sp-kana" error={fieldErrors.kana}>
            <input
              id="sp-kana"
              className={FIELD_CLASS}
              value={form.kana}
              disabled={pending}
              onChange={(e) => set("kana", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField label={t.fields.email} htmlFor="sp-email" error={fieldErrors.email}>
            <input
              id="sp-email"
              type="email"
              className={FIELD_CLASS}
              value={form.email}
              disabled={pending}
              onChange={(e) => set("email", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField label={t.fields.phone} htmlFor="sp-phone" error={fieldErrors.phone}>
            <input
              id="sp-phone"
              type="tel"
              inputMode="tel"
              className={FIELD_CLASS}
              value={form.phone}
              disabled={pending}
              onChange={(e) => set("phone", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField label={t.fields.gender} htmlFor="sp-gender" error={fieldErrors.gender}>
            <select
              id="sp-gender"
              className={FIELD_CLASS}
              value={form.gender}
              disabled={pending}
              onChange={(e) => set("gender", e.target.value)}
            >
              <option value="">{c.notSet}</option>
              {Object.entries(t.genderLabels).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.birthDate}
            htmlFor="sp-birth"
            error={fieldErrors.birthDate}
          >
            <input
              id="sp-birth"
              type="date"
              className={FIELD_CLASS}
              value={form.birthDate}
              disabled={pending}
              onChange={(e) => set("birthDate", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.employmentType}
            htmlFor="sp-employment"
            error={fieldErrors.employmentType}
          >
            <select
              id="sp-employment"
              className={FIELD_CLASS}
              value={form.employmentType}
              disabled={pending}
              onChange={(e) => set("employmentType", e.target.value)}
            >
              <option value="">{c.notSet}</option>
              {Object.entries(t.employmentTypeLabels).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.salesExperience}
            htmlFor="sp-experience"
            error={fieldErrors.salesExperience}
          >
            <input
              id="sp-experience"
              className={FIELD_CLASS}
              value={form.salesExperience}
              disabled={pending}
              onChange={(e) => set("salesExperience", e.target.value)}
            />
          </PartnerFormField>
        </div>

        <PartnerFormField label={t.fields.address} htmlFor="sp-address" error={fieldErrors.address}>
          <input
            id="sp-address"
            className={FIELD_CLASS}
            value={form.address}
            disabled={pending}
            onChange={(e) => set("address", e.target.value)}
          />
        </PartnerFormField>

        <PartnerFormField
          label={t.fields.residentAddress}
          htmlFor="sp-resident"
          error={fieldErrors.residentAddress}
        >
          <input
            id="sp-resident"
            className={FIELD_CLASS}
            value={form.residentAddress}
            disabled={pending}
            onChange={(e) => set("residentAddress", e.target.value)}
          />
        </PartnerFormField>

        {mode === "edit" ? (
          <label className="text-body-light flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              disabled={pending}
              className="border-ash-light text-primary focus:ring-primary/40 size-4 rounded border focus:ring-2"
              onChange={(e) => set("isActive", e.target.checked)}
            />
            {t.activeLabels.active}
          </label>
        ) : null}

        {/* ゲストスタッフ。受け入れは管理者の操作（この画面は管理者サイト限定）。 */}
        <label className="text-ink mt-3 flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isGuest}
            disabled={pending}
            className="border-ash-light text-primary focus:ring-primary/40 size-4 rounded border focus:ring-2"
            onChange={(e) => set("isGuest", e.target.checked)}
          />
          {t.fields.isGuest}
        </label>
        <p className="text-mute-light mt-1 text-xs">{t.fields.isGuestHint}</p>
      </PartnerCard>

      <PartnerFormActions
        submitLabel={mode === "edit" ? c.save : c.register}
        pendingLabel={mode === "edit" ? c.saving : c.registering}
        pending={pending}
        cancelHref={initial ? `${LIST_PATH}/${initial.id}` : LIST_PATH}
        cancelLabel={c.cancel}
        error={error}
      />
    </form>
  );
}
