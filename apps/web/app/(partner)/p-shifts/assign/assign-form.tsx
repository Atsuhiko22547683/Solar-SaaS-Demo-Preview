"use client";

// 催事シフトの一括配置（パートナー管理者）。
//
// 操作の流れ:
//   1. 月内の対象催事・開催日をまとめて選ぶ（複数日催事は日ごとの行になる）
//   2. 予定時間を確認・調整する（初期値は開催日の開催時間）
//   3. スタッフを複数選ぶ — 選んだ時間帯に別の催事へ入っている人は選べない
//   4. 役割（キャッチ / トス）を選んで配置する
//
// 重複の除外はここ（候補表示）と Server Action（保存時）と DB 制約の三重。
// 画面だけで防いだことにはしない。
//
// 最終的な配置は管理者が決める。移動条件は参考情報として出すだけで、
// 自動で最短の人へ割り当てたりはしない。

import { useMemo, useState } from "react";

import {
  FIELD_CLASS,
  PartnerFormActions,
  PartnerFormField,
  TEXTAREA_CLASS,
} from "@/components/partner/partner-form";
import { labels } from "@/lib/i18n/labels";

import { assignPartnerShiftsAction } from "../actions";

import type { AssignFormData, AssignStaffOption, AssignTargetOption } from "../data";

const t = labels.partner.shift;
const c = labels.partner.common;

