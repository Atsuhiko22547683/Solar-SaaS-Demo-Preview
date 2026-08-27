"use client";

// 一覧セル内でステータスを直接変更するための小さなセレクト。
//
// 行クリックが「詳細へ遷移」になっている一覧で使うため、クリック／キー操作の伝播を
// 止めて誤遷移を防ぐ。値を変えた時点で onCommit を呼び、保存後は router.refresh() で
// 一覧へ即時反映する（保存の実体は各一覧が渡す既存の Server Action）。

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { labels } from "@/lib/i18n/labels";

const SELECT_CLASS =
  "h-8 rounded-sm border border-hairline-light bg-white px-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-surface-soft";

export interface InlineSelectOption {
  value: string;
  label: string;
}

interface InlineSelectInputProps {
  /** 現在値。未設定は "" を渡す。 */
  value: string;
  options: InlineSelectOption[];
  /** 未設定を選べるようにする場合の表示名。省略すると未設定の選択肢を出さない。 */
  unsetLabel?: string;
  ariaLabel: string;
  /** 保存処理。未設定を選んだときは "" が渡る。 */
  onCommit: (next: string) => Promise<unknown>;
}

export function InlineSelectInput({
  value,
  options,
  unsetLabel,
  ariaLabel,
  onCommit,
}: InlineSelectInputProps) {
  const c = labels.common;
  const router = useRouter();
  const [draft, setDraft] = useState(value);
  const [isPending, startTransition] = useTransition();

  // 一覧が再取得されたら（並び替え・検索・他行の保存）サーバ値へ追随する。
  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit(next: string) {
    setDraft(next);
    startTransition(async () => {
      try {
        await onCommit(next);
        toast.success(c.saved);
        router.refresh();
      } catch (err) {
        // 失敗したら表示をサーバ値へ戻す（画面と DB が食い違ったままにしない）。
        setDraft(value);
        toast.error(err instanceof Error && err.message ? err.message : c.unknownError);
      }
    });
  }

  return (
    <select
      value={draft}
      disabled={isPending}
      aria-label={ariaLabel}
      className={SELECT_CLASS}
      // 行クリック（詳細へ遷移）と取り違えないよう、この入力の操作は伝播させない。
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onChange={(e) => commit(e.target.value)}
    >
      {unsetLabel !== undefined && <option value="">{unsetLabel}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
