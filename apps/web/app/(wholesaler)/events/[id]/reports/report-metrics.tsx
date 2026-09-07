"use client";

// 成果報告の「追加集計項目」セクション。
//
// 既存の固定集計項目（アプローチ数 / 着座数 / アポ取得数 / 所感）は
// ResultReportForm 側の仕様のままで、ここでは一切触らない。
// このセクションは催事ごとに増える数値項目だけを扱う（例:「カインズPay対応数 12」）。
//
// 汎用カスタムフィールドではないので、行は常に「項目名 + 0 以上の整数」の 2 列。
// 型選択・選択肢・条件表示は持たせない。

import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { labels } from "@/lib/i18n/labels";

import {
  createEventReportMetricAction,
  deleteEventReportMetricAction,
  updateEventReportMetricAction,
} from "./metric-actions";

export interface ReportMetricRow {
  id: string;
  name: string;
  value: number;
}

interface ReportMetricsProps {
  /** 成果報告がまだ未提出なら null（そのときは案内文のみ出す）。 */
  reportId: string | null;
  metrics: ReportMetricRow[];
}

function parseNonNegInt(v: string): number | null {
  if (!/^\d+$/.test(v.trim())) return null;
  const n = Number.parseInt(v, 10);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

export function ReportMetrics({ reportId, metrics }: ReportMetricsProps) {
  const t = labels.eventReport.metrics;
  const c = labels.common;

  const [newName, setNewName] = useState("");
  const [newValue, setNewValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editValue, setEditValue] = useState("");
  const [pending, startTransition] = useTransition();

  if (!reportId) {
    return <p className="text-muted-foreground text-sm">{t.needsResultReport}</p>;
  }
  // 早期 return 済みなので以降は非 null。クロージャ内でも narrowing を保つため束縛する。
  const boundReportId = reportId;

  function fail(err: unknown) {
    toast.error(err instanceof Error && err.message ? err.message : c.unknownError);
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    const value = parseNonNegInt(newValue);
    if (!name) {
      toast.error(t.nameRequired);
      return;
    }
    if (value === null) {
      toast.error(t.valueInvalid);
      return;
    }
    startTransition(async () => {
      try {
        await createEventReportMetricAction({ reportId: boundReportId, name, value });
        setNewName("");
        setNewValue("");
        toast.success(c.saved);
      } catch (err) {
        fail(err);
      }
    });
  }

  function beginEdit(row: ReportMetricRow) {
    setEditingId(row.id);
    setEditName(row.name);
    setEditValue(String(row.value));
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const name = editName.trim();
    const value = parseNonNegInt(editValue);
    if (!name) {
      toast.error(t.nameRequired);
      return;
    }
    if (value === null) {
      toast.error(t.valueInvalid);
      return;
    }
    startTransition(async () => {
      try {
        await updateEventReportMetricAction({ id: editingId, name, value });
        setEditingId(null);
        toast.success(c.saved);
      } catch (err) {
        fail(err);
      }
    });
  }

  function handleDelete(row: ReportMetricRow) {
    if (!window.confirm(t.deleteConfirm.replace("{name}", row.name))) return;
    startTransition(async () => {
      try {
        await deleteEventReportMetricAction({ id: row.id });
        if (editingId === row.id) setEditingId(null);
        toast.success(t.deleted);
      } catch (err) {
        fail(err);
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">{t.description}</p>

      {metrics.length === 0 ? (
        <p className="text-muted-foreground text-sm" data-testid="report-metrics-empty">
          {t.empty}
        </p>
      ) : (
        <ul
          className="divide-hairline-light divide-y rounded-md border"
          data-testid="report-metrics-list"
        >
          {metrics.map((row) =>
            editingId === row.id ? (
              <li key={row.id} className="p-3">
                <form onSubmit={handleUpdate} className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label htmlFor={`metric-name-${row.id}`}>{t.name}</Label>
                    <Input
                      id={`metric-name-${row.id}`}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      disabled={pending}
                      className="w-56"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`metric-value-${row.id}`}>{t.value}</Label>
                    <Input
                      id={`metric-value-${row.id}`}
                      type="number"
                      min={0}
                      step={1}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      disabled={pending}
                      className="w-28"
                    />
                  </div>
                  <Button type="submit" size="sm" disabled={pending}>
                    {pending ? c.saving : c.save}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setEditingId(null)}
                  >
                    <X aria-hidden className="mr-1 size-3.5" />
                    {c.cancel}
                  </Button>
                </form>
              </li>
            ) : (
              <li key={row.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
                <span className="tabular-nums">{row.value.toLocaleString("ja-JP")}</span>
                <span className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    aria-label={`${row.name} ${t.editAction}`}
                    onClick={() => beginEdit(row)}
                  >
                    <Pencil aria-hidden className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    aria-label={`${row.name} ${t.deleteAction}`}
                    onClick={() => handleDelete(row)}
                  >
                    <Trash2 aria-hidden className="size-3.5" />
                  </Button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="metric-new-name">{t.name}</Label>
          <Input
            id="metric-new-name"
            value={newName}
            placeholder={t.namePlaceholder}
            onChange={(e) => setNewName(e.target.value)}
            disabled={pending}
            className="w-56"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="metric-new-value">{t.value}</Label>
          <Input
            id="metric-new-value"
            type="number"
            min={0}
            step={1}
            value={newValue}
            placeholder={t.valuePlaceholder}
            onChange={(e) => setNewValue(e.target.value)}
            disabled={pending}
            className="w-28"
          />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          <Plus aria-hidden className="mr-1 size-3.5" />
          {pending ? c.saving : t.addAction}
        </Button>
      </form>
    </div>
  );
}
