"use client";

// 商談情報の編集フォーム（スタッフ本人が担当の商談だけ）。
//
// 出す項目は PARTNER_DEAL_EDITABLE_FIELDS と同じ 7 つ。顧客の基本情報・担当者・
// 粗利見込みはこのフォームに無く、Server Action 側の Zod（.strict()）も受け取らない。
// ステータスの選択肢は既存の遷移規則から「現在の状態 → 進める先」だけを出す。

import { DEAL_ALLOWED_TRANSITIONS, type DealStatus } from "@solar/contracts";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  extractFieldErrors,
  FIELD_CLASS,
  PartnerFormActions,
  PartnerFormField,
  TEXTAREA_CLASS,
  type FieldErrors,
} from "@/components/partner/partner-form";
import { PartnerCard } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";

import { updateMyDealAction } from "./actions";

import type { PartnerDealSummary } from "./data";

const t = labels.partner.customer.deal;
const c = labels.partner.common;

interface FormState {
  status: string;
  proposedProduct: string;
  proposedAmount: string;
  expectedContractDate: string;
  lostReason: string;
  nextAction: string;
  note: string;
}

export function PartnerDealForm({
  initial,
  customerId,
}: {
  initial: PartnerDealSummary;
  customerId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>({
    status: initial.status,
    proposedProduct: initial.proposedProduct ?? "",
    proposedAmount: initial.proposedAmount ?? "",
    expectedContractDate: initial.expectedContractDate
      ? initial.expectedContractDate.slice(0, 10)
      : "",
    lostReason: initial.lostReason ?? "",
    nextAction: initial.nextAction ?? "",
    note: initial.note ?? "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // 現在の状態と、そこから進める先だけを選択肢にする。
  const current = initial.status as DealStatus;
  const nextStatuses = [current, ...(DEAL_ALLOWED_TRANSITIONS[current] ?? new Set<DealStatus>())];
  const detailPath = `/p-customers/${customerId}`;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setError(null);
    startTransition(async () => {
      try {
        await updateMyDealAction({
          id: initial.id,
          status: form.status as DealStatus,
          proposedProduct: form.proposedProduct,
          proposedAmount: form.proposedAmount,
          expectedContractDate: form.expectedContractDate,
          lostReason: form.lostReason,
          nextAction: form.nextAction,
          note: form.note,
        });
        toast.success(c.updated);
        router.push(detailPath);
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PartnerFormField
            label={t.fields.status}
            htmlFor="d-status"
            hint={t.statusHint}
            error={fieldErrors.status}
          >
            <select
              id="d-status"
              className={FIELD_CLASS}
              value={form.status}
              disabled={pending}
              onChange={(e) => set("status", e.target.value)}
            >
              {nextStatuses.map((s) => (
                <option key={s} value={s}>
                  {t.statusLabels[s] ?? s}
                </option>
              ))}
            </select>
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.proposedProduct}
            htmlFor="d-product"
            error={fieldErrors.proposedProduct}
          >
            <input
              id="d-product"
              className={FIELD_CLASS}
              value={form.proposedProduct}
              disabled={pending}
              onChange={(e) => set("proposedProduct", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.proposedAmount}
            htmlFor="d-amount"
            error={fieldErrors.proposedAmount}
          >
            <input
              id="d-amount"
              inputMode="numeric"
              className={FIELD_CLASS}
              value={form.proposedAmount}
              disabled={pending}
              onChange={(e) => set("proposedAmount", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.expectedContractDate}
            htmlFor="d-date"
            error={fieldErrors.expectedContractDate}
          >
            <input
              id="d-date"
              type="date"
              className={FIELD_CLASS}
              value={form.expectedContractDate}
              disabled={pending}
              onChange={(e) => set("expectedContractDate", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.nextAction}
            htmlFor="d-next"
            error={fieldErrors.nextAction}
          >
            <input
              id="d-next"
              className={FIELD_CLASS}
              value={form.nextAction}
              disabled={pending}
              onChange={(e) => set("nextAction", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.lostReason}
            htmlFor="d-lost"
            error={fieldErrors.lostReason}
          >
            <input
              id="d-lost"
              className={FIELD_CLASS}
              value={form.lostReason}
              disabled={pending}
              onChange={(e) => set("lostReason", e.target.value)}
            />
          </PartnerFormField>
        </div>

        <PartnerFormField label={t.fields.note} htmlFor="d-note" error={fieldErrors.note}>
          <textarea
            id="d-note"
            className={TEXTAREA_CLASS}
            value={form.note}
            disabled={pending}
            onChange={(e) => set("note", e.target.value)}
          />
        </PartnerFormField>
      </PartnerCard>

      <PartnerFormActions
        submitLabel={c.save}
        pending={pending}
        pendingLabel={c.saving}
        cancelHref={detailPath}
        cancelLabel={c.cancel}
        error={error}
      />
    </form>
  );
}
