"use client";

// 成果報告（日報）閲覧ポップアップ — レーン/単発イベント共通。
// Google フォーム「ES_日報」の項目を読み取り専用で表示する。
//
// 使い方:
//   <ResultReportTrigger data={report}>成果</ResultReportTrigger>
//   （children を省略すると既定の「成果を見る」リンクを表示）
// もしくは制御コンポーネントとして:
//   <ResultReportDialog data={report} open={open} onOpenChange={setOpen} />

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { labels } from "@/lib/i18n/labels";

import type { ResultReportData } from "./result-report-data";

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

// YYYY-MM-DD → YYYY/MM/DD（曜）。
function formatEventDate(iso: string): string {
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts as [number, number, number];
  const dow = new Date(y, m - 1, d).getDay();
  return `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}（${DOW[dow]}）`;
}

// 基本情報のメタ項目（小ラベル + 値）。値は折り返し可（truncate しない）。
function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-mute-light text-[11px]">{label}</dt>
      <dd className="text-ink mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

// KPI スタットタイル（成果の主役）。大きな数値で抽選→着座→アポの funnel を示す。
function StatTile({
  label,
  total,
  both,
  single,
}: {
  label: string;
  total: number;
  both: number;
  single: number;
}) {
  const m = labels.resultReport.metrics;
  return (
    <div className="border-hairline-light bg-surface-soft/40 rounded-lg border px-4 py-3">
      <p className="text-mute-light text-xs font-semibold">{label}</p>
      <p className="text-ink mt-1 text-[28px] font-bold tabular-nums leading-none">
        {total.toLocaleString("ja-JP")}
      </p>
      <p className="text-mute-light mt-2 text-[11px] tabular-nums">
        {m.both}
        <span className="text-body-light ml-1 font-medium">{both}</span>
        <span className="text-hairline-light mx-1.5">/</span>
        {m.single}
        <span className="text-body-light ml-1 font-medium">{single}</span>
      </p>
    </div>
  );
}

// 成果報告の本体（ダイアログ枠なし）。日付ポップアップ等にインライン埋め込み可能。
export function ResultReportView({ data }: { data: ResultReportData }) {
  const r = labels.resultReport;
  const category = r.categoryLabels[data.category === "housing" ? "housing" : "realestate"];
  const channel =
    data.salesChannel === "cainzW"
      ? r.channelLabels.cainzW
      : data.salesChannel === "cainzV"
        ? r.channelLabels.cainzV
        : r.channelLabels.shimachu;

  return (
    <div className="space-y-5">
      {/* 成果 KPI（主役）— 抽選 → 着座 → アポ の funnel を大きな数値で */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile
          label={r.metrics.lottery}
          total={data.lotteryTotal}
          both={data.lotteryBoth}
          single={data.lotterySingle}
        />
        <StatTile
          label={r.metrics.seated}
          total={data.seatedTotal}
          both={data.seatedBoth}
          single={data.seatedSingle}
        />
        <StatTile
          label={r.metrics.appointment}
          total={data.apptTotal}
          both={data.apptBoth}
          single={data.apptSingle}
        />
      </div>

      {/* 基本情報 — コンパクトなメタ情報グリッド（数値の補足コンテキスト） */}
      <dl className="border-hairline-light grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border p-4 sm:grid-cols-3">
        <MetaItem label={r.fields.eventDate} value={formatEventDate(data.eventDate)} />
        <MetaItem label={r.fields.venuePlace} value={data.venuePlace} />
        <MetaItem label={r.fields.franchiseNo} value={data.franchiseNo} />
        <MetaItem label={r.fields.category} value={category} />
        <MetaItem label={r.fields.areaInFacility} value={data.areaInFacility} />
        <MetaItem label={r.fields.workingHours} value={`${data.startTime} 〜 ${data.endTime}`} />
        <MetaItem
          label={r.fields.salesChannel}
          value={<Badge variant="secondary">{channel}</Badge>}
        />
      </dl>

      {/* 所感 */}
      <div>
        <h3 className="text-mute-light mb-1.5 text-xs font-semibold">{r.sections.impression}</h3>
        <p className="bg-surface-soft/50 text-body-light whitespace-pre-wrap rounded-md p-3 text-sm leading-relaxed">
          {data.impression && data.impression.length > 0 ? data.impression : r.emptyImpression}
        </p>
      </div>
    </div>
  );
}

interface ResultReportDialogProps {
  data: ResultReportData;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

// 制御コンポーネント版（トリガーは呼び出し側が用意する）。
export function ResultReportDialog({ data, open, onOpenChange }: ResultReportDialogProps) {
  const r = labels.resultReport;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{r.title}</DialogTitle>
        </DialogHeader>
        <ResultReportView data={data} />
      </DialogContent>
    </Dialog>
  );
}

interface ResultReportTriggerProps {
  data: ResultReportData;
  children?: React.ReactNode;
  className?: string;
}

// トリガー内蔵版。children をクリック要素として使う（省略時は「成果を見る」リンク）。
export function ResultReportTrigger({ data, children, className }: ResultReportTriggerProps) {
  const r = labels.resultReport;
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={
            className ??
            "text-primary focus-visible:ring-primary/40 rounded-sm font-medium underline-offset-2 outline-none transition-colors hover:underline focus-visible:ring-2"
          }
        >
          {children ?? r.view}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{r.title}</DialogTitle>
        </DialogHeader>
        <ResultReportView data={data} />
      </DialogContent>
    </Dialog>
  );
}
