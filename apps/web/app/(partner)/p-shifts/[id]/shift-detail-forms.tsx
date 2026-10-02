"use client";

// シフト 1 件の予定・実績の編集（パートナー管理者）。
//
// 予定（startPlanned / endPlanned）と実績（startActual / endActual）は別のフォームにする。
// 実績を入れても予定は変わらない。実績は重複判定に使わないので、実績だけ直しても
// 将来の配置や候補の除外結果は変わらない。

import { useState } from "react";

import {
  FIELD_CLASS,
  PartnerFormActions,
  PartnerFormField,
} from "@/components/partner/partner-form";
import { labels } from "@/lib/i18n/labels";

import {
  unassignPartnerShiftAction,
  updatePartnerShiftActualAction,
  updatePartnerShiftPlanAction,
} from "../actions";

import type { ShiftDetailView } from "../data";

const t = labels.partner.shift;
const c = labels.partner.common;

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 新規配置で選べる役割。旧値の行はそのまま残し、選び直したときだけ置き換える。 */
const ROLE_VALUES = ["CATCH", "TOSS"] as const;

export function ShiftPlanForm({ shift }: { shift: ShiftDetailView }) {
  const [start, setStart] = useState(toLocalInput(shift.startPlanned));
  const [end, setEnd] = useState(toLocalInput(shift.endPlanned));
  const isPrimaryRole = (ROLE_VALUES as readonly string[]).includes(shift.role);
  const [role, setRole] = useState<string>(isPrimaryRole ? shift.role : "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      await updatePartnerShiftPlanAction({
        shiftId: shift.shiftId,
        // 旧役割のままにしたいときは送らない（勝手にキャッチ / トスへ読み替えない）。
        role: role === "CATCH" || role === "TOSS" ? role : undefined,
        startPlanned: start,
        endPlanned: end,
      });
      setMessage(t.planForm.saved);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t.errors.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <PartnerFormField label={`${t.planned}（開始）`} htmlFor="startPlanned" required>
          <input
            id="startPlanned"
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={FIELD_CLASS}
          />
        </PartnerFormField>
        <PartnerFormField label={`${t.planned}（終了）`} htmlFor="endPlanned" required>
          <input
            id="endPlanned"
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={FIELD_CLASS}
          />
        </PartnerFormField>
        <PartnerFormField label={t.columns.role} htmlFor="role">
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={FIELD_CLASS}
          >
            {/* 旧役割の行は、選び直さないかぎりそのまま。 */}
            {!isPrimaryRole ? (
              <option value="">
                {(t.rolesLegacy as Record<string, string>)[shift.role] ?? shift.role}
              </option>
            ) : null}
            <option value="CATCH">{t.roles.CATCH}</option>
            <option value="TOSS">{t.roles.TOSS}</option>
          </select>
        </PartnerFormField>
      </div>
      <PartnerFormActions
        submitLabel={t.planForm.save}
        pending={pending}
        pendingLabel={c.saving}
        cancelHref="/p-shifts"
        cancelLabel={c.backToList}
        error={message}
      />
    </form>
  );
}

export function ShiftActualForm({ shift }: { shift: ShiftDetailView }) {
  const [start, setStart] = useState(toLocalInput(shift.startActual));
  const [end, setEnd] = useState(toLocalInput(shift.endActual));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      await updatePartnerShiftActualAction({
        shiftId: shift.shiftId,
        startActual: start,
        endActual: end,
      });
      setMessage(t.actualForm.saved);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t.errors.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-mute-light text-[13px]">{t.actualForm.hint}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <PartnerFormField label={t.actualForm.startActual} htmlFor="startActual">
          <input
            id="startActual"
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={FIELD_CLASS}
          />
        </PartnerFormField>
        <PartnerFormField label={t.actualForm.endActual} htmlFor="endActual">
          <input
            id="endActual"
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={FIELD_CLASS}
          />
        </PartnerFormField>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => {
            setStart("");
            setEnd("");
          }}
          className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 items-center justify-center rounded-md border px-4 text-sm"
        >
          {t.actualForm.clear}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="bg-primary inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? c.saving : t.actualForm.save}
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

export function ShiftUnassignForm({ shiftId }: { shiftId: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      await unassignPartnerShiftAction({ shiftId });
      setMessage(t.unassigned2);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t.errors.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="bg-danger inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-medium text-white disabled:opacity-60 sm:w-auto"
        >
          {t.unassign}
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
