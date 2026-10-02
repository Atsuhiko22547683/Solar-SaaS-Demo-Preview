"use client";

// 催事日報の登録 / 編集フォーム（Google フォーム「ES_日報」準拠）。
//
// 合計（抽選数 / 着座数 / アポ数）は入力させない。両面 + 片面から画面上で
// 算出して表示するだけで、保存もしない（サーバー側も同じ扱い）。
// 大小関係（着座 ≤ 抽選、アポ ≤ 着座）は入力中にも見えるようにしておく。

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { PartnerOriginNotice, type PartnerOriginOption } from "@/components/partner/origin-select";
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

import {
  correctPartnerReportAction,
  createPartnerReportAction,
  updatePartnerReportAction,
} from "./actions";

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
  /** 対象の催事。日報は催事の記録なので必須。 */
  eventId: string;
  /** 対象の開催日。複数日開催でどの日か分かるように必須。 */
  eventDayId: string;
  /** 数値の集計単位。未選択は UNKNOWN（合計に混ぜない）。 */
  reportScope: string;
}

const EMPTY: FormState = {
  eventId: "",
  eventDayId: "",
  reportScope: "",
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
    // 催事・開催日・集計単位は元の日報のものを引き継ぐ。
    // 編集画面ではこの 3 つを出さないので、送信時も元の値のまま変わらない。
    eventId: d.eventId ?? "",
    eventDayId: d.eventDayId ?? "",
    reportScope: d.reportScope === "UNKNOWN" ? "" : d.reportScope,
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
  franchiseNo,
  origins,
  events = [],
  initialEventId = "",
  initialEventDayId = "",
}: {
  mode: "create" | "edit" | "correct";
  initial?: PartnerReportDetail;
  /** 加盟店番号。認証情報から決まるので入力欄にはしない（表示のみ）。 */
  franchiseNo: string | null;
  /** 依頼先代理店の候補。複数の代理店から依頼を受ける会社では選択が要る。 */
  origins: PartnerOriginOption[];
  /**
   * 自社が担当している催事と、その開催日。
   * 日報は「どの催事のどの開催日か」が決まってはじめて意味を持つので、両方選ばせる。
   */
  events?: Array<{
    eventId: string;
    label: string;
    venuePlace: string;
    days: Array<{ eventDayId: string; date: string; label: string }>;
  }>;
  /** 催事シフト・催事一覧から引き継いだ対象。指定があれば初期選択する。 */
  initialEventId?: string;
  initialEventDayId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(
    initial
      ? fromDetail(initial)
      : { ...EMPTY, eventId: initialEventId, eventDayId: initialEventDayId },
  );

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  // 実施日・場所は催事の記録が一次ソース。新規・訂正では選んだ開催日から決める
  // （サーバー側でも催事側の値で保存するので、手入力させると食い違って見える）。
  const selectedEvent = events.find((ev) => ev.eventId === form.eventId) ?? null;
  const selectedDay = selectedEvent?.days.find((d) => d.eventDayId === form.eventDayId) ?? null;
  const linkedDate = mode === "edit" ? form.eventDate : (selectedDay?.date ?? "");
  const linkedPlace = mode === "edit" ? form.venuePlace : (selectedEvent?.venuePlace ?? "");

  function set(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setError(null);

    startTransition(async () => {
      const payload = {
        eventDate: linkedDate,
        venuePlace: linkedPlace,
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
        // 催事・開催日はサーバーでも必須。実施日と場所は催事側の記録から埋まる。
        ...(form.eventId ? { eventId: form.eventId } : {}),
        ...(form.eventDayId ? { eventDayId: form.eventDayId } : {}),
        ...(form.reportScope ? { reportScope: form.reportScope as "PERSON" } : {}),
        impression: form.impression,
      };
      try {
        if (mode === "edit" && initial) {
          await updatePartnerReportAction({ ...payload, id: initial.id });
          toast.success(c.updated);
          router.push(`${LIST_PATH}/${initial.id}`);
        } else if (mode === "correct" && initial) {
          // 元の行は残したまま、訂正後の行を作って繋ぐ（集計は訂正後だけを数える）。
          const corrected = await correctPartnerReportAction({
            ...payload,
            supersedesReportId: initial.id,
          });
          toast.success(c.created);
          router.push(`${LIST_PATH}/${corrected.id}`);
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
        <p className="text-mute-light text-[13px]">
          {t.fields.franchiseNo}:{" "}
          <span className="text-ink tabular-nums">{franchiseNo ?? c.notSet}</span>
        </p>
        {/* どの代理店への提出になるかを示すだけ（入力欄ではない）。
            実際の依頼先はサーバー側が認証情報と取引関係から確定する。 */}
        {mode === "edit" ? null : <PartnerOriginNotice options={origins} />}

        {/* 対象の催事と開催日。どちらも必須で、実施日・場所はこの選択から決まる。
            自社が担当していない催事や、別催事の開催日はサーバーでも弾く。 */}
        {/* 担当している催事が 1 件も無いと日報は出せない。行き止まりにせず理由を出す。 */}
        {mode !== "edit" && events.length === 0 ? (
          <p className="text-warning text-[13px]">{t.eventLink.noEvents}</p>
        ) : null}

        {mode === "edit" ? null : (
          <>
            <PartnerFormField
              label={t.eventLink.label}
              htmlFor="r-event"
              required
              hint={t.eventLink.hint}
              error={fieldErrors.eventId}
            >
              <select
                id="r-event"
                className={FIELD_CLASS}
                value={form.eventId}
                disabled={pending}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, eventId: e.target.value, eventDayId: "" }))
                }
              >
                <option value="">{t.eventLink.none}</option>
                {events.map((ev) => (
                  <option key={ev.eventId} value={ev.eventId}>
                    {ev.label}
                  </option>
                ))}
              </select>
            </PartnerFormField>

            <PartnerFormField
              label={t.eventLink.dayLabel}
              htmlFor="r-event-day"
              required
              error={fieldErrors.eventDayId}
            >
              <select
                id="r-event-day"
                className={FIELD_CLASS}
                value={form.eventDayId}
                disabled={pending || form.eventId.length === 0}
                onChange={(e) => set("eventDayId", e.target.value)}
              >
                <option value="">{t.eventLink.dayNone}</option>
                {(events.find((ev) => ev.eventId === form.eventId)?.days ?? []).map((d) => (
                  <option key={d.eventDayId} value={d.eventDayId}>
                    {d.label}
                  </option>
                ))}
              </select>
            </PartnerFormField>
          </>
        )}

        <PartnerFormField label={t.scope.label} htmlFor="r-scope" hint={t.scope.hint}>
          <select
            id="r-scope"
            className={FIELD_CLASS}
            value={form.reportScope}
            disabled={pending}
            onChange={(e) => set("reportScope", e.target.value)}
          >
            <option value="">{t.scope.UNKNOWN}</option>
            <option value="PERSON">{t.scope.PERSON}</option>
            <option value="COMPANY">{t.scope.COMPANY}</option>
            <option value="BOOTH">{t.scope.BOOTH}</option>
          </select>
        </PartnerFormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {mode === "edit" ? (
            <>
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
            </>
          ) : (
            <>
              {/* 選んだ催事・開催日から決まる。入力欄にすると催事側の記録と食い違う。 */}
              <PartnerFormField
                label={t.fields.eventDate}
                htmlFor="r-date-derived"
                error={fieldErrors.eventDate}
              >
                <p id="r-date-derived" className="text-ink py-2 text-sm tabular-nums">
                  {linkedDate || c.notSet}
                </p>
              </PartnerFormField>
              <PartnerFormField
                label={t.fields.venuePlace}
                htmlFor="r-place-derived"
                error={fieldErrors.venuePlace}
              >
                <p id="r-place-derived" className="text-ink py-2 text-sm">
                  {linkedPlace || c.notSet}
                </p>
              </PartnerFormField>
            </>
          )}

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
        submitLabel={mode === "edit" ? c.save : mode === "correct" ? t.correctAction : c.register}
        pendingLabel={mode === "edit" ? c.saving : c.registering}
        pending={pending}
        cancelHref={initial ? `${LIST_PATH}/${initial.id}` : LIST_PATH}
        cancelLabel={c.cancel}
        error={error}
      />
    </form>
  );
}
