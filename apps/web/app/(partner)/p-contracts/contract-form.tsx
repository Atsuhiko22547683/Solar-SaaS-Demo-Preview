"use client";

// 成約の登録 / 編集フォーム（Google フォーム「成約フォーム」準拠・9 項目）。
//
// 9 項目はすべて必須。規則は @solar/contracts の Zod と 1:1 で、Server Action
// 側でも同じスキーマで検証する（画面の required だけに頼らない）。
//
// 加盟店番号は認証情報から決まるので入力欄を出さない（表示のみ）。

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

import { createPartnerContractAction, updatePartnerContractAction } from "./actions";

import type { PartnerContractDetail } from "./data";

const t = labels.partner.contract;
const c = labels.partner.common;
// 対象顧客の文言は訪問アポ報告と共通（同じ意味の欄を別の言い回しにしない）。
const ct = labels.partner.visitAppointment.fields;

const LIST_PATH = "/p-contracts";

const AFFILIATIONS = ["VE", "PS"] as const;
const CHANNELS = ["VISIT_SALES", "TELE_APPOINTMENT", "REFERRAL", "EVENT", "INBOUND"] as const;

interface FormState {
  /** 対象の顧客。分かるときだけ選ぶ（このフォームは顧客名を聞かない）。 */
  customerId: string;
  contractDate: string;
  tossDate: string;
  tossDept: string;
  apptGetter: string;
  salesRep: string;
  referralBranch: string;
  affiliation: string;
  affiliationDept: string;
  acquisitionChannel: string;
}

const EMPTY: FormState = {
  customerId: "",
  contractDate: "",
  tossDate: "",
  tossDept: "",
  apptGetter: "",
  salesRep: "",
  referralBranch: "",
  affiliation: "",
  affiliationDept: "",
  acquisitionChannel: "",
};

function fromDetail(d: PartnerContractDetail): FormState {
  return {
    customerId: d.customerId ?? "",
    // 日付は UTC 基準で切り出して往復させ、時刻による日付ずれを起こさない。
    contractDate: d.contractDate.slice(0, 10),
    tossDate: d.tossDate.slice(0, 10),
    tossDept: d.tossDept,
    apptGetter: d.apptGetter,
    salesRep: d.salesRep,
    referralBranch: d.referralBranch,
    affiliation: d.affiliation,
    affiliationDept: d.affiliationDept,
    acquisitionChannel: d.acquisitionChannel,
  };
}

