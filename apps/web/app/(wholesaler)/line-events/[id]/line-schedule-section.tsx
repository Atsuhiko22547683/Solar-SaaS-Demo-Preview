"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { AcquiredAppointmentsTable } from "@/components/reports/acquired-appointments-table";
import { DealerReportsSection } from "@/components/reports/dealer-reports-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { labels } from "@/lib/i18n/labels";

import { updateLineDatesAction } from "./actions";

import type { AcquiredAppointmentRow } from "@/app/(wholesaler)/event-detail/acquired-appointment-data";
import type { DealerEventReportBundle } from "@/app/(wholesaler)/event-detail/dealer-report-data";

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

// 日報が 1 件も無い日の集計。0 を並べるだけで、件数を作らない。
const EMPTY_SUMMARY = {
  lotteryTotal: 0,
  seatedTotal: 0,
  apptTotal: 0,
  countedReports: 0,
  unknownScopeReports: 0,
  boothReports: 0,
  supersededReports: 0,
};

// 月曜始まりの曜日ヘッダー（登録ダイアログと統一）。
const MON_WEEK_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

// 月曜始まりでの列インデックス（月=0 … 日=6）に変換する。
function mondayColumn(dow: number): number {
  return (dow + 6) % 7;
}

// Timezone-safe local-date helpers (CLAUDE.md 注意事項 / toISOString は使わない)。
function daysInMonth(targetMonth: string): number {
  const [y, m] = targetMonth.split("-").map(Number);
  if (!y || !m) return 0;
  return new Date(y, m, 0).getDate();
}

function dayStr(targetMonth: string, day: number): string {
  return `${targetMonth}-${String(day).padStart(2, "0")}`;
}

function dayOfWeek(targetMonth: string, day: number): number {
  const [y, m] = targetMonth.split("-").map(Number);
  return new Date(y!, m! - 1, day).getDay();
}

function dowColor(dow: number): string {
  return dow === 0 ? "text-danger" : dow === 6 ? "text-link-light" : "text-mute-light";
}

// 開催予定日チップ用ラベル（6/03(水) 形式）。曜日色付けのため dow も返す。
function chipLabel(targetMonth: string, day: number): { text: string; dow: number } {
  const [, m] = targetMonth.split("-").map(Number);
  const dow = dayOfWeek(targetMonth, day);
  return { text: `${m}/${String(day).padStart(2, "0")}(${DAY_LABELS[dow]})`, dow };
}

interface LineScheduleSectionProps {
  lineEventId: string;
  targetMonth: string;
  scheduledDates: string[];
  contractNote: string | null;
  /**
   * このレーンで確定した催事に提出された日報を、開催日 'YYYY-MM-DD' ごとに束ねたもの。
   * サーバー側で DB から読んで渡す。日付が無ければその日は日報なし。
   */
  reportsByDate: Record<string, DealerEventReportBundle>;
  /** 開催日ごとの獲得アポイント。サーバー側で DB から読んで渡す。 */
  appointmentsByDate: Record<string, AcquiredAppointmentRow[]>;
}

