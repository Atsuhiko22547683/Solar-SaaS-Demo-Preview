"use client";

// イベントへの販売員アサイン。
//
// EventShift（認証 User の勤務シフト）とは別概念で、こちらは販売員マスタ
// （Salesperson）から選ぶ。チェックした販売員が最終状態になる差し替え方式で、
// 保存は assignEventSalespeopleAction（salesperson.update 権限 + テナント境界）。

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { labels } from "@/lib/i18n/labels";

import { assignEventSalespeopleAction } from "../../salespeople/actions";

import type { SalespersonOption } from "../../salespeople/data";

interface SalespersonAssignProps {
  eventId: string;
  /** 現在アサイン済みの販売員 ID。 */
  assignedIds: string[];
  /** 選択肢（有効な販売員のみ）。 */
  candidates: SalespersonOption[];
  /** アサインを変更できるか（salesperson.update 権限を持つか）。 */
  canEdit: boolean;
}

export function SalespersonAssign({
  eventId,
  assignedIds,
  candidates,
  canEdit,
}: SalespersonAssignProps) {
  const t = labels.salespersonList.assign;
  const c = labels.common;
  const router = useRouter();

  const [selected, setSelected] = useState<string[]>(assignedIds);
  const [isPending, startTransition] = useTransition();

  const dirty =
    selected.length !== assignedIds.length || selected.some((id) => !assignedIds.includes(id));

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  function save() {
    startTransition(async () => {
      try {
        await assignEventSalespeopleAction({ eventId, salespersonIds: selected });
        toast.success(c.saved);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error && err.message ? err.message : c.unknownError);
      }
    });
  }

  if (candidates.length === 0) {
    return <p className="text-muted-foreground text-sm">{t.noCandidates}</p>;
  }

  // 参照のみのロールでは、アサイン済みの販売員をバッジで見せるだけにする。
  if (!canEdit) {
    if (assignedIds.length === 0) {
      return <p className="text-muted-foreground text-sm">{t.empty}</p>;
    }
    return (
      <div className="flex flex-wrap gap-2">
        {candidates
          .filter((s) => assignedIds.includes(s.id))
          .map((s) => (
            <Badge key={s.id} variant="secondary">
              {s.name}
            </Badge>
          ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">{t.hint}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(s.id)}
              disabled={isPending}
              onChange={() => toggle(s.id)}
              className="size-4"
            />
            <span className="text-ink">{s.name}</span>
            {/* 所属会社名は Relationship / 自テナントからの導出値。 */}
            <span className="text-mute-light text-xs">{s.companyName}</span>
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={save} disabled={isPending || !dirty}>
          {isPending ? t.saving : t.save}
        </Button>
      </div>
    </div>
  );
}
