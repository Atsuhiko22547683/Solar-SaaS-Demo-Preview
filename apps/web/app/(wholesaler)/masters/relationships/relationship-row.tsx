"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { updateRelationshipAction } from "./actions";

import type { DealerScopeValue, RelationshipListItem, RelationshipStatusValue } from "./data";
import type { ReactNode } from "react";

// Inline row for the 取引先一覧 table. Status / Scope are <select>s that
// auto-save on change; the note is a debounced text input that saves on blur.

/** 画面のプルダウンから選べるステータス（TERMINATED は削除操作のみ）。 */
type EditableStatus = Exclude<RelationshipStatusValue, "TERMINATED">;

const STATUS_PILL_CLASS: Record<EditableStatus, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  SUSPENDED: "bg-zinc-100 text-zinc-500 ring-zinc-200",
};

interface RelationshipRowProps {
  row: RelationshipListItem;
  /** 行末の操作（削除など）。行の編集責務とは分けて差し込む。 */
  action?: ReactNode;
}

export function RelationshipRow({ row, action }: RelationshipRowProps) {
  const router = useRouter();
  const t = labels.dealerRelationships;
  const c = labels.common;

  const [franchiseNo, setFranchiseNo] = useState<string>(row.franchiseNo ?? "");
  // 画面のプルダウンから選べるのは「有効 / 停止」だけ。TERMINATED（取引終了）は
  // 削除操作だけが設定する状態なので、選択肢には出さない。
  const [status, setStatus] = useState<EditableStatus>(
    row.status === "TERMINATED" ? "SUSPENDED" : row.status,
  );
  const [scope, setScope] = useState<DealerScopeValue>(row.defaultScope);
  const [note, setNote] = useState<string>(row.note ?? "");
  const [, startTransition] = useTransition();

  function save(patch: {
    franchiseNo?: string | null;
    status?: EditableStatus;
    defaultScope?: DealerScopeValue;
    note?: string | null;
  }) {
    startTransition(async () => {
      try {
        await updateRelationshipAction({ id: row.id, ...patch });
        toast.success(c.saved);
        router.refresh();
      } catch (err) {
        const message = err instanceof Error && err.message ? err.message : c.unknownError;
        toast.error(message);
      }
    });
  }

  return (
    <tr className="border-border border-t">
      <td className="px-3 py-2 font-medium">{row.dealerName}</td>
      <td className="px-3 py-2">
        <Input
          aria-label={t.fields.franchiseNo}
          value={franchiseNo}
          onChange={(e) => setFranchiseNo(e.target.value)}
          onBlur={() => {
            if ((row.franchiseNo ?? "") !== franchiseNo) {
              save({ franchiseNo: franchiseNo.trim().length === 0 ? null : franchiseNo.trim() });
            }
          }}
          className="h-9 max-w-[8rem] text-sm tabular-nums"
          placeholder={t.franchiseNoPlaceholder}
        />
      </td>
      <td className="px-3 py-2">
        <select
          aria-label={t.fields.status}
          value={status}
          onChange={(e) => {
            const next = e.target.value as EditableStatus;
            setStatus(next);
            save({ status: next });
          }}
          className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${STATUS_PILL_CLASS[status]}`}
        >
          <option value="ACTIVE">{t.statuses.ACTIVE}</option>
          <option value="SUSPENDED">{t.statuses.SUSPENDED}</option>
        </select>
      </td>
      <td className="px-3 py-2">
        <select
          aria-label={t.fields.defaultScope}
          value={scope}
          onChange={(e) => {
            const next = e.target.value as DealerScopeValue;
            setScope(next);
            save({ defaultScope: next });
          }}
          className="border-input bg-background flex h-9 w-full max-w-[10rem] rounded-md border px-3 py-1 text-sm"
        >
          <option value="APPOINTMENT_ONLY">{t.scopes.APPOINTMENT_ONLY}</option>
          <option value="FIRST_VISIT">{t.scopes.FIRST_VISIT}</option>
          <option value="FULL_CLOSING">{t.scopes.FULL_CLOSING}</option>
        </select>
      </td>
      <td className="px-3 py-2">
        <Input
          aria-label={t.fields.note}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if ((row.note ?? "") !== note) {
              save({ note: note.trim().length === 0 ? null : note.trim() });
            }
          }}
          className="h-9 text-sm"
          placeholder="—"
        />
      </td>
      <td className="text-mute-light px-3 py-2 text-xs">{formatDateTime(row.updatedAt)}</td>
      <td className="px-3 py-2 text-right">{action}</td>
    </tr>
  );
}
