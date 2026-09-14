"use client";

// アポイントの登録 / 編集フォーム
// （Google フォーム「住設事業部/加盟店-①初訪アポフォーム」準拠）。
//
// 加盟店番号・クローズ会社は認証情報から決まるので入力欄を出さない（表示のみ）。
// トス獲得者 / 営業担当者は自社に登録済みの販売員から選ぶ。
// 電話番号は固定・携帯のどちらか一方が必須（サーバー側でも同じ検証をする）。

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

import { createPartnerAppointmentAction, updatePartnerAppointmentAction } from "./actions";

import type { PartnerAppointmentDetail } from "./data";

const t = labels.partner.appointment;
const c = labels.partner.common;

const LIST_PATH = "/p-appointments";

const SALES_CHANNELS = ["VISIT_SALES", "INBOUND", "EVENT", "REFERRAL", "OTHER"] as const;

interface FormState {
  tossDept: string;
  tossUpSalespersonId: string;
  closingSalespersonId: string;
  salesChannel: string;
  sourceEventId: string;
  eventDate: string;
  venuePlace: string;
  venueChain: string;
  boothArea: string;
  boothAreaNote: string;
  faceToFace: string;
  name: string;
  kana: string;
  landlinePhone: string;
  mobilePhone: string;
  postalCode: string;
  prefecture: string;
  cityAddress: string;
  maekakuPreferredAt: string;
  maekakuOperator: string;
  firstVisitAt: string;
  note: string;
}

const EMPTY: FormState = {
  tossDept: "",
  tossUpSalespersonId: "",
  closingSalespersonId: "",
  salesChannel: "",
  sourceEventId: "",
  eventDate: "",
  venuePlace: "",
  venueChain: "",
  boothArea: "",
  boothAreaNote: "",
  faceToFace: "",
  name: "",
  kana: "",
  landlinePhone: "",
  mobilePhone: "",
  postalCode: "",
  prefecture: "",
  cityAddress: "",
  maekakuPreferredAt: "",
  maekakuOperator: "",
  firstVisitAt: "",
  note: "",
};

/** ISO → datetime-local の値（分まで）。 */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fromDetail(d: PartnerAppointmentDetail): FormState {
  return {
    tossDept: d.tossDept ?? "",
    tossUpSalespersonId: d.tossUpSalespersonId ?? "",
    closingSalespersonId: d.closingSalespersonId ?? "",
    salesChannel: d.salesChannel ?? "",
    sourceEventId: d.sourceEventId ?? "",
    // 催事実施日は日付のみ。UTC 基準で切り出して往復させ、日付ずれを起こさない。
    eventDate: d.eventDate ? d.eventDate.slice(0, 10) : "",
    venuePlace: d.venuePlace ?? "",
    venueChain: d.venueChain ?? "",
    boothArea: d.boothArea ?? "",
    boothAreaNote: d.boothAreaNote ?? "",
    faceToFace: d.faceToFace ?? "",
    name: d.name,
    kana: d.kana ?? "",
    landlinePhone: d.landlinePhone ?? "",
    mobilePhone: d.mobilePhone ?? "",
    postalCode: d.postalCode ?? "",
    prefecture: d.prefecture ?? "",
    cityAddress: d.cityAddress ?? "",
    maekakuPreferredAt: toLocalInput(d.maekakuPreferredAt),
    maekakuOperator: d.maekakuOperator ?? "",
    firstVisitAt: toLocalInput(d.firstVisitAt),
    note: d.note ?? "",
  };
}