export function LineScheduleSection({
  lineEventId,
  targetMonth,
  scheduledDates,
  contractNote,
  reportsByDate,
  appointmentsByDate,
}: LineScheduleSectionProps) {
  const router = useRouter();
  const t = labels.lineEvent;
  const c = labels.common;

  const [editOpen, setEditOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set(scheduledDates));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 日付ポップアップ — null のとき非表示。値は YYYY-MM-DD。
  const [popupDate, setPopupDate] = useState<string | null>(null);

  const total = daysInMonth(targetMonth);
  const days = useMemo(() => Array.from({ length: total }, (_, i) => i + 1), [total]);

  const held = useMemo(() => new Set(scheduledDates), [scheduledDates]);
  const heldDays = days.filter((d) => held.has(dayStr(targetMonth, d)));

  function openEdit() {
    setSelectedDates(new Set(scheduledDates));
    setError(null);
    setEditOpen(true);
  }

  function toggleDate(date: string) {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  function handleSave() {
    setError(null);
    if (selectedDates.size === 0) {
      setError(t.errors.scheduledDatesRequired);
      return;
    }
    startTransition(async () => {
      try {
        await updateLineDatesAction({
          id: lineEventId,
          scheduledDates: Array.from(selectedDates).sort(),
        });
        toast.success(c.saved);
        setEditOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : c.unknownError);
      }
    });
  }

  // ポップアップタイトル「YYYY年M月D日(曜)」。
  const popupTitle = useMemo(() => {
    if (!popupDate) return "";
    const [y, m, d] = popupDate.split("-").map(Number);
    const dow = new Date(y!, m! - 1, d!).getDay();
    return t.datePopup.titleFormat
      .replace("{year}", String(y))
      .replace("{month}", String(m))
      .replace("{day}", String(d))
      .replace("{dow}", DAY_LABELS[dow] ?? "");
  }, [popupDate, t.datePopup.titleFormat]);

  // その日の日報。DB にある提出だけを出す（表示のたびに実績を作らない）。
  const popupBundle = popupDate ? (reportsByDate[popupDate] ?? null) : null;

  // その日に獲得したアポイント。DB にある行だけを出す。
  const popupAppointments = popupDate ? (appointmentsByDate[popupDate] ?? []) : [];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{t.sections.schedule}</CardTitle>
          <Button variant="outline" size="sm" onClick={openEdit}>
            {t.editSchedule.button}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* 左: 月カレンダー（月曜始まり） */}
            <div className="lg:col-span-2">
              <div className="border-hairline-light rounded-md border p-3">
                {/* 曜日ヘッダー */}
                <div className="mb-1.5 grid grid-cols-7 gap-1.5">
                  {MON_WEEK_LABELS.map((d, i) => (
                    <div
                      key={d}
                      className={[
                        "text-center text-xs font-medium",
                        i === 5 ? "text-link-light" : i === 6 ? "text-danger" : "text-mute-light",
                      ].join(" ")}
                    >
                      {d}
                    </div>
                  ))}
                </div>
                {/* 日付グリッド */}
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({
                    length: total > 0 ? mondayColumn(dayOfWeek(targetMonth, 1)) : 0,
                  }).map((_, i) => (
                    <div
                      key={`blank-${i}`}
                      className="border-hairline-light/50 bg-surface-soft/40 rounded-md border py-2.5"
                    />
                  ))}
                  {days.map((day) => {
                    const ds = dayStr(targetMonth, day);
                    const isHeld = held.has(ds);
                    return (
                      <button
                        key={ds}
                        type="button"
                        onClick={isHeld ? () => setPopupDate(ds) : undefined}
                        disabled={!isHeld}
                        className={[
                          "relative flex flex-col items-center justify-center rounded-md border py-2.5 text-sm",
                          isHeld
                            ? "border-primary bg-primary cursor-pointer font-semibold text-white hover:shadow-sm"
                            : "border-hairline-light text-body-light cursor-default",
                        ].join(" ")}
                      >
                        <span className="tabular-nums leading-tight">{day}</span>
                        {isHeld && (
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            className="mt-0.5"
                          >
                            <path
                              d="M2.5 6L5 8.5L9.5 3.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* 凡例 */}
                <div className="text-mute-light mt-3 flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="bg-primary inline-block h-3 w-3 rounded-sm" />
                    {t.calendar.held}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="border-hairline-light/50 bg-surface-soft/40 inline-block h-3 w-3 rounded-sm border" />
                    {t.calendar.outOfRange}
                  </span>
                </div>
              </div>
            </div>

            {/* 右: 開催予定日 / 開催回数 / 備考 */}
            <div className="space-y-5">
              <div>
                <p className="text-mute-light mb-2 text-xs font-semibold">
                  {t.calendar.scheduledDatesHeading}
                </p>
                {heldDays.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {heldDays.map((day) => {
                      const { text, dow } = chipLabel(targetMonth, day);
                      const ds = dayStr(targetMonth, day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setPopupDate(ds)}
                          className={[
                            "border-hairline-light bg-surface-soft/40 hover:border-primary/40 hover:bg-primary/5 inline-flex cursor-pointer items-center rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                            dowColor(dow),
                          ].join(" ")}
                        >
                          {text}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-mute-light text-sm">—</p>
                )}
              </div>

              <div>
                <p className="text-mute-light mb-1 text-xs font-semibold">
                  {t.calendar.holdingCount}
                </p>
                <p className="text-ink text-sm font-semibold">
                  {scheduledDates.length}
                  {t.holdingCountSuffix}
                </p>
              </div>

              <div>
                <p className="text-mute-light mb-1 text-xs font-semibold">{t.calendar.note}</p>
                <p className="text-ink whitespace-pre-wrap text-sm">{contractNote || "—"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 開催日編集ダイアログ — 登録ダイアログのカレンダーUI（月曜始まり）を踏襲 */}
      <Dialog
        open={editOpen}
        onOpenChange={(next) => {
          setEditOpen(next);
          if (!next) setError(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.editSchedule.dialogTitle}</DialogTitle>
          </DialogHeader>

          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-mute-light text-xs font-semibold">
                {t.fields.scheduledDates} <span className="text-danger">*</span>
              </label>
              <span className="text-mute-light text-xs tabular-nums">
                {t.form.selectedCount.replace("{n}", String(selectedDates.size))}
              </span>
            </div>
            <div className="border-hairline-light rounded-md border p-3">
              {/* 曜日ヘッダー（月曜始まり） */}
              <div className="mb-1.5 grid grid-cols-7 gap-1.5">
                {MON_WEEK_LABELS.map((w, i) => (
                  <div
                    key={w}
                    className={[
                      "text-center text-[10px] font-medium",
                      i === 5 ? "text-link-light" : i === 6 ? "text-danger" : "text-mute-light",
                    ].join(" ")}
                  >
                    {w}
                  </div>
                ))}
              </div>
              {/* 日付グリッド */}
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({
                  length: total > 0 ? mondayColumn(dayOfWeek(targetMonth, 1)) : 0,
                }).map((_, i) => (
                  <div key={`blank-${i}`} aria-hidden />
                ))}
                {days.map((day) => {
                  const ds = dayStr(targetMonth, day);
                  const dow = dayOfWeek(targetMonth, day);
                  const checked = selectedDates.has(ds);
                  const numColor = dow === 0 ? "text-danger" : dow === 6 ? "text-link-light" : "";
                  return (
                    <button
                      key={ds}
                      type="button"
                      onClick={() => toggleDate(ds)}
                      className={[
                        "flex items-center justify-center rounded-md border py-2 text-sm tabular-nums transition-colors",
                        checked
                          ? "border-primary bg-primary font-semibold text-white"
                          : `border-hairline-light hover:bg-surface-soft/50 ${numColor || "text-body-light"}`,
                      ].join(" ")}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <p role="alert" className="text-danger text-sm font-medium">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                {c.cancel}
              </Button>
              <Button type="button" onClick={handleSave} disabled={pending}>
                {pending ? c.saving : t.editSchedule.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 日付ポップアップ — 日報は DB の提出をそのまま出す。 */}
      <Dialog open={popupDate != null} onOpenChange={(next) => !next && setPopupDate(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{popupTitle}</DialogTitle>
          </DialogHeader>

          <div className="mt-2 space-y-6">
            {/* 日報・実績（パートナー会社）— 単発の催事詳細と同じ見せ方に揃える。 */}
            <DealerReportsSection bundle={popupBundle ?? { rows: [], summary: EMPTY_SUMMARY }} />

            {/* アポ取り顧客一覧 — イベントで獲得したアポ顧客（デモ値、成果のアポ数に整合） */}
            <div>
              <p className="text-ink mb-2 text-sm font-semibold">
                {t.datePopup.appointmentSection}
              </p>
              <AcquiredAppointmentsTable rows={popupAppointments} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
