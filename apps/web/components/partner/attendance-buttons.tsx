"use client";

// 催事シフトの出退勤ボタン（本人の打刻）。
//
// 時刻はサーバー側で決めるので、ここは「どのシフトか」だけを送る。
// 送信中はボタンを無効にして連打で二重送信しない（サーバー側でも二重記録を作らない）。

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { clockInAction, clockOutAction } from "@/app/(partner)/p-shifts/attendance-actions";
import { labels } from "@/lib/i18n/labels";

import type { AttendanceState } from "@solar/contracts";

const t = labels.partner.attendance;

const BTN =
  "inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60 sm:h-9";

export function AttendanceButtons({
  shiftId,
  state,
  canClock,
}: {
  shiftId: string;
  state: AttendanceState;
  /** 開催日当日か。当日でなければ押せない（サーバー側でも同じ条件で弾く）。 */
  canClock: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function punch(kind: "in" | "out") {
    setError(null);
    startTransition(async () => {
      try {
        const res =
          kind === "in" ? await clockInAction({ shiftId }) : await clockOutAction({ shiftId });
        // 既に記録済みだったときは時刻を動かさない（連打・再送のため）。
        toast.success(
          res.alreadyDone
            ? t.state[kind === "in" ? "WORKING" : "DONE"]
            : kind === "in"
              ? t.clockIn
              : t.clockOut,
        );
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error && err.message ? err.message : labels.common.unknownError;
        setError(message);
        toast.error(message);
      }
    });
  }

  if (state === "DONE") {
    return <p className="text-mute-light text-xs">{t.doneHint}</p>;
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        {state === "NOT_CHECKED_IN" ? (
          <button
            type="button"
            className={`${BTN} bg-primary text-white`}
            disabled={pending || !canClock}
            onClick={() => punch("in")}
          >
            {pending ? `${t.clockIn}…` : t.clockIn}
          </button>
        ) : (
          <button
            type="button"
            className={`${BTN} border-hairline-light text-ink hover:bg-surface-soft border`}
            disabled={pending}
            onClick={() => punch("out")}
          >
            {pending ? `${t.clockOut}…` : t.clockOut}
          </button>
        )}
      </div>
      {state === "NOT_CHECKED_IN" && !canClock ? (
        <p className="text-mute-light text-xs">{t.notTodayHint}</p>
      ) : null}
      {state === "NOT_CHECKED_IN" && canClock ? (
        <p className="text-mute-light text-xs">{t.needCheckInHint}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