export function PartnerAppointmentForm({
  mode,
  initial,
  franchiseNo,
  salespeople,
  events,
}: {
  mode: "create" | "edit";
  initial?: PartnerAppointmentDetail;
  franchiseNo: string | null;
  salespeople: { id: string; name: string }[];
  events: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(initial ? fromDetail(initial) : EMPTY);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // 登録済み催事を選んでいる間は催事情報がイベント側で決まるので、
  // 直接入力欄は触れないようにする（同じ値を二重に持たせない）。
  const usingEvent = form.sourceEventId.length > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setError(null);

    startTransition(async () => {
      const payload = {
        tossDept: form.tossDept,
        tossUpSalespersonId: form.tossUpSalespersonId,
        closingSalespersonId: form.closingSalespersonId,
        salesChannel: form.salesChannel ? (form.salesChannel as "EVENT") : undefined,
        sourceEventId: form.sourceEventId,
        eventDate: form.eventDate,
        venuePlace: form.venuePlace,
        venueChain: form.venueChain ? (form.venueChain as "CAINZ_V") : undefined,
        boothArea: form.boothArea ? (form.boothArea as "ENTRANCE") : undefined,
        boothAreaNote: form.boothAreaNote,
        faceToFace: form.faceToFace ? (form.faceToFace as "SOVEREIGN") : undefined,
        name: form.name,
        kana: form.kana,
        landlinePhone: form.landlinePhone,
        mobilePhone: form.mobilePhone,
        postalCode: form.postalCode,
        prefecture: form.prefecture,
        cityAddress: form.cityAddress,
        maekakuPreferredAt: form.maekakuPreferredAt,
        maekakuOperator: form.maekakuOperator,
        firstVisitAt: form.firstVisitAt,
        note: form.note,
      };
      try {
        if (mode === "edit" && initial) {
          await updatePartnerAppointmentAction({ ...payload, id: initial.id });
          toast.success(c.updated);
          router.push(`${LIST_PATH}/${initial.id}`);
        } else {
          const created = await createPartnerAppointmentAction(payload);
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
      {/* ── 体制 ── */}
      <PartnerCard className="space-y-4">
        <h2 className="text-mute-light text-xs font-semibold">{t.sections.org}</h2>
        {/* 加盟店番号・クローズ会社は自動設定。入力欄にしない（§6）。 */}
        <p className="text-mute-light text-[13px]">
          {t.fields.franchiseNo}:{" "}
          <span className="text-ink tabular-nums">{franchiseNo ?? c.notSet}</span>
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PartnerFormField label={t.fields.tossDept} htmlFor="a-tossdept">
            <input
              id="a-tossdept"
              className={FIELD_CLASS}
              value={form.tossDept}
              disabled={pending}
              onChange={(e) => set("tossDept", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField label={t.fields.channel} htmlFor="a-channel">
            <select
              id="a-channel"
              className={FIELD_CLASS}
              value={form.salesChannel}
              disabled={pending}
              onChange={(e) => set("salesChannel", e.target.value)}
            >
              <option value="">{c.notSet}</option>
              {SALES_CHANNELS.map((v) => (
                <option key={v} value={v}>
                  {labels.customer.detail.salesChannelLabels[v] ?? v}
                </option>
              ))}
            </select>
          </PartnerFormField>

          <PartnerFormField label={t.fields.tossGetter} htmlFor="a-toss">
            <select
              id="a-toss"
              className={FIELD_CLASS}
              value={form.tossUpSalespersonId}
              disabled={pending}
              onChange={(e) => set("tossUpSalespersonId", e.target.value)}
            >
              <option value="">{c.notSet}</option>
              {salespeople.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </PartnerFormField>

          <PartnerFormField label={t.fields.salesRep} htmlFor="a-rep">
            <select
              id="a-rep"
              className={FIELD_CLASS}
              value={form.closingSalespersonId}
              disabled={pending}
              onChange={(e) => set("closingSalespersonId", e.target.value)}
            >
              <option value="">{c.notSet}</option>
              {salespeople.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </PartnerFormField>
        </div>
      </PartnerCard>

      {/* ── 催事 ── */}
      <PartnerCard className="space-y-4">
        <h2 className="text-mute-light text-xs font-semibold">{t.sections.event}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PartnerFormField
            label={t.fields.sourceEvent}
            htmlFor="a-event"
            hint={t.eventOverrideHint}
          >
            <select
              id="a-event"
              className={FIELD_CLASS}
              value={form.sourceEventId}
              disabled={pending}
              onChange={(e) => set("sourceEventId", e.target.value)}
            >
              <option value="">{t.noSourceEvent}</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.label}
                </option>
              ))}
            </select>
          </PartnerFormField>

          <PartnerFormField label={t.fields.eventDate} htmlFor="a-eventdate">
            <input
              id="a-eventdate"
              type="date"
              className={FIELD_CLASS}
              value={form.eventDate}
              disabled={pending || usingEvent}
              onChange={(e) => set("eventDate", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField label={t.fields.venuePlace} htmlFor="a-place">
            <input
              id="a-place"
              className={FIELD_CLASS}
              value={form.venuePlace}
              disabled={pending || usingEvent}
              onChange={(e) => set("venuePlace", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField label={t.fields.eventType} htmlFor="a-chain">
            <select
              id="a-chain"
              className={FIELD_CLASS}
              value={form.venueChain}
              disabled={pending || usingEvent}
              onChange={(e) => set("venueChain", e.target.value)}
            >
              <option value="">{c.notSet}</option>
              {Object.entries(labels.partner.report.venueChainLabels).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </PartnerFormField>

          <PartnerFormField label={t.fields.boothArea} htmlFor="a-booth">
            <select
              id="a-booth"
              className={FIELD_CLASS}
              value={form.boothArea}
              disabled={pending || usingEvent}
              onChange={(e) => {
                const next = e.target.value;
                // 「その他」から離れたら自由記述は捨てる。残したまま送ると
                // サーバー側の検証（その他のときだけ入力可）で弾かれるうえ、
                // 画面から消えた値が保存される状態にもなるため。
                setForm((prev) => ({
                  ...prev,
                  boothArea: next,
                  boothAreaNote: next === "OTHER" ? prev.boothAreaNote : "",
                }));
              }}
            >
              <option value="">{c.notSet}</option>
              {Object.entries(t.boothAreaLabels).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </PartnerFormField>

          {/* 自由記述は「その他」を選んだときだけ出す（サーバー側も同じ規則で検証）。 */}
          {form.boothArea === "OTHER" && !usingEvent ? (
            <PartnerFormField
              label={t.boothAreaNote}
              htmlFor="a-boothnote"
              hint={t.boothAreaNoteHint}
              error={fieldErrors.boothAreaNote}
            >
              <input
                id="a-boothnote"
                className={FIELD_CLASS}
                value={form.boothAreaNote}
                disabled={pending}
                onChange={(e) => set("boothAreaNote", e.target.value)}
              />
            </PartnerFormField>
          ) : null}

          <PartnerFormField label={t.fields.faceToFace} htmlFor="a-face">
            <select
              id="a-face"
              className={FIELD_CLASS}
              value={form.faceToFace}
              disabled={pending}
              onChange={(e) => set("faceToFace", e.target.value)}
            >
              <option value="">{c.notSet}</option>
              <option value="SOVEREIGN">{labels.customer.detail.faceToFaceLabels.sovereign}</option>
              <option value="NON_SOVEREIGN">
                {labels.customer.detail.faceToFaceLabels.nonSovereign}
              </option>
            </select>
          </PartnerFormField>
        </div>
      </PartnerCard>

      {/* ── お客様情報 ── */}
      <PartnerCard className="space-y-4">
        <h2 className="text-mute-light text-xs font-semibold">{t.sections.customer}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PartnerFormField
            label={t.fields.customerName}
            htmlFor="a-name"
            required
            error={fieldErrors.name}
          >
            <input
              id="a-name"
              className={FIELD_CLASS}
              value={form.name}
              disabled={pending}
              onChange={(e) => set("name", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField label={t.fields.kana} htmlFor="a-kana" error={fieldErrors.kana}>
            <input
              id="a-kana"
              className={FIELD_CLASS}
              value={form.kana}
              disabled={pending}
              onChange={(e) => set("kana", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.landline}
            htmlFor="a-landline"
            hint={t.phoneHint}
            error={fieldErrors.landlinePhone}
          >
            <input
              id="a-landline"
              type="tel"
              inputMode="tel"
              className={FIELD_CLASS}
              value={form.landlinePhone}
              disabled={pending}
              onChange={(e) => set("landlinePhone", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.mobile}
            htmlFor="a-mobile"
            error={fieldErrors.mobilePhone}
          >
            <input
              id="a-mobile"
              type="tel"
              inputMode="tel"
              className={FIELD_CLASS}
              value={form.mobilePhone}
              disabled={pending}
              onChange={(e) => set("mobilePhone", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField label={t.fields.postalCode} htmlFor="a-postal">
            <input
              id="a-postal"
              inputMode="numeric"
              className={FIELD_CLASS}
              value={form.postalCode}
              disabled={pending}
              onChange={(e) => set("postalCode", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField label={t.fields.prefecture} htmlFor="a-pref">
            <input
              id="a-pref"
              className={FIELD_CLASS}
              value={form.prefecture}
              disabled={pending}
              onChange={(e) => set("prefecture", e.target.value)}
            />
          </PartnerFormField>
        </div>

        <PartnerFormField label={t.fields.cityAddress} htmlFor="a-city">
          <input
            id="a-city"
            className={FIELD_CLASS}
            value={form.cityAddress}
            disabled={pending}
            onChange={(e) => set("cityAddress", e.target.value)}
          />
        </PartnerFormField>
      </PartnerCard>

      {/* ── アポ・マエカク ── */}
      <PartnerCard className="space-y-4">
        <h2 className="text-mute-light text-xs font-semibold">{t.sections.appointment}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PartnerFormField label={t.fields.maekakuPreferredAt} htmlFor="a-maekaku-at">
            <input
              id="a-maekaku-at"
              type="datetime-local"
              className={FIELD_CLASS}
              value={form.maekakuPreferredAt}
              disabled={pending}
              onChange={(e) => set("maekakuPreferredAt", e.target.value)}
            />
          </PartnerFormField>

          {/* マエカク実施者は自由記述（フォーム正本どおり。販売員選択にしない）。 */}
          <PartnerFormField label={t.fields.maekakuOperator} htmlFor="a-maekaku-op">
            <input
              id="a-maekaku-op"
              className={FIELD_CLASS}
              value={form.maekakuOperator}
              disabled={pending}
              onChange={(e) => set("maekakuOperator", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField label={t.fields.firstVisitAt} htmlFor="a-visit">
            <input
              id="a-visit"
              type="datetime-local"
              className={FIELD_CLASS}
              value={form.firstVisitAt}
              disabled={pending}
              onChange={(e) => set("firstVisitAt", e.target.value)}
            />
          </PartnerFormField>
        </div>
      </PartnerCard>

      <PartnerCard>
        <PartnerFormField label={t.fields.note} htmlFor="a-note">
          <textarea
            id="a-note"
            className={TEXTAREA_CLASS}
            value={form.note}
            disabled={pending}
            onChange={(e) => set("note", e.target.value)}
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
