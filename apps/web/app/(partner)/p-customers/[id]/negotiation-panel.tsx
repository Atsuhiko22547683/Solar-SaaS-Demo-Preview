"use client";

// 顧客の商談履歴と業務情報（パートナーポータル）。
//
// 上段: 現在の商談状況（商談ステータス / マエカク / 次回アポ / 次回アクション / 担当者）
// 下段: 接点の積み重ね（1 回目・2 回目 …）と、追記・修正
//
// 「契約済」への変更と「成約報告の提出」は別物。ステータスを変えても成約報告は
// 提出済みにならないので、そのことを画面に明記し、報告の導線を別に置く。

import Link from "next/link";
import { useState } from "react";

import { FIELD_CLASS, PartnerFormField, TEXTAREA_CLASS } from "@/components/partner/partner-form";
import { formatDateTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import {
  createPartnerActivityAction,
  updatePartnerActivityAction,
  updatePartnerNegotiationAction,
} from "./activity-actions";

import type { PartnerNegotiationView } from "../data";

const t = labels.partner.negotiation;
const c = labels.partner.common;

const CATEGORIES = [
  "tossup",
  "event",
  "appointment",
  "visit",
  "quote",
  "phone",
  "email",
  "other",
] as const;
const DEAL_STATUSES = ["negotiating", "contracted", "cancelled", "lost"] as const;
const MAEKAKU_STATUSES = ["pending", "done", "unnecessary"] as const;

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function NegotiationPanel({ data }: { data: PartnerNegotiationView }) {
  return (
    <div className="space-y-6">
      <StatusForm data={data} />
      <ActivityList data={data} />
      <ContractReportLink data={data} />
    </div>
  );
}

function StatusForm({ data }: { data: PartnerNegotiationView }) {
  const [dealStatus, setDealStatus] = useState(data.dealStatus);
  const [maekakuStatus, setMaekakuStatus] = useState(data.maekakuStatus ?? "");
  const [nextAt, setNextAt] = useState(toLocalInput(data.nextAppointmentAt));
  const [nextAction, setNextAction] = useState(data.nextAction ?? "");
  const [assignee, setAssignee] = useState(data.assigneeUserId ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      await updatePartnerNegotiationAction({
        customerId: data.customerId,
        dealStatus: dealStatus as (typeof DEAL_STATUSES)[number],
        maekakuStatus: maekakuStatus
          ? (maekakuStatus as (typeof MAEKAKU_STATUSES)[number])
          : undefined,
        nextAppointmentAt: nextAt,
        nextAction,
        assigneeUserId: assignee,
      });
      setMessage(t.status.saved);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t.errors.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h3 className="text-ink text-sm font-semibold">{t.status.title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <PartnerFormField label={t.status.dealStatus} htmlFor="dealStatus" required>
          <select
            id="dealStatus"
            value={dealStatus}
            onChange={(e) => setDealStatus(e.target.value)}
            className={FIELD_CLASS}
          >
            {DEAL_STATUSES.map((v) => (
              <option key={v} value={v}>
                {t.dealStatuses[v]}
              </option>
            ))}
          </select>
        </PartnerFormField>
        <PartnerFormField label={t.status.maekakuStatus} htmlFor="maekakuStatus">
          <select
            id="maekakuStatus"
            value={maekakuStatus}
            onChange={(e) => setMaekakuStatus(e.target.value)}
            className={FIELD_CLASS}
          >
            <option value="">{c.notSet}</option>
            {MAEKAKU_STATUSES.map((v) => (
              <option key={v} value={v}>
                {t.maekakuStatuses[v]}
              </option>
            ))}
          </select>
        </PartnerFormField>
        <PartnerFormField label={t.status.nextAppointmentAt} htmlFor="nextAt">
          <input
            id="nextAt"
            type="datetime-local"
            value={nextAt}
            onChange={(e) => setNextAt(e.target.value)}
            className={FIELD_CLASS}
          />
        </PartnerFormField>
        <PartnerFormField label={t.status.assignee} hint={t.status.assigneeHint} htmlFor="assignee">
          <select
            id="assignee"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className={FIELD_CLASS}
          >
            <option value="">{c.notSet}</option>
            {data.memberOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </PartnerFormField>
      </div>
      <PartnerFormField label={t.status.nextAction} htmlFor="nextAction">
        <textarea
          id="nextAction"
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
          rows={2}
          className={TEXTAREA_CLASS}
        />
      </PartnerFormField>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium text-white disabled:opacity-60 sm:h-9"
        >
          {pending ? c.saving : t.status.save}
        </button>
      </div>
      {message ? (
        <p role="alert" className="text-body-light text-sm">
          {message}
        </p>
      ) : null}
    </form>
  );
}

function ActivityList({ data }: { data: PartnerNegotiationView }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-ink text-sm font-semibold">{t.title}</h3>
        <button
          type="button"
          onClick={() => {
            setAdding((v) => !v);
            setEditing(null);
          }}
          className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 items-center rounded-md border px-3 text-sm sm:h-9"
        >
          {adding ? t.cancelEdit : t.add}
        </button>
      </div>
      <p className="text-mute-light text-[13px]">{t.hint}</p>

      {adding ? <ActivityForm data={data} onDone={() => setAdding(false)} /> : null}

      {data.activities.length === 0 ? (
        <p className="text-mute-light text-sm">{t.empty}</p>
      ) : (
        <ol className="space-y-2">
          {/* 新しいものを上に出しつつ、回数は古い順の通番（seq）を出す。 */}
          {[...data.activities].reverse().map((a) => (
            <li key={a.id} className="border-hairline-light rounded-md border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-ink text-sm font-medium">
                  <span className="text-primary mr-2 text-xs">
                    {t.seq.replace("{n}", String(a.seq))}
                  </span>
                  {t.categories[a.category as keyof typeof t.categories] ?? a.category}
                </p>
                <p className="text-mute-light text-xs tabular-nums">
                  {formatDateTime(a.occurredAt)}
                </p>
              </div>
              <p className="text-body-light mt-1 whitespace-pre-wrap break-words text-sm">
                {a.detail}
              </p>
              <p className="text-mute-light mt-1 text-xs">
                {a.venuePlace ? `${t.fields.event}: ${a.venuePlace} / ` : ""}
                {t.fields.assignee}: {a.assigneeName ?? c.dash} / {t.createdBy}:{" "}
                {a.createdByName ?? c.dash}
                {a.updatedByName ? ` / ${t.updatedBy}: ${a.updatedByName}` : ""}
              </p>
              {editing === a.id ? (
                <div className="mt-3">
                  <p className="text-mute-light mb-2 text-xs">{t.editHint}</p>
                  <ActivityForm data={data} initial={a} onDone={() => setEditing(null)} />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(a.id);
                    setAdding(false);
                  }}
                  className="text-primary mt-2 min-h-11 text-xs underline-offset-4 hover:underline sm:min-h-0"
                >
                  {c.edit}
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ActivityForm({
  data,
  initial,
  onDone,
}: {
  data: PartnerNegotiationView;
  initial?: PartnerNegotiationView["activities"][number];
  onDone: () => void;
}) {
  const [occurredAt, setOccurredAt] = useState(
    toLocalInput(initial?.occurredAt ?? new Date().toISOString()),
  );
  const [category, setCategory] = useState(initial?.category ?? "visit");
  const [detail, setDetail] = useState(initial?.detail ?? "");
  const [eventId, setEventId] = useState(initial?.eventId ?? "");
  const [assignee, setAssignee] = useState("");
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    const payload = {
      customerId: data.customerId,
      occurredAt,
      category: category as (typeof CATEGORIES)[number],
      detail,
      eventId,
      assigneeUserId: assignee,
      amount: amount ? Number(amount) : undefined,
    };
    try {
      if (initial) await updatePartnerActivityAction({ ...payload, id: initial.id });
      else await createPartnerActivityAction(payload);
      setMessage(t.saved);
      onDone();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t.errors.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="border-hairline-light space-y-3 rounded-md border p-3">
      <h4 className="text-ink text-sm font-semibold">{initial ? t.editTitle : t.addTitle}</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <PartnerFormField label={t.fields.occurredAt} htmlFor="occurredAt" required>
          <input
            id="occurredAt"
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className={FIELD_CLASS}
          />
        </PartnerFormField>
        <PartnerFormField label={t.fields.category} htmlFor="category" required>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={FIELD_CLASS}
          >
            {CATEGORIES.map((v) => (
              <option key={v} value={v}>
                {t.categories[v]}
              </option>
            ))}
          </select>
        </PartnerFormField>
        <PartnerFormField label={t.fields.event} htmlFor="eventId">
          <select
            id="eventId"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className={FIELD_CLASS}
          >
            <option value="">{t.fields.eventNone}</option>
            {data.eventOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </PartnerFormField>
        <PartnerFormField
          label={t.fields.assignee}
          hint={t.fields.assigneeHint}
          htmlFor="activityAssignee"
        >
          <select
            id="activityAssignee"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className={FIELD_CLASS}
          >
            <option value="">{c.notSet}</option>
            {data.memberOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </PartnerFormField>
        {category === "quote" ? (
          <PartnerFormField label={t.fields.amount} htmlFor="amount">
            <input
              id="amount"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={FIELD_CLASS}
            />
          </PartnerFormField>
        ) : null}
      </div>
      <PartnerFormField label={t.fields.detail} htmlFor="detail" required>
        <textarea
          id="detail"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={3}
          className={TEXTAREA_CLASS}
        />
      </PartnerFormField>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onDone}
          className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 items-center justify-center rounded-md border px-4 text-sm"
        >
          {t.cancelEdit}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="bg-primary inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? c.saving : t.save}
        </button>
      </div>
      {message ? (
        <p role="alert" className="text-body-light text-sm">
          {message}
        </p>
      ) : null}
    </form>
  );
}

function ContractReportLink({ data }: { data: PartnerNegotiationView }) {
  return (
    <section className="border-hairline-light rounded-md border p-3">
      <h3 className="text-ink text-sm font-semibold">{t.contractReport.title}</h3>
      {/* ステータス変更と提出は別物であることを画面に出す。 */}
      <p className="text-mute-light mt-1 text-[13px]">{t.contractReport.note}</p>
      <p className="text-mute-light mt-1 text-xs">{t.contractReport.noContractNote}</p>
      <p className="text-body-light mt-2 text-[13px]">
        {t.contractReport.countLabel.replace("{n}", String(data.contractReportCount))}
      </p>
      <Link
        href="/p-contracts/new"
        className="bg-primary mt-2 inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium text-white sm:h-9"
      >
        {t.contractReport.open}
      </Link>
    </section>
  );
}
