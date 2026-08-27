"use client";

// 一覧セル内で日付を直接編集するための小さな入力。
//
// 行クリックが「詳細へ遷移」になっている一覧で使うため、クリック／キー操作の伝播を
// 止めて誤遷移を防ぐ。値を変えた時点で onCommit を呼び、保存後は router.refresh() で
// 一覧へ即時反映する（保存の実体は各一覧が渡す既存の Server Action）。
//
// 空にすると null を渡す = 未設定へ戻せる。

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { labels } from "@/lib/i18n/labels";

/** ISO → <input type="date"> 用 YYYY-MM-DD（ローカル日付）。既存の日付項目と同じ変換。 */
export function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

const INPUT_CLASS =
  "h-8 w-36 rounded-sm border border-hairline-light bg-white px-2 text-sm text-ink tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-surface-soft";

interface InlineDateInputProps {
  /** 現在値（ISO 文字列 / 未設定は null）。 */
  value: string | null;
  /** スクリーンリーダー用のラベル（列名 + 対象が分かる文言）。 */
  ariaLabel: string;
  /** 保存処理。空欄のときは null が渡る。 */
  onCommit: (next: string | null) => Promise<unknown>;
}

export function InlineDateInput({ value, ariaLabel, onCommit }: InlineDateInputProps) {
  const c = labels.common;
  const router = useRouter();
  const [draft, setDraft] = useState(() => toDateInputValue(value));
  const [isPending, startTransition] = useTransition();

  // 一覧が再取得されたら（並び替え・検索・他行の保存）サーバ値へ追随する。
  useEffect(() => {
    setDraft(toDateInputValue(value));
  }, [value]);

  function commit(next: string) {
    setDraft(next);
    startTransition(async () => {
      try {
        await onCommit(next || null);
        toast.success(c.saved);
        router.refresh();
      } catch (err) {
        // 失敗したら表示をサーバ値へ戻す（画面と DB が食い違ったままにしない）。
        setDraft(toDateInputValue(value));
        toast.error(err instanceof Error && err.message ? err.message : c.unknownError);
      }
    });
  }

  return (
    <input
      type="date"
      value={draft}
      disabled={isPending}
      aria-label={ariaLabel}
      className={INPUT_CLASS}
      // 行クリック（詳細へ遷移）と取り違えないよう、この入力の操作は伝播させない。
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onChange={(e) => commit(e.target.value)}
    />
  );
}