export function PartnerContractForm({
  mode,
  initial,
  franchiseNo,
  origins,
  customers,
}: {
  mode: "create" | "edit";
  initial?: PartnerContractDetail;
  franchiseNo: string | null;
  /** 依頼先代理店の候補。複数の代理店から依頼を受ける会社では選択が要る。 */
  origins: PartnerOriginOption[];
  /** 対象にできる顧客（自社が取り扱っている顧客）。 */
  customers: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(initial ? fromDetail(initial) : EMPTY);

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
        contractDate: form.contractDate,
        tossDate: form.tossDate,
        tossDept: form.tossDept,
        apptGetter: form.apptGetter,
        salesRep: form.salesRep,
        referralBranch: form.referralBranch,
        affiliation: form.affiliation as (typeof AFFILIATIONS)[number],
        affiliationDept: form.affiliationDept,
        acquisitionChannel: form.acquisitionChannel as (typeof CHANNELS)[number],
      };
      try {
        if (mode === "edit" && initial) {
          await updatePartnerContractAction({ ...payload, id: initial.id });
          toast.success(c.updated);
          router.push(`${LIST_PATH}/${initial.id}`);
        } else {
          const created = await createPartnerContractAction(payload);
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
        <h2 className="text-mute-light text-xs font-semibold">{t.sections.contract}</h2>
        <p className="text-mute-light text-[13px]">
          {t.fields.franchiseNo}:{" "}
          <span className="text-ink tabular-nums">{franchiseNo ?? c.notSet}</span>
        </p>
        {/* どの代理店への提出になるかを示すだけ（入力欄ではない）。
            実際の依頼先はサーバー側が認証情報と取引関係から確定する。 */}
        {mode === "create" ? <PartnerOriginNotice options={origins} /> : null}

        {/* 対象の顧客。選べば代理店の顧客詳細からこの報告を辿れる。
            この報告から正式な契約は作らない（金額・解約期限を持たないため）。 */}
        <PartnerFormField
          label={ct.customer}
          htmlFor="k-customer"
          hint={ct.customerHint}
          error={fieldErrors.customerId}
        >
          <select
            id="k-customer"
            className={FIELD_CLASS}
            value={form.customerId}
            disabled={pending}
            onChange={(e) => set("customerId", e.target.value)}
          >
            <option value="">{ct.customerNone}</option>
            {customers.map((cu) => (
              <option key={cu.id} value={cu.id}>
                {cu.label}
              </option>
            ))}
          </select>
        </PartnerFormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PartnerFormField
            label={t.fields.contractDate}
            htmlFor="k-contractdate"
            required
            error={fieldErrors.contractDate}
          >
            <input
              id="k-contractdate"
              type="date"
              className={FIELD_CLASS}
              value={form.contractDate}
              disabled={pending}
              onChange={(e) => set("contractDate", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.tossDate}
            htmlFor="k-tossdate"
            required
            error={fieldErrors.tossDate}
          >
            <input
              id="k-tossdate"
              type="date"
              className={FIELD_CLASS}
              value={form.tossDate}
              disabled={pending}
              onChange={(e) => set("tossDate", e.target.value)}
            />
          </PartnerFormField>
        </div>
      </PartnerCard>

      <PartnerCard className="space-y-4">
        <h2 className="text-mute-light text-xs font-semibold">{t.sections.org}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PartnerFormField
            label={t.fields.tossDept}
            htmlFor="k-tossdept"
            required
            error={fieldErrors.tossDept}
          >
            <input
              id="k-tossdept"
              className={FIELD_CLASS}
              value={form.tossDept}
              disabled={pending}
              onChange={(e) => set("tossDept", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.apptGetter}
            htmlFor="k-apptgetter"
            required
            error={fieldErrors.apptGetter}
          >
            <input
              id="k-apptgetter"
              className={FIELD_CLASS}
              value={form.apptGetter}
              disabled={pending}
              onChange={(e) => set("apptGetter", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.salesRep}
            htmlFor="k-salesrep"
            required
            error={fieldErrors.salesRep}
          >
            <input
              id="k-salesrep"
              className={FIELD_CLASS}
              value={form.salesRep}
              disabled={pending}
              onChange={(e) => set("salesRep", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.referralBranch}
            htmlFor="k-branch"
            required
            error={fieldErrors.referralBranch}
          >
            <input
              id="k-branch"
              className={FIELD_CLASS}
              value={form.referralBranch}
              disabled={pending}
              onChange={(e) => set("referralBranch", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.affiliation}
            htmlFor="k-affiliation"
            required
            hint={t.affiliationHint}
            error={fieldErrors.affiliation}
          >
            <select
              id="k-affiliation"
              className={FIELD_CLASS}
              value={form.affiliation}
              disabled={pending}
              onChange={(e) => set("affiliation", e.target.value)}
            >
              <option value="">{c.notSet}</option>
              {AFFILIATIONS.map((v) => (
                <option key={v} value={v}>
                  {t.affiliationLabels[v]}
                </option>
              ))}
            </select>
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.affiliationDept}
            htmlFor="k-affiliationdept"
            required
            error={fieldErrors.affiliationDept}
          >
            <input
              id="k-affiliationdept"
              className={FIELD_CLASS}
              value={form.affiliationDept}
              disabled={pending}
              onChange={(e) => set("affiliationDept", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.acquisitionChannel}
            htmlFor="k-channel"
            required
            error={fieldErrors.acquisitionChannel}
          >
            <select
              id="k-channel"
              className={FIELD_CLASS}
              value={form.acquisitionChannel}
              disabled={pending}
              onChange={(e) => set("acquisitionChannel", e.target.value)}
            >
              <option value="">{c.notSet}</option>
              {CHANNELS.map((v) => (
                <option key={v} value={v}>
                  {t.acquisitionChannelLabels[v]}
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
        cancelHref={mode === "edit" && initial ? `${LIST_PATH}/${initial.id}` : LIST_PATH}
        cancelLabel={c.cancel}
        error={error}
      />
    </form>
  );
}