/** 'YYYY-MM-DDTHH:MM'（datetime-local の値）。 */
function toLocalInput(iso: string | null, fallbackDate: string, fallbackTime: string): string {
  if (iso) {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${fallbackDate}T${fallbackTime}`;
}

function targetKey(target: AssignTargetOption): string {
  return `${target.eventId}:${target.eventDayId ?? "none"}`;
}

/** 半開区間の重なり。候補の除外表示に使う（サーバー側でも同じ規則で検証する）。 */
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function ShiftAssignForm({ data }: { data: AssignFormData }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // 予定時間は対象ごとに持つ（開催時間が日によって違うため）。
  const [times, setTimes] = useState<Record<string, { start: string; end: string }>>(() => {
    const init: Record<string, { start: string; end: string }> = {};
    for (const target of data.targets) {
      init[targetKey(target)] = {
        // 開催時間が未登録の日は空にせず、業務の標準時間を置いて必ず見直させる。
        start: toLocalInput(target.startAt, target.date, "10:00"),
        end: toLocalInput(target.endAt, target.date, "18:00"),
      };
    }
    return init;
  });
  const [userIds, setUserIds] = useState<Set<string>>(new Set());
  const [role, setRole] = useState<"CATCH" | "TOSS">("CATCH");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedTargets = useMemo(
    () => data.targets.filter((target) => selected.has(targetKey(target))),
    [data.targets, selected],
  );

  /** 選んだ時間帯のどれかと重なるスタッフは選べない。 */
  const busyReason = useMemo(() => {
    const map = new Map<string, boolean>();
    if (selectedTargets.length === 0) return map;
    const windows = selectedTargets.map((target) => {
      const tm = times[targetKey(target)]!;
      return [new Date(tm.start).getTime(), new Date(tm.end).getTime()] as const;
    });
    for (const staff of data.staff) {
      const busy = staff.busy.some((b) => {
        const bs = new Date(b.start).getTime();
        const be = new Date(b.end).getTime();
        return windows.some(([ws, we]) => overlaps(ws, we, bs, be));
      });
      map.set(staff.userId, busy);
    }
    return map;
  }, [data.staff, selectedTargets, times]);

  const toggleTarget = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleUser = (id: string) => {
    setUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (selectedTargets.length === 0) {
      setMessage(t.errors.noTarget);
      return;
    }
    if (userIds.size === 0) {
      setMessage(t.errors.noStaff);
      return;
    }
    setPending(true);
    try {
      const result = await assignPartnerShiftsAction({
        targets: selectedTargets.map((target) => {
          const tm = times[targetKey(target)]!;
          return {
            eventId: target.eventId,
            eventDayId: target.eventDayId ?? undefined,
            startPlanned: tm.start,
            endPlanned: tm.end,
          };
        }),
        userIds: Array.from(userIds),
        role,
        note,
      });
      setMessage(`${t.assign.done}（${result.created}件）`);
      setSelected(new Set());
      setUserIds(new Set());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t.errors.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section aria-label={t.assign.targets}>
        <h2 className="text-ink text-sm font-semibold">{t.assign.targets}</h2>
        <p className="text-mute-light mb-2 text-[13px]">{t.assign.targetsHint}</p>
        {data.targets.length === 0 ? (
          <p className="text-mute-light text-sm">{t.assign.targetsEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {data.targets.map((target) => {
              const key = targetKey(target);
              const checked = selected.has(key);
              const tm = times[key]!;
              return (
                <li key={key} className="border-hairline-light rounded-md border p-3">
                  <label className="flex min-h-11 items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTarget(key)}
                      className="mt-1 h-5 w-5 shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="text-ink block font-medium">{target.venuePlace}</span>
                      <span className="text-mute-light block text-xs tabular-nums">
                        {target.date} / {target.originName}
                        {target.startAt ? "" : ` / ${t.timeUnknown}`}
                        {target.assignedCount > 0
                          ? ` / ${t.staffCount.replace("{n}", String(target.assignedCount))}`
                          : ""}
                      </span>
                    </span>
                  </label>
                  {checked ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <PartnerFormField label={`${t.planned}（開始）`} htmlFor={`start-${key}`}>
                        <input
                          id={`start-${key}`}
                          type="datetime-local"
                          value={tm.start}
                          onChange={(e) =>
                            setTimes((prev) => ({
                              ...prev,
                              [key]: { ...tm, start: e.target.value },
                            }))
                          }
                          className={FIELD_CLASS}
                        />
                      </PartnerFormField>
                      <PartnerFormField label={`${t.planned}（終了）`} htmlFor={`end-${key}`}>
                        <input
                          id={`end-${key}`}
                          type="datetime-local"
                          value={tm.end}
                          onChange={(e) =>
                            setTimes((prev) => ({ ...prev, [key]: { ...tm, end: e.target.value } }))
                          }
                          className={FIELD_CLASS}
                        />
                      </PartnerFormField>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label={t.assign.staff}>
        <h2 className="text-ink text-sm font-semibold">{t.assign.staff}</h2>
        <p className="text-mute-light mb-2 text-[13px]">{t.assign.staffHint}</p>
        <p className="text-mute-light mb-2 text-[13px]">{t.assign.travelHint}</p>
        {selectedTargets.length === 0 ? (
          <p className="text-mute-light text-sm">{t.assign.selectTargetsFirst}</p>
        ) : data.staff.length === 0 ? (
          <p className="text-mute-light text-sm">{t.assign.staffEmpty}</p>
        ) : (
          <ul className="space-y-1">
            {data.staff.map((staff: AssignStaffOption) => {
              const busy = busyReason.get(staff.userId) ?? false;
              return (
                <li key={staff.userId}>
                  <label
                    className={[
                      "flex min-h-11 items-center gap-2 rounded-md px-1 text-sm",
                      busy ? "text-mute-light/70" : "text-ink",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={userIds.has(staff.userId)}
                      onChange={() => toggleUser(staff.userId)}
                      disabled={busy}
                      className="h-5 w-5 shrink-0"
                    />
                    <span className="min-w-0">
                      {staff.name}
                      {staff.isGuest ? (
                        <span className="text-mute-light ml-1 text-xs">（ゲスト）</span>
                      ) : null}
                      {busy ? (
                        <span className="text-mute-light ml-1 text-xs">{t.assign.busyNote}</span>
                      ) : null}
                      {/* 移動条件は参考情報。所要時間・運賃は実連携が入るまで出さない
                          （直線距離や推定値を検索結果として見せない）。 */}
                      <span className="text-mute-light block text-xs">
                        {t.assign.travelTitle}: {staff.homeAddress ?? t.assign.homeAddressUnset} /{" "}
                        {t.assign.transitUnavailable}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <PartnerFormField label={t.assign.role} htmlFor="role" required hint={t.roleHints[role]}>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as "CATCH" | "TOSS")}
            className={FIELD_CLASS}
          >
            <option value="CATCH">{t.roles.CATCH}</option>
            <option value="TOSS">{t.roles.TOSS}</option>
          </select>
        </PartnerFormField>
        <PartnerFormField label={t.assign.note} htmlFor="note">
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={TEXTAREA_CLASS}
          />
        </PartnerFormField>
      </div>

      <PartnerFormActions
        submitLabel={t.assign.submit}
        pending={pending}
        pendingLabel={t.assign.submitting}
        cancelHref="/p-shifts"
        cancelLabel={c.cancel}
        error={message}
      />
    </form>
  );
}
