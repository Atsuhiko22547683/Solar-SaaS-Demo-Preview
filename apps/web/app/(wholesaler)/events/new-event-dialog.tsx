"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { labels } from "@/lib/i18n/labels";

import { createEventCandidateAction } from "../event-detail/actions";

import type { StoreOption } from "../event-detail/data";
import type { EventCandidateInput } from "@solar/contracts";

// 開催場所は店舗マスタ 1 本に集約したので、場所提供元・エリアの候補は受け取らない。
// （別々の候補から組み立てると、店舗と提供元がちぐはぐな組合せを作れてしまう。）
interface NewEventDialogProps {
  stores: StoreOption[];
}

// フォーム上のステータス選択肢 → 送信ステータスのマッピング。
// 確認中 → DRAFT / 確定 → DECIDED / 中止 → CANCELLED。
// OPEN/CLOSED は publish/close フローを経るべきなので作成時は選べない。
type StatusChoice = "pending" | "confirmed" | "cancelled";
const STATUS_TO_PAYLOAD: Record<StatusChoice, "DRAFT" | "DECIDED" | "CANCELLED"> = {
  pending: "DRAFT",
  confirmed: "DECIDED",
  cancelled: "CANCELLED",
};

interface FormState {
  /** 開催場所は店舗マスタの行を選ぶ。住所・場所提供元・開催エリアはここから決まる。 */
  storeId: string;
  scheduledDate: string;
  status: StatusChoice;
  contractType: "" | "FIXED" | "PERFORMANCE" | "OTHER";
  fixedFee: string;
  performanceRate: string;
  contractNote: string;
}

const EMPTY: FormState = {
  storeId: "",
  scheduledDate: "",
  status: "pending",
  contractType: "",
  fixedFee: "",
  performanceRate: "",
  contractNote: "",
};

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-hairline-light bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

