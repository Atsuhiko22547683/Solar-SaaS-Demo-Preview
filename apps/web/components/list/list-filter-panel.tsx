"use client";

// 顧客管理配下の各一覧が共有する「折りたたみ検索パネル」と「検索範囲（日付）」。
//
// 初期状態は折りたたみで、ヘッダ「検索条件」1 行だけを見せて一覧を上へ寄せる。
// URL に有効な検索条件があるときは、今どの条件で絞り込まれているかが分かるよう
// 初期展開する（各一覧の page.tsx が activeCount / defaultOpen を渡す）。
//
// 検索フォームの中身（各一覧固有の項目）は children としてそのまま受け取り、
// 「検索」「クリア」ボタンと submit のハンドリングだけをここが持つ。
// = 各一覧の検索ロジック・URL クエリ名には手を入れない共通化。
//
// スタイルは既存の list-shell.tsx のトークン（FILTER_*）と揃える。

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { FILTER_INPUT_CLASS, FILTER_LABEL_CLASS } from "@/components/list/list-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { labels } from "@/lib/i18n/labels";

import type { ReactNode } from "react";

interface ListFilterPanelProps {
  /** 有効な検索条件の数。0 のときはヘッダにバッジを出さない。 */
  activeCount: number;
  /** 初期表示で開くか（検索条件付き URL で開いたときだけ true）。 */
  defaultOpen: boolean;
  /** 「検索」押下 / Enter。各一覧が URL クエリを組み立てて router.push する。 */
  onSubmit: () => void;
  /** 「クリア」押下。各一覧が state を空にして基準 URL へ戻す。 */
  onClear: () => void;
  /** 各一覧固有の検索項目（flex-wrap の直下に並ぶ）。 */
  children: ReactNode;
  /** パネルを一意にする id 接頭辞（aria-controls 用）。 */
  idPrefix: string;
}

export function ListFilterPanel({
  activeCount,
  defaultOpen,
  onSubmit,
  onClear,
  children,
  idPrefix,
}: ListFilterPanelProps) {
  const t = labels.listCommon;
  const [open, setOpen] = useState(defaultOpen);
  const panelId = `${idPrefix}-filter-panel`;

  return (
    <div>
      {/* ヘッダ — 閉じているときはこの 1 行だけが見える。 */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="focus-visible:ring-primary/40 flex w-full items-center justify-between rounded-md text-left focus:outline-none focus-visible:ring-2"
      >
        <span className="text-ink flex items-center gap-2 text-sm font-medium">
          {t.filterPanel}
          {activeCount > 0 && (
            <Badge variant="secondary">{t.activeCount.replace("{n}", String(activeCount))}</Badge>
          )}
        </span>
        <ChevronDown
          className={`text-mute-light size-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <form
          id={panelId}
          className="border-hairline-light mt-4 border-t pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div className="flex flex-wrap items-end gap-3">
            {children}
            <Button type="submit">{t.search}</Button>
            <Button type="button" variant="outline" onClick={onClear}>
              {t.clear}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

interface ListDateRangeFieldProps {
  /** input の id 接頭辞（一覧ごとに一意にする）。 */
  idPrefix: string;
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}

/**
 * 「検索範囲」— 開始日 〜 終了日 を 1 つの見出しでまとめる。
 * 「開始日」「終了日」を独立見出しにすると何の日付か分からないため、見出しは 1 つにし、
 * 各 input には aria-label（検索範囲 開始日 / 終了日）を付けて区別できるようにする。
 */
export function ListDateRangeField({
  idPrefix,
  from,
  to,
  onFromChange,
  onToChange,
}: ListDateRangeFieldProps) {
  const t = labels.listCommon;
  return (
    <div className="space-y-1">
      {/* 2 つの input をまとめる見出しなので htmlFor は持たせない。 */}
      <span className={FILTER_LABEL_CLASS}>{t.dateRange}</span>
      <div className="flex items-center gap-2">
        <input
          id={`${idPrefix}-from`}
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          aria-label={t.dateRangeFrom}
          className={`${FILTER_INPUT_CLASS} w-40`}
        />
        <span aria-hidden className="text-mute-light text-sm">
          {t.rangeSeparator}
        </span>
        <input
          id={`${idPrefix}-to`}
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          aria-label={t.dateRangeTo}
          className={`${FILTER_INPUT_CLASS} w-40`}
        />
      </div>
    </div>
  );
}
