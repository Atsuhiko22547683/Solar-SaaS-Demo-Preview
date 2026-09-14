"use client";

// 催事日報の登録 / 編集フォーム（Google フォーム「ES_日報」準拠）。
//
// 合計（抽選数 / 着座数 / アポ数）は入力させない。両面 + 片面から画面上で
// 算出して表示するだけで、保存もしない（サーバー側も同じ扱い）。
// 大小関係（着座 ≤ 抽選、アポ ≤ 着座）は入力中にも見えるようにしておく。

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

import { createPartnerReportAction, updatePartnerReportAction } from "./actions";

import type { PartnerReportDetail } from "./data";

const t = labels.partner.report;
const c = labels.partner.common;

const LIST_PATH = "/p-reports";

interface FormState {
  eventDate: string;
  venuePlace: string;
  category: string;
  venueChain: string;
  areaInFacility: string;
  startTime: string;
  endTime: string;
  lotteryBoth: string;
  lotterySingle: string;
  seatedBoth: string;
  seatedSingle: string;
  apptBoth: string;
  apptSingle: string;
  cainzPayCount: string;
  impression: string;
}

const EMPTY: FormState = {
  eventDate: "",
  venuePlace: "",
  category: "HOUSING_EQUIPMENT",
  venueChain: "CAINZ_V",
  areaInFacility: "",
  startTime: "",
  endTime: "",
  lotteryBoth: "0",
  lotterySingle: "0",
  seatedBoth: "0",
  seatedSingle: "0",
  apptBoth: "0",
  apptSingle: "0",
  cainzPayCount: "",
  impression: "",
};