export function NewEventDialog({ stores }: NewEventDialogProps) {
  const router = useRouter();
  const t = labels.eventCandidate;
  const c = labels.common;
  const tl = labels.eventList;

  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 選んだ店舗。住所 / 場所提供元 / 開催エリアはここからだけ表示する。
  const selectedStore = stores.find((s) => s.id === values.storeId) ?? null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!values.scheduledDate) {
      setError(t.errors.scheduledDateRequired);
      return;
    }
    if (!values.storeId) {
      setError(t.errors.storeRequired);
      return;
    }

    const blank = (s: string) => (s.trim().length === 0 ? undefined : s.trim());

    startTransition(async () => {
      try {
        // 対象年月は実施予定日 (YYYY-MM-DD) の先頭 7 文字から自動算出し、
        // 回答期限は実施予定日と同値にする（いずれもフォームからは入力しない）。
        //
        // 店舗名・住所・場所提供元・開催エリアはここから送らない。サーバーが storeId
        // から店舗マスタを引いて確定する（画面の値とマスタがずれないようにする）。
        const payload: EventCandidateInput = {
          storeId: values.storeId,
          targetMonth: values.scheduledDate.slice(0, 7),
          scheduledDate: new Date(values.scheduledDate),
          deadlineAt: new Date(values.scheduledDate),
          contractType: values.contractType === "" ? undefined : values.contractType,
          fixedFee: values.contractType === "FIXED" ? blank(values.fixedFee) : undefined,
          performanceRate:
            values.contractType === "PERFORMANCE" ? blank(values.performanceRate) : undefined,
          contractNote: blank(values.contractNote),
          status: STATUS_TO_PAYLOAD[values.status],
        };
        const result = await createEventCandidateAction(payload);
        toast.success(c.saved);
        setOpen(false);
        setValues(EMPTY);
        router.push(`/event-detail/${result.id}`);
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : c.unknownError);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{tl.newEvent}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.new}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-5" noValidate>
          {/* 開催店舗 — 店舗マスタが正本。住所 / 場所提供元 / 開催エリアはここから決まる。 */}
          <div className="space-y-1.5">
            <label className="text-mute-light text-xs font-semibold" htmlFor="ne-store">
              {t.fields.store} <span className="text-danger">*</span>
            </label>
            <select
              id="ne-store"
              value={values.storeId}
              onChange={(e) => update("storeId", e.target.value)}
              className={SELECT_CLASS}
              aria-describedby="ne-store-hint"
            >
              <option value="">{c.notSet}</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.venueProviderName ? `${s.venueProviderName} ` : ""}
                  {s.name}
                </option>
              ))}
            </select>
            <p id="ne-store-hint" className="text-mute-light text-xs">
              {t.storeHint}
              {stores.length === 0 ? ` — ${t.storeUnregistered}` : ""}
            </p>
            <Link
              href="/masters/stores"
              className="text-primary inline-block text-xs underline underline-offset-2"
            >
              {t.storeMasterLink}
            </Link>
          </div>

          {/* 選んだ店舗から決まる内容（読み取り専用）。入力欄にすると値がずれる。 */}
          <dl className="border-hairline-light bg-surface-soft/40 grid grid-cols-1 gap-x-4 gap-y-2 rounded-md border p-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-mute-light text-xs font-semibold">{t.fields.venueProvider}</dt>
              <dd className="text-ink">{selectedStore?.venueProviderName ?? c.notSet}</dd>
            </div>
            <div>
              <dt className="text-mute-light text-xs font-semibold">{t.fields.area}</dt>
              <dd className="text-ink">{selectedStore?.areaName ?? c.notSet}</dd>
            </div>
            <div>
              <dt className="text-mute-light text-xs font-semibold">{t.fields.address}</dt>
              <dd className="text-ink break-words">{selectedStore?.address ?? c.notSet}</dd>
            </div>
          </dl>

          {/* 実施日 / ステータス */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-mute-light text-xs font-semibold" htmlFor="ne-date">
                {t.fields.scheduledDate} <span className="text-danger">*</span>
              </label>
              <Input
                id="ne-date"
                type="date"
                value={values.scheduledDate}
                onChange={(e) => update("scheduledDate", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-mute-light text-xs font-semibold" htmlFor="ne-status">
                {t.fields.status}
              </label>
              <select
                id="ne-status"
                value={values.status}
                onChange={(e) => update("status", e.target.value as StatusChoice)}
                className={SELECT_CLASS}
              >
                <option value="pending">{tl.holdingStatuses.pending}</option>
                <option value="confirmed">{tl.holdingStatuses.confirmed}</option>
                <option value="cancelled">{tl.holdingStatuses.cancelled}</option>
              </select>
            </div>
          </div>

          {/* 契約条件（内部） */}
          <div className="border-hairline-light bg-surface-soft/40 space-y-3 rounded-md border border-dashed p-4">
            <p className="text-ink text-xs font-medium">{t.sections.contract}</p>
            <div className="space-y-1.5">
              <label className="text-mute-light text-xs" htmlFor="ne-ct">
                {t.fields.contractType}
              </label>
              <select
                id="ne-ct"
                value={values.contractType}
                onChange={(e) =>
                  update("contractType", e.target.value as FormState["contractType"])
                }
                className={SELECT_CLASS}
              >
                <option value="">{c.notSet}</option>
                <option value="FIXED">{labels.venueProvider.contractTypes.FIXED}</option>
                <option value="PERFORMANCE">
                  {labels.venueProvider.contractTypes.PERFORMANCE}
                </option>
                <option value="OTHER">{labels.venueProvider.contractTypes.OTHER}</option>
              </select>
            </div>

            {values.contractType === "FIXED" ? (
              <div className="space-y-1.5">
                <label className="text-mute-light text-xs" htmlFor="ne-fee">
                  {t.fields.perDayFee}
                </label>
                <Input
                  id="ne-fee"
                  inputMode="decimal"
                  value={values.fixedFee}
                  onChange={(e) => update("fixedFee", e.target.value)}
                />
              </div>
            ) : null}

            {values.contractType === "PERFORMANCE" ? (
              <div className="space-y-1.5">
                <label className="text-mute-light text-xs" htmlFor="ne-rate">
                  {t.fields.revenueRate}
                </label>
                <Input
                  id="ne-rate"
                  inputMode="decimal"
                  value={values.performanceRate}
                  onChange={(e) => update("performanceRate", e.target.value)}
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label className="text-mute-light text-xs" htmlFor="ne-cnote">
                {t.fields.contractNote}
              </label>
              <textarea
                id="ne-cnote"
                rows={2}
                value={values.contractNote}
                onChange={(e) => update("contractNote", e.target.value)}
                className="border-hairline-light focus:ring-primary/30 w-full resize-none rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2"
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-danger text-sm font-medium">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {c.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? c.saving : t.actions.createSubmit}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
