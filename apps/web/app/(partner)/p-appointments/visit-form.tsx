"use client";

// 訪問アポの登録 / 編集フォーム
// （Google フォーム「住設事業部/加盟店-②訪問アポフォーム」準拠・5 項目）。
//
// このフォームには顧客情報も訪問日時も無い。ダミー顧客・架空日時を作らないため、
// 保存先は既存 Appointment ではなく専用テーブル DealerVisitAppointment。
// 画面上は初訪アポと同じ「アポイント登録」のタブとして見せる。
//
// 5 項目はすべて必須。規則は @solar/contracts の Zod と 1:1 で、Server Action
// 側でも同じスキーマで検証する。

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { PartnerOriginNotice, type PartnerOriginOption } from "@/components/partner/origin-select";
import {
  extractFieldErrors,
  FIELD_CLASS,
  PartnerFormActions,
  PartnerFormField,
  type FieldErrors,
} from "@/components/partner/partner-form";
import { PartnerCard } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";

import { createPartnerVisitAction, updatePartnerVisitAction } from "./actions";

import type { PartnerVisitDetail } from "./data";

const t = labels.partner.visitAppointment;
const a = labels.partner.appointment;
const c = labels.partner.common;

const LIST_PATH = "/p-appointments";
const DETAIL_PATH = "/p-appointments/visit";

const SALES_CHANNELS = ["VISIT_SALES", "INBOUND", "EVENT", "REFERRAL", "OTHER"] as const;

interface FormState {
  /** 対象の顧客。分かるときだけ選ぶ（このフォームは顧客名を聞かない）。 */
  customerId: string;
  tossDept: string;
  maekakuOperator: string;
  closeDept: string;
  salespersonId: string;
  salesChannel: string;
}

const EMPTY: FormState = {
  customerId: "",
  tossDept: "",
  maekakuOperator: "",
  closeDept: "",
  salespersonId: "",
  salesChannel: "",
};

export function PartnerVisitForm({
  mode,
  initial,
  franchiseNo,
  salespeople,
  origins,
  customers,
}: {
  mode: "create" | "edit";
  initial?: PartnerVisitDetail;
  franchiseNo: string | null;
  salespeople: { id: string; name: string }[];
  /** 対象にできる顧客（自社が取り扱っている顧客）。 */
  customers: { id: string; label: string }[];
  /** 依頼先代理店の候補。複数の代理店から依頼を受ける会社では選択が要る。 */
  origins: PartnerOriginOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState<FormState>(
    initial
      ? {
          customerId: initial.customerId ?? "",
          tossDept: initial.tossDept,
          maekakuOperator: initial.maekakuOperator,
          closeDept: initial.closeDept,
          salespersonId: initial.salespersonId,
          salesChannel: initial.salesChannel,
        }
      : EMPTY,
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setError(null);

    startTransition(async () => {
      const payload = {
        // 未選択なら送らない（サーバー側で「紐付けなし」になる）。
        ...(form.customerId ? { customerId: form.customerId } : {}),
        tossDept: form.tossDept,
        maekakuOperator: form.maekakuOperator,
        closeDept: form.closeDept,
        salespersonId: form.salespersonId,
        salesChannel: form.salesChannel as (typeof SALES_CHANNELS)[number],
      };
      try {
        if (mode === "edit" && initial) {
          await updatePartnerVisitAction({ ...payload, id: initial.id });
          toast.success(c.updated);
          router.push(`${DETAIL_PATH}/${initial.id}`);
        } else {
          const created = await createPartnerVisitAction(payload);
          toast.success(c.created);
          router.push(`${DETAIL_PATH}/${created.id}`);
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
        {/* 加盟店番号は自動設定。入力欄にしない。 */}
        <p className="text-mute-light text-[13px]">
          {t.fields.franchiseNo}:{" "}
          <span className="text-ink tabular-nums">{franchiseNo ?? c.notSet}</span>
        </p>
        {/* どの代理店への提出になるかを示すだけ（入力欄ではない）。
            訪問アポは催事に紐づかないので、取引関係から確定する。 */}
        {mode === "create" ? <PartnerOriginNotice options={origins} /> : null}

        {/* 対象の顧客。選べば代理店の顧客詳細からこの報告を辿れる。
            分からないときは未選択のまま出す（推測で結び付けない）。 */}
        <PartnerFormField
          label={t.fields.customer}
          htmlFor="v-customer"
          hint={t.fields.customerHint}
          error={fieldErrors.customerId}
        >
          <select
            id="v-customer"
            className={FIELD_CLASS}
            value={form.customerId}
            disabled={pending}
            onChange={(e) => set("customerId", e.target.value)}
          >
            <option value="">{t.fields.customerNone}</option>
            {customers.map((cu) => (
              <option key={cu.id} value={cu.id}>
                {cu.label}
              </option>
            ))}
          </select>
        </PartnerFormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PartnerFormField
            label={t.fields.tossDept}
            htmlFor="v-tossdept"
            required
            error={fieldErrors.tossDept}
          >
            <input
              id="v-tossdept"
              className={FIELD_CLASS}
              value={form.tossDept}
              disabled={pending}
              onChange={(e) => set("tossDept", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.maekakuOperator}
            htmlFor="v-maekaku-op"
            required
            error={fieldErrors.maekakuOperator}
          >
            <input
              id="v-maekaku-op"
              className={FIELD_CLASS}
              value={form.maekakuOperator}
              disabled={pending}
              onChange={(e) => set("maekakuOperator", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.closeDept}
            htmlFor="v-closedept"
            required
            error={fieldErrors.closeDept}
          >
            <input
              id="v-closedept"
              className={FIELD_CLASS}
              value={form.closeDept}
              disabled={pending}
              onChange={(e) => set("closeDept", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.salesRep}
            htmlFor="v-rep"
            required
            error={fieldErrors.salespersonId}
          >
            <select
              id="v-rep"
              className={FIELD_CLASS}
              value={form.salespersonId}
              disabled={pending}
              onChange={(e) => set("salespersonId", e.target.value)}
            >
              <option value="">{c.notSet}</option>
              {salespeople.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.channel}
            htmlFor="v-channel"
            required
            error={fieldErrors.salesChannel}
          >
            <select
              id="v-channel"
              className={FIELD_CLASS}
              value={form.salesChannel}
              disabled={pending}
              onChange={(e) => set("salesChannel", e.target.value)}
            >
              <option value="">{c.notSet}</option>
              {SALES_CHANNELS.map((v) => (
                <option key={v} value={v}>
                  {a.salesChannelLabels[v]}
                </option>
              ))}
            </select>
          </PartnerFormField>
        </div>
      </PartnerCard>

      <PartnerFormActions
        submitLabel={mode === "edit" ? c.save : c.register}
        pending={pending}
        pendingLabel={mode === "edit" ? c.saving : c.registering}
        cancelHref={mode === "edit" && initial ? `${DETAIL_PATH}/${initial.id}` : LIST_PATH}
        cancelLabel={c.cancel}
        error={error}
      />
    </form>
  );
}
