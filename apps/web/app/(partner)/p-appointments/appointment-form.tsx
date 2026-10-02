"use client";

// 初訪アポの登録 / 編集フォーム
// （Google フォーム「住設事業部/加盟店-①初訪アポフォーム」準拠・21 項目）。
//
// 加盟店番号は認証情報から決まるので入力欄を出さない（表示のみ）。
// トス獲得者 / 営業担当者は自社に登録済みの販売員から選ぶ。
// クローズ会社は、ログイン中の二次店が参照を許された会社だけを選択肢にする。
//
// 必須・条件付きの規則は @solar/contracts の Zod と 1:1。画面の必須マークだけで
// 済ませず、Server Action 側でも同じスキーマで検証する。
//
// フォームに無い項目は置かない。「トス部署」は①フォームに存在しないため、
// この画面には出さず訪問アポ側だけで扱う。

import { PartnerFirstVisitCreateSchema, PartnerFirstVisitUpdateSchema } from "@solar/contracts";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { PartnerOriginNotice, type PartnerOriginOption } from "@/components/partner/origin-select";
import {
  extractFieldErrors,
  issuesToFieldErrors,
  FIELD_CLASS,
  PartnerFormActions,
  PartnerFormField,
  TEXTAREA_CLASS,
  type FieldErrors,
} from "@/components/partner/partner-form";
import { PartnerCard } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";

import { createPartnerFirstVisitAction, updatePartnerFirstVisitAction } from "./actions";

import type { AppointmentEventContext, PartnerFirstVisitDetail } from "./data";

const t = labels.partner.appointment;
const c = labels.partner.common;

const LIST_PATH = "/p-appointments";

const SALES_CHANNELS = ["VISIT_SALES", "INBOUND", "EVENT", "REFERRAL", "OTHER"] as const;
/** 初訪アポの催事種別はカインズ / 島忠 / コメリ の 3 択（日報の W / V とは粒度が違う）。 */
const VENUE_CHAINS = ["CAINZ", "SHIMACHU", "KOMERI"] as const;
const BOOTH_AREAS = ["ENTRANCE", "REFORM_CORNER", "OTHER"] as const;
const FACE_TO_FACE = ["SOVEREIGN", "NON_SOVEREIGN"] as const;

/** 催事種別を入力するチャネル。 */
const VENUE_CHAIN_CHANNEL = "EVENT";
/** 対面者を入力するチャネル。 */
const FACE_TO_FACE_CHANNEL = "VISIT_SALES";