function fromDetail(d: PartnerReportDetail): FormState {
  return {
    eventDate: d.eventDate.slice(0, 10),
    venuePlace: d.venuePlace,
    category: d.category,
    venueChain: d.venueChain,
    areaInFacility: d.areaInFacility,
    startTime: d.startTime,
    endTime: d.endTime,
    lotteryBoth: String(d.lotteryBoth),
    lotterySingle: String(d.lotterySingle),
    seatedBoth: String(d.seatedBoth),
    seatedSingle: String(d.seatedSingle),
    apptBoth: String(d.apptBoth),
    apptSingle: String(d.apptSingle),
    cainzPayCount: d.cainzPayCount === null ? "" : String(d.cainzPayCount),
    impression: d.impression ?? "",
  };
}

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/** 成果の 1 行（両面 / 片面 / 合計）。合計は算出値なので読み取り専用で出す。 */
function MetricRow({
  label,
  bothKey,
  singleKey,
  form,
  set,
  errors,
  disabled,
}: {
  label: string;
  bothKey: keyof FormState;
  singleKey: keyof FormState;
  form: FormState;
  set: (k: keyof FormState, v: string) => void;
  errors: FieldErrors;
  disabled: boolean;
}) {
  const total = num(form[bothKey]) + num(form[singleKey]);
  const error = errors[bothKey as string] ?? errors[singleKey as string];
  return (
    <div className="space-y-1.5">
      <span className="text-ink block text-sm font-medium">{label}</span>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label htmlFor={`m-${bothKey}`} className="text-mute-light block text-[11px]">
            {t.metrics.both}
          </label>
          <input
            id={`m-${bothKey}`}
            type="text"
            inputMode="numeric"
            aria-label={`${label} ${t.metrics.both}`}
            className={`${FIELD_CLASS} text-right tabular-nums`}
            value={form[bothKey] as string}
            disabled={disabled}
            onChange={(e) => set(bothKey, e.target.value)}
          />
        </div>
        <div>
          <label htmlFor={`m-${singleKey}`} className="text-mute-light block text-[11px]">
            {t.metrics.single}
          </label>
          <input
            id={`m-${singleKey}`}
            type="text"
            inputMode="numeric"
            aria-label={`${label} ${t.metrics.single}`}
            className={`${FIELD_CLASS} text-right tabular-nums`}
            value={form[singleKey] as string}
            disabled={disabled}
            onChange={(e) => set(singleKey, e.target.value)}
          />
        </div>
        <div>
          <span className="text-mute-light block text-[11px]">{t.metrics.total}</span>
          <output
            className="border-hairline-light bg-surface-soft text-ink flex h-9 items-center justify-end rounded-md border px-3 text-sm tabular-nums"
            aria-label={`${label} ${t.metrics.total}`}
          >
            {total}
          </output>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PartnerReportForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: PartnerReportDetail;
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
        eventDate: form.eventDate,
        venuePlace: form.venuePlace,
        category: form.category as "HOUSING_EQUIPMENT",
        venueChain: form.venueChain as "CAINZ_V",
        areaInFacility: form.areaInFacility,
        startTime: form.startTime,
        endTime: form.endTime,
        lotteryBoth: form.lotteryBoth,
        lotterySingle: form.lotterySingle,
        seatedBoth: form.seatedBoth,
        seatedSingle: form.seatedSingle,
        apptBoth: form.apptBoth,
        apptSingle: form.apptSingle,
        ...(form.cainzPayCount ? { cainzPayCount: form.cainzPayCount } : {}),
        impression: form.impression,
      };
      try {
        if (mode === "edit" && initial) {
          await updatePartnerReportAction({ ...payload, id: initial.id });
          toast.success(c.updated);
          router.push(`${LIST_PATH}/${initial.id}`);
        } else {
          const created = await createPartnerReportAction(payload);
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
        <h2 className="text-mute-light text-xs font-semibold">{t.sections.basic}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PartnerFormField
            label={t.fields.eventDate}
            htmlFor="r-date"
            required
            error={fieldErrors.eventDate}
          >
            <input
              id="r-date"
              type="date"
              className={FIELD_CLASS}
              value={form.eventDate}
              disabled={pending}
              onChange={(e) => set("eventDate", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.venuePlace}
            htmlFor="r-place"
            required
            error={fieldErrors.venuePlace}
          >
            <input
              id="r-place"
              className={FIELD_CLASS}
              value={form.venuePlace}
              disabled={pending}
              onChange={(e) => set("venuePlace", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField label={t.fields.category} htmlFor="r-category" required>
            <select
              id="r-category"
              className={FIELD_CLASS}
              value={form.category}
              disabled={pending}
              onChange={(e) => set("category", e.target.value)}
            >
              {Object.entries(t.categoryLabels).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </PartnerFormField>

          <PartnerFormField label={t.fields.venueChain} htmlFor="r-chain" required>
            <select
              id="r-chain"
              className={FIELD_CLASS}
              value={form.venueChain}
              disabled={pending}
              onChange={(e) => set("venueChain", e.target.value)}
            >
              {Object.entries(t.venueChainLabels).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.areaInFacility}
            htmlFor="r-area"
            required
            error={fieldErrors.areaInFacility}
          >
            <input
              id="r-area"
              className={FIELD_CLASS}
              value={form.areaInFacility}
              disabled={pending}
              onChange={(e) => set("areaInFacility", e.target.value)}
            />
          </PartnerFormField>

          <div className="grid grid-cols-2 gap-3">
            <PartnerFormField
              label={t.fields.startTime}
              htmlFor="r-start"
              required
              error={fieldErrors.startTime}
            >
              <input
                id="r-start"
                type="time"
                className={FIELD_CLASS}
                value={form.startTime}
                disabled={pending}
                onChange={(e) => set("startTime", e.target.value)}
              />
            </PartnerFormField>
            <PartnerFormField
              label={t.fields.endTime}
              htmlFor="r-end"
              required
              error={fieldErrors.endTime}
            >
              <input
                id="r-end"
                type="time"
                className={FIELD_CLASS}
                value={form.endTime}
                disabled={pending}
                onChange={(e) => set("endTime", e.target.value)}
              />
            </PartnerFormField>
          </div>
        </div>
      </PartnerCard>

      <PartnerCard className="space-y-4">
        <div>
          <h2 className="text-mute-light text-xs font-semibold">{t.sections.performance}</h2>
          <p className="text-mute-light mt-1 text-xs">{t.totalHint}</p>
        </div>

        <MetricRow
          label={t.metrics.lottery}
          bothKey="lotteryBoth"
          singleKey="lotterySingle"
          form={form}
          set={set}
          errors={fieldErrors}
          disabled={pending}
        />
        <MetricRow
          label={t.metrics.seated}
          bothKey="seatedBoth"
          singleKey="seatedSingle"
          form={form}
          set={set}
          errors={fieldErrors}
          disabled={pending}
        />
        <MetricRow
          label={t.metrics.appointment}
          bothKey="apptBoth"
          singleKey="apptSingle"
          form={form}
          set={set}
          errors={fieldErrors}
          disabled={pending}
        />

        <PartnerFormField
          label={t.fields.cainzPayCount}
          htmlFor="r-cainzpay"
          error={fieldErrors.cainzPayCount}
        >
          <input
            id="r-cainzpay"
            type="text"
            inputMode="numeric"
            className={`${FIELD_CLASS} text-right tabular-nums sm:max-w-40`}
            value={form.cainzPayCount}
            disabled={pending}
            onChange={(e) => set("cainzPayCount", e.target.value)}
          />
        </PartnerFormField>
      </PartnerCard>

      <PartnerCard>
        <PartnerFormField
          label={t.fields.impression}
          htmlFor="r-impression"
          error={fieldErrors.impression}
        >
          <textarea
            id="r-impression"
            className={TEXTAREA_CLASS}
            value={form.impression}
            disabled={pending}
            onChange={(e) => set("impression", e.target.value)}
          />
        </PartnerFormField>
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