interface FormState {
  tossUpSalespersonId: string;
  closingRelationshipId: string;
  closingSalespersonId: string;
  salesChannel: string;
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
  tossUpSalespersonId: "",
  closingRelationshipId: "",
  closingSalespersonId: "",
  salesChannel: "",
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

function fromDetail(d: PartnerFirstVisitDetail): FormState {
  return {
    tossUpSalespersonId: d.tossUpSalespersonId ?? "",
    closingRelationshipId: d.closingRelationshipId ?? "",
    closingSalespersonId: d.closingSalespersonId ?? "",
    salesChannel: d.salesChannel ?? "",
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

/** 催事から登録するときの初期入力。催事から確定できる情報だけを埋める。 */
function fromEvent(ev: AppointmentEventContext): FormState {
  return {
    ...EMPTY,
    // 催事から来たので販売チャネルは「催事」。
    salesChannel: "EVENT",
    eventDate: ev.eventDate,
    venuePlace: ev.venuePlace,
    venueChain: ev.venueChain ?? "",
    boothArea: ev.boothArea ?? "",
    boothAreaNote: ev.boothAreaNote ?? "",
    // 担当者・アポ獲得者はログイン利用者を初期値にする。代理入力のときだけ変える。
    tossUpSalespersonId: ev.mySalespersonId ?? "",
    closingSalespersonId: ev.mySalespersonId ?? "",
  };
}

export function PartnerFirstVisitForm({
  mode,
  initial,
  franchiseNo,
  salespeople,
  closeCompanies,
  eventContext,
  origins,
}: {
  mode: "create" | "edit";
  initial?: PartnerFirstVisitDetail;
  franchiseNo: string | null;
  salespeople: { id: string; name: string }[];
  closeCompanies: { id: string; name: string }[];
  /**
   * 催事から登録するときの文脈。上部の業務情報を初期入力し、担当者・アポ獲得者の
   * 候補をその催事・当日の参加スタッフに限る。催事外からの登録では undefined。
   */
  eventContext?: AppointmentEventContext | null;
  /** 依頼先代理店の候補。催事から来たときは催事側の依頼元が使われる。 */
  origins: PartnerOriginOption[];
}) {
  // 担当者・アポ獲得者の候補。催事から来たときはその催事の参加スタッフだけにする
  // （別の催事の無関係なスタッフを混ぜない）。
  const staffOptions =
    eventContext && eventContext.attendees.length > 0 ? eventContext.attendees : salespeople;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [form, setForm] = useState<FormState>(() =>
    initial ? fromDetail(initial) : eventContext ? fromEvent(eventContext) : EMPTY,
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const needsVenueChain = form.salesChannel === VENUE_CHAIN_CHANNEL;
  const needsFaceToFace = form.salesChannel === FACE_TO_FACE_CHANNEL;

  /**
   * 販売チャネルの切替。
   *
   * 対象外になった条件付き項目（催事種別 / 対面者）はその場で消す。残すと
   * 「チャネルは訪問販売なのに催事種別が付いている」行ができ、どちらが正か
   * 判らなくなるため。サーバー側の Zod も同じ組み合わせを拒否する。
   */
  function setSalesChannel(next: string) {
    setForm((prev) => ({
      ...prev,
      salesChannel: next,
      venueChain: next === VENUE_CHAIN_CHANNEL ? prev.venueChain : "",
      faceToFace: next === FACE_TO_FACE_CHANNEL ? prev.faceToFace : "",
    }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setError(null);

    startTransition(async () => {
      const payload = {
        tossUpSalespersonId: form.tossUpSalespersonId,
        closingRelationshipId: form.closingRelationshipId,
        closingSalespersonId: form.closingSalespersonId,
        salesChannel: form.salesChannel as (typeof SALES_CHANNELS)[number],
        eventDate: form.eventDate,
        venuePlace: form.venuePlace,
        venueChain: form.venueChain
          ? (form.venueChain as (typeof VENUE_CHAINS)[number])
          : undefined,
        boothArea: form.boothArea as (typeof BOOTH_AREAS)[number],
        boothAreaNote: form.boothAreaNote,
        faceToFace: form.faceToFace
          ? (form.faceToFace as (typeof FACE_TO_FACE)[number])
          : undefined,
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
        // 催事との紐付けは id で持たせる。担当者を変えても書き換わらない。
        eventId: eventContext?.eventId,
        eventDayId: eventContext?.eventDayId ?? undefined,
      };
      // 送る前に共通スキーマで確かめ、項目ごとのメッセージを欄の近くに出す。
      // サーバー側の検証（Server Action の parse）はそのまま残す（二重防御）。
      const check =
        mode === "edit" && initial
          ? PartnerFirstVisitUpdateSchema.safeParse({ ...payload, id: initial.id })
          : PartnerFirstVisitCreateSchema.safeParse(payload);
      if (!check.success) {
        setFieldErrors(issuesToFieldErrors(check.error.issues));
        setError(c.validationFailed);
        return;
      }

      try {
        if (mode === "edit" && initial) {
          await updatePartnerFirstVisitAction({ ...payload, id: initial.id });
          toast.success(c.updated);
          router.push(`${LIST_PATH}/${initial.id}`);
        } else {
          const created = await createPartnerFirstVisitAction(payload);
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
        {/* 加盟店番号は自動設定。入力欄にしない。 */}
        <p className="text-mute-light text-[13px]">
          {t.fields.franchiseNo}:{" "}
          <span className="text-ink tabular-nums">{franchiseNo ?? c.notSet}</span>
        </p>
        {/* どの代理店への提出になるかを示すだけ（入力欄ではない）。
            催事から登録した場合はその催事の担当会社が依頼先になる。 */}
        {mode === "create" && !eventContext ? <PartnerOriginNotice options={origins} /> : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <PartnerFormField
            label={t.fields.tossGetter}
            htmlFor="a-toss"
            error={fieldErrors.tossUpSalespersonId}
          >
            <select
              id="a-toss"
              className={FIELD_CLASS}
              value={form.tossUpSalespersonId}
              disabled={pending}
              onChange={(e) => set("tossUpSalespersonId", e.target.value)}
            >
              <option value="">{c.notSet}</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.closeCompany}
            htmlFor="a-closecompany"
            required
            hint={t.closeCompanyHint}
            error={fieldErrors.closingRelationshipId}
          >
            <select
              id="a-closecompany"
              className={FIELD_CLASS}
              value={form.closingRelationshipId}
              disabled={pending}
              onChange={(e) => set("closingRelationshipId", e.target.value)}
            >
              <option value="">{c.notSet}</option>
              {closeCompanies.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.salesRep}
            htmlFor="a-rep"
            required
            error={fieldErrors.closingSalespersonId}
          >
            <select
              id="a-rep"
              className={FIELD_CLASS}
              value={form.closingSalespersonId}
              disabled={pending}
              onChange={(e) => set("closingSalespersonId", e.target.value)}
            >
              <option value="">{c.notSet}</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.channel}
            htmlFor="a-channel"
            required
            error={fieldErrors.salesChannel}
          >
            <select
              id="a-channel"
              className={FIELD_CLASS}
              value={form.salesChannel}
              disabled={pending}
              onChange={(e) => setSalesChannel(e.target.value)}
            >
              <option value="">{c.notSet}</option>
              {SALES_CHANNELS.map((v) => (
                <option key={v} value={v}>
                  {t.salesChannelLabels[v]}
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
            label={t.fields.eventDate}
            htmlFor="a-eventdate"
            required
            hint={t.eventDateHint}
            error={fieldErrors.eventDate}
          >
            <input
              id="a-eventdate"
              type="date"
              className={FIELD_CLASS}
              value={form.eventDate}
              disabled={pending}
              onChange={(e) => set("eventDate", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.venuePlace}
            htmlFor="a-place"
            required
            error={fieldErrors.venuePlace}
          >
            <input
              id="a-place"
              className={FIELD_CLASS}
              value={form.venuePlace}
              disabled={pending}
              onChange={(e) => set("venuePlace", e.target.value)}
            />
          </PartnerFormField>

          {/* 催事種別は販売チャネルが「催事」のときだけ入力対象。 */}
          {needsVenueChain ? (
            <PartnerFormField
              label={t.fields.eventType}
              htmlFor="a-chain"
              required
              hint={t.venueChainHint}
              error={fieldErrors.venueChain}
            >
              <select
                id="a-chain"
                className={FIELD_CLASS}
                value={form.venueChain}
                disabled={pending}
                onChange={(e) => set("venueChain", e.target.value)}
              >
                <option value="">{c.notSet}</option>
                {VENUE_CHAINS.map((v) => (
                  <option key={v} value={v}>
                    {t.venueChainLabels[v]}
                  </option>
                ))}
              </select>
            </PartnerFormField>
          ) : null}

          <PartnerFormField
            label={t.fields.boothArea}
            htmlFor="a-booth"
            required
            error={fieldErrors.boothArea}
          >
            <select
              id="a-booth"
              className={FIELD_CLASS}
              value={form.boothArea}
              disabled={pending}
              onChange={(e) => {
                const next = e.target.value;
                // 「その他」以外へ移したら自由記述は残さない（サーバー側も拒否する）。
                setForm((prev) => ({
                  ...prev,
                  boothArea: next,
                  boothAreaNote: next === "OTHER" ? prev.boothAreaNote : "",
                }));
              }}
            >
              <option value="">{c.notSet}</option>
              {BOOTH_AREAS.map((v) => (
                <option key={v} value={v}>
                  {t.boothAreaLabels[v]}
                </option>
              ))}
            </select>
          </PartnerFormField>

          {form.boothArea === "OTHER" ? (
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

          {/* 対面者は販売チャネルが「訪問販売」のときだけ入力対象。 */}
          {needsFaceToFace ? (
            <PartnerFormField
              label={t.fields.faceToFace}
              htmlFor="a-face"
              required
              hint={t.faceToFaceHint}
              error={fieldErrors.faceToFace}
            >
              <select
                id="a-face"
                className={FIELD_CLASS}
                value={form.faceToFace}
                disabled={pending}
                onChange={(e) => set("faceToFace", e.target.value)}
              >
                <option value="">{c.notSet}</option>
                {FACE_TO_FACE.map((v) => (
                  <option key={v} value={v}>
                    {t.faceToFaceLabels[v]}
                  </option>
                ))}
              </select>
            </PartnerFormField>
          ) : null}
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

          <PartnerFormField
            label={t.fields.kana}
            htmlFor="a-kana"
            required
            error={fieldErrors.kana}
          >
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
            error={fieldErrors.landlinePhone}
          >
            <input
              id="a-landline"
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
            required
            error={fieldErrors.mobilePhone}
          >
            <input
              id="a-mobile"
              inputMode="tel"
              className={FIELD_CLASS}
              value={form.mobilePhone}
              disabled={pending}
              onChange={(e) => set("mobilePhone", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.postalCode}
            htmlFor="a-postal"
            required
            error={fieldErrors.postalCode}
          >
            <input
              id="a-postal"
              className={FIELD_CLASS}
              value={form.postalCode}
              disabled={pending}
              onChange={(e) => set("postalCode", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.prefecture}
            htmlFor="a-pref"
            required
            error={fieldErrors.prefecture}
          >
            <input
              id="a-pref"
              className={FIELD_CLASS}
              value={form.prefecture}
              disabled={pending}
              onChange={(e) => set("prefecture", e.target.value)}
            />
          </PartnerFormField>
        </div>

        <PartnerFormField
          label={t.fields.cityAddress}
          htmlFor="a-city"
          required
          error={fieldErrors.cityAddress}
        >
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
          <PartnerFormField
            label={t.fields.maekakuPreferredAt}
            htmlFor="a-maekaku-at"
            error={fieldErrors.maekakuPreferredAt}
          >
            <input
              id="a-maekaku-at"
              type="datetime-local"
              className={FIELD_CLASS}
              value={form.maekakuPreferredAt}
              disabled={pending}
              onChange={(e) => set("maekakuPreferredAt", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.maekakuOperator}
            htmlFor="a-maekaku-op"
            required
            error={fieldErrors.maekakuOperator}
          >
            <input
              id="a-maekaku-op"
              className={FIELD_CLASS}
              value={form.maekakuOperator}
              disabled={pending}
              onChange={(e) => set("maekakuOperator", e.target.value)}
            />
          </PartnerFormField>

          <PartnerFormField
            label={t.fields.firstVisitAt}
            htmlFor="a-visit"
            required
            error={fieldErrors.firstVisitAt}
          >
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

      {/* ── 備考 ── */}
      <PartnerCard className="space-y-4">
        <h2 className="text-mute-light text-xs font-semibold">{t.sections.note}</h2>
        <PartnerFormField label={t.fields.note} htmlFor="a-note" error={fieldErrors.note}>
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
        pending={pending}
        pendingLabel={mode === "edit" ? c.saving : c.registering}
        cancelHref={mode === "edit" && initial ? `${LIST_PATH}/${initial.id}` : LIST_PATH}
        cancelLabel={c.cancel}
        error={error}
      />
    </form>
  );
}
