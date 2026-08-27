"use client";

// コール一覧テーブル。
//
// 設計方針: 「横スクロールせずに 4 種のコールステータスを一目で比較できる」ことを最優先にし、
// 通常行は 8 列（顧客名 / 担当者 / 4 コールのステータスバッジ / 次回対応 / 展開）だけに絞る。
// 電話番号・各コールの希望日時とメモ・次回アポイントの詳細・直近コール履歴は、行を展開した
// ときだけ行直下のバナー（横幅いっぱいの <tr>）に出す。モーダルは使わない。
//
// 操作の切り分け（行クリックで誤って画面遷移しないようにする）:
//   行のどこか / 右端のシェブロン → 展開・折りたたみ（アコーディオン: 1 行ずつ）
//   顧客名リンク / バナー右下の「詳細を見る」 → 顧客詳細のコールタブ（?tab=calls）
//
// 行高・罫線・フォーカスリング・バッジは S-032 顧客一覧（customer-table.tsx /
// list-shell.tsx）と同じトークンを使う。新しいデザイン体系は作らない。

import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { LIST_ROW, LIST_TD, LIST_TH } from "@/components/list/list-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { labels } from "@/lib/i18n/labels";

import { saveProjectCallStatusAction } from "../actions";
import { CALL_STATUS_VALUES, MAEKAKU_STATUS_VALUES, callStatusVariant } from "./constants";

import type { CallListItem, CallSectionCell, NextTaskCell } from "./constants";
import type { ReactNode } from "react";

// 未設定値の統一表示（顧客一覧・横断一覧と同じ labels.customer.none）。
const NONE = labels.customer.none;

/** 顧客詳細コールタブ（fmtDateTime）と同じ日時書式 — YYYY/MM/DD HH:mm。 */
function fmtDateTime(iso: string | null): string {
  if (!iso) return NONE;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NONE;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 未設定を "—" に寄せる（空欄にしない）。 */
function orNone(value: string | null): string {
  return value && value.length > 0 ? value : NONE;
}

/**
 * 展開バナー最上段の電話番号 1 件（小さなラベル + 値の横並び）。
 * 電話番号は顧客名の補足情報なので独立ブロックにはせず、1 行に収める。未設定は "—"。
 */
function PhoneItem({ label, value }: { label: string; value: string | null }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-mute-light text-[11px]">{label}</span>
      <span className="text-body-light text-sm tabular-nums">{orNone(value)}</span>
    </span>
  );
}

// 4 コール列 + 展開列は px-6 だと 1366px 幅で溢れるため px-3 に詰める
// （行高・字送り・色は LIST_TH / LIST_TD と同じまま）。
const TH_COMPACT =
  "whitespace-nowrap px-3 py-3 text-left text-xs font-medium text-mute-light uppercase tracking-wider";
const TD_COMPACT = "whitespace-nowrap px-3 py-3 text-body-light";

/** ステータスバッジ。未設定はバッジを出さず "—"（顧客詳細と同じ値域ラベルを引く）。 */
function StatusCell({
  cell,
  labelMap,
}: {
  cell: CallSectionCell;
  labelMap: Record<string, string>;
}) {
  return (
    <td className={TD_COMPACT}>
      {cell.status ? (
        <Badge variant={callStatusVariant(cell.status)}>
          {labelMap[cell.status] ?? cell.status}
        </Badge>
      ) : (
        <span className="text-mute-light">{NONE}</span>
      )}
    </td>
  );
}

/**
 * 次回対応 — 対応項目名（1 行目）と日時（2 行目）。
 * 期限超過（未来の候補が無く過去の未完了だけ残っている）のときはバッジで強調する。
 */
function NextTaskCellView({ task }: { task: NextTaskCell | null }) {
  const t = labels.customer.calls;
  if (!task) {
    return (
      <td className={LIST_TD}>
        <span className="text-mute-light">{NONE}</span>
      </td>
    );
  }
  return (
    <td className="text-body-light px-6 py-3">
      <div className="flex items-center gap-2">
        <span className="text-mute-light truncate text-xs">
          {t.nextTaskKindLabels[task.kind] ?? task.kind}
        </span>
        {task.overdue && (
          <Badge variant="destructive" className="shrink-0">
            {t.overdue}
          </Badge>
        )}
      </div>
      <div
        className={`whitespace-nowrap tabular-nums ${task.overdue ? "text-destructive font-medium" : "text-ink"}`}
      >
        {fmtDateTime(task.at)}
      </div>
    </td>
  );
}

/**
 * 展開バナー内の 1 情報ブロック（見出し + 縦積みの項目リスト）。
 * min-w-0 はグリッド子要素の既定 min-width:auto を打ち消すため（長文で列が広がるのを防ぐ）。
 */
function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-2">
      <h4 className="border-hairline-light text-mute-light border-b pb-1 text-xs font-semibold uppercase tracking-wider">
        {title}
      </h4>
      <dl className="space-y-2">{children}</dl>
    </div>
  );
}

/**
 * 展開バナー内の 1 項目。ラベルを上・値を下に置き、上から下へ読めるようにする
 * （ラベルと値を横に並べると視線が左右に振れて読みづらいため）。
 * `strong` を付けた項目（日時）は値側を濃く・少し太くして、ラベルより目立たせる。
 */
function StackedField({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string | null;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-mute-light text-[11px] leading-tight">{label}</dt>
      <dd
        className={
          strong
            ? "text-ink text-sm font-medium tabular-nums"
            : "text-body-light whitespace-pre-line break-words text-sm"
        }
      >
        {orNone(value)}
      </dd>
    </div>
  );
}

/** ISO → <input type="datetime-local"> 用 YYYY-MM-DDTHH:mm（ローカル日時）。 */
function toDateTimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 各コール種別 → saveProjectCallStatusAction のペイロードキー。
// 保存先・値域・validation は顧客詳細「コール」タブと完全に同じものを使う
// （一覧のために別データを作らない）。
const CALL_PAYLOAD_KEYS = {
  maekaku: {
    status: "maekakuStatus",
    preferredAt: "maekakuPreferredAt",
    note: "maekakuCallNote",
  },
  thank_you: {
    status: "thankYouCallStatus",
    preferredAt: "thankYouCallPreferredAt",
    note: "thankYouCallNote",
  },
  loan_completion: {
    status: "loanCompletionCallStatus",
    preferredAt: "loanCompletionCallPreferredAt",
    note: "loanCompletionCallNote",
  },
  post_completion: {
    status: "postCompletionCallStatus",
    preferredAt: "postCompletionCallPreferredAt",
    note: "postCompletionCallNote",
  },
} as const;

type CallKind = keyof typeof CALL_PAYLOAD_KEYS;

const EDIT_FIELD =
  "h-8 w-full rounded-sm border border-hairline-light bg-white px-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-surface-soft";

/**
 * 各コール 1 セクション分のブロック（コール名 → ステータス → 希望日時 → メモ の縦読み）。
 * 展開したまま その場で編集・保存できる（保存先は顧客詳細コールタブと同じ Customer 列）。
 *
 * 空でも描画する: 4 ブロックの並び順を通常行のステータス列（マエカク / サンキュー /
 * ローン完了 / 施工完了）と一致させたいため。空ブロックを畳むと残りが左へ詰まって
 * 列位置がずれ、どのコールの情報かを読み違えやすくなる。
 */
function CallSectionEditor({
  customerId,
  customerName,
  title,
  kind,
  cell,
  statusValues,
  statusLabels,
}: {
  customerId: string;
  customerName: string;
  title: string;
  kind: CallKind;
  cell: CallSectionCell;
  statusValues: readonly string[];
  statusLabels: Record<string, string>;
}) {
  const t = labels.customer.calls;
  const f = t.fields;
  const c = labels.common;
  const unset = labels.customer.detail.projectInfo.edit.unset;
  const router = useRouter();

  const [status, setStatus] = useState(cell.status ?? "");
  const [preferredAt, setPreferredAt] = useState(() => toDateTimeInput(cell.preferredAt));
  const [note, setNote] = useState(cell.note ?? "");
  const [isPending, startTransition] = useTransition();

  // 一覧が再取得されたら（検索・並び替え・他行の保存）サーバ値へ追随する。
  useEffect(() => {
    setStatus(cell.status ?? "");
    setPreferredAt(toDateTimeInput(cell.preferredAt));
    setNote(cell.note ?? "");
  }, [cell.status, cell.preferredAt, cell.note]);

  const dirty =
    status !== (cell.status ?? "") ||
    preferredAt !== toDateTimeInput(cell.preferredAt) ||
    note !== (cell.note ?? "");

  function save() {
    const keys = CALL_PAYLOAD_KEYS[kind];
    startTransition(async () => {
      try {
        await saveProjectCallStatusAction({
          customerId,
          [keys.status]: status || null,
          [keys.preferredAt]: preferredAt || null,
          [keys.note]: note.length > 0 ? note : null,
        } as Parameters<typeof saveProjectCallStatusAction>[0]);
        toast.success(c.saved);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error && err.message ? err.message : c.unknownError);
      }
    });
  }

  const idBase = `call-edit-${kind}-${customerId}`;
  return (
    <DetailBlock title={title}>
      <div className="min-w-0">
        <label htmlFor={`${idBase}-status`} className="text-mute-light text-[11px] leading-tight">
          {f.statusLabel}
        </label>
        <select
          id={`${idBase}-status`}
          value={status}
          disabled={isPending}
          onChange={(e) => setStatus(e.target.value)}
          aria-label={`${customerName} ${title} ${f.statusLabel}`}
          className={EDIT_FIELD}
        >
          <option value="">{unset}</option>
          {statusValues.map((v) => (
            <option key={v} value={v}>
              {statusLabels[v] ?? v}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-0">
        <label
          htmlFor={`${idBase}-preferred`}
          className="text-mute-light text-[11px] leading-tight"
        >
          {f.preferredAt}
        </label>
        <input
          id={`${idBase}-preferred`}
          type="datetime-local"
          value={preferredAt}
          disabled={isPending}
          onChange={(e) => setPreferredAt(e.target.value)}
          aria-label={`${customerName} ${title} ${f.preferredAt}`}
          className={`${EDIT_FIELD} tabular-nums`}
        />
      </div>

      <div className="min-w-0">
        <label htmlFor={`${idBase}-note`} className="text-mute-light text-[11px] leading-tight">
          {f.note}
        </label>
        <textarea
          id={`${idBase}-note`}
          value={note}
          disabled={isPending}
          rows={2}
          onChange={(e) => setNote(e.target.value)}
          aria-label={`${customerName} ${title} ${f.note}`}
          className="border-hairline-light text-ink focus:border-primary focus:ring-primary/20 w-full rounded-sm border bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed"
        />
      </div>

      <div className="flex justify-end pt-1">
        <Button type="button" size="sm" onClick={save} disabled={isPending || !dirty}>
          {isPending ? c.saving : c.save}
        </Button>
      </div>
    </DetailBlock>
  );
}

/**
 * 行直下に開く詳細バナー。通常行から外した情報をここへ集約する。
 *
 * 3 層構成:
 *   上段 … 電話番号（顧客名の補足なので独立カードにせず横 1 行に収める）
 *   中段 … 4 種のコール（PC 幅で 4 列 / 各ブロック内は縦読み）
 *   下段 … 次回対応（2/3 幅）と 直近コール履歴（1/3 幅）
 * 次回アクションは文章になるため、次回対応側に広い幅を割り当てて折り返しを減らす。
 */
function DetailBanner({ row }: { row: CallListItem }) {
  const t = labels.customer.calls;
  const s = t.sections;
  const f = t.fields;
  // ステータスの値域ラベルは顧客詳細コールタブと共有する。
  const p = labels.customer.detail.projectInfo;

  return (
    <div className="space-y-4">
      {/* 上段 — 電話番号。ラベルは小さく添えるだけで、1 行に横並び。 */}
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1">
        <PhoneItem label={f.landlinePhone} value={row.landlinePhone} />
        <PhoneItem label={f.mobilePhone} value={row.mobilePhone} />
      </div>

      {/* 中段 — 4 種のコール。列の並びは通常行のステータス列と同じ順。 */}
      <div className="border-hairline-light grid grid-cols-2 gap-x-8 gap-y-4 border-t pt-4 lg:grid-cols-4">
        <CallSectionEditor
          customerId={row.id}
          customerName={row.name}
          title={s.maekaku}
          kind="maekaku"
          cell={row.maekaku}
          statusValues={MAEKAKU_STATUS_VALUES}
          statusLabels={p.maekakuStatusDisplayLabels}
        />
        <CallSectionEditor
          customerId={row.id}
          customerName={row.name}
          title={s.thankYouCall}
          kind="thank_you"
          cell={row.thankYouCall}
          statusValues={CALL_STATUS_VALUES}
          statusLabels={p.callPhaseStatusLabels}
        />
        <CallSectionEditor
          customerId={row.id}
          customerName={row.name}
          title={s.loanCompletionCall}
          kind="loan_completion"
          cell={row.loanCompletionCall}
          statusValues={CALL_STATUS_VALUES}
          statusLabels={p.callPhaseStatusLabels}
        />
        <CallSectionEditor
          customerId={row.id}
          customerName={row.name}
          title={s.postCompletionCall}
          kind="post_completion"
          cell={row.postCompletionCall}
          statusValues={CALL_STATUS_VALUES}
          statusLabels={p.callPhaseStatusLabels}
        />
      </div>

      {/* 下段 — 次回対応（広め）と直近コール履歴。 */}
      <div className="border-hairline-light grid grid-cols-1 gap-x-8 gap-y-4 border-t pt-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <DetailBlock title={s.nextAppointment}>
            <StackedField
              label={f.appointmentAt}
              value={row.nextAppointmentAt ? fmtDateTime(row.nextAppointmentAt) : null}
              strong
            />
            <StackedField label={f.appointmentAssignee} value={row.nextAppointmentAssigneeName} />
            <StackedField label={f.nextAction} value={row.nextAction} />
          </DetailBlock>
        </div>

        <DetailBlock title={s.lastCall}>
          <StackedField
            label={f.lastCalledAt}
            value={row.lastCalledAt ? fmtDateTime(row.lastCalledAt) : null}
            strong
          />
          <StackedField label={f.lastHandler} value={row.lastHandlerName} />
          <StackedField label={f.note} value={row.lastCallNote} />
        </DetailBlock>
      </div>

      {/* 案件詳細へ — バナー内の主要操作なので primary ボタン + 矢印で明示する。
          遷移先は従来どおり顧客詳細のコールタブ。 */}
      <div className="flex justify-end">
        <Button asChild size="default" className="px-5">
          <Link href={`/customers/${row.id}?tab=calls`}>
            {t.expand.detailLink}
            <ArrowRight className="ml-1 size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </div>
  );
}

interface CallTableProps {
  rows: CallListItem[];
}

export function CallTable({ rows }: CallTableProps) {
  const t = labels.customer.calls;
  const c = labels.customer;
  const p = labels.customer.detail.projectInfo;

  // 展開状態は画面上の一時的な UI 状態（保存しない / リロードで閉じる）。
  // 一覧性を優先してアコーディオン方式にする（1 行開くと他は閉じる）。
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-hairline-light bg-surface-soft/50 border-b">
          <th scope="col" className={LIST_TH}>
            {t.columns.name}
          </th>
          <th scope="col" className={LIST_TH}>
            {t.columns.assignee}
          </th>
          <th scope="col" className={TH_COMPACT}>
            {t.columns.maekaku}
          </th>
          <th scope="col" className={TH_COMPACT}>
            {t.columns.thankYouCall}
          </th>
          <th scope="col" className={TH_COMPACT}>
            {t.columns.loanCompletionCall}
          </th>
          <th scope="col" className={TH_COMPACT}>
            {t.columns.postCompletionCall}
          </th>
          <th scope="col" className={LIST_TH}>
            {t.columns.nextTask}
          </th>
          <th className="w-12 px-3 py-3" aria-hidden />
        </tr>
      </thead>
      <tbody className="divide-hairline-light divide-y">
        {rows.map((row) => {
          const isExpanded = expandedId === row.id;
          const bannerId = `call-row-detail-${row.id}`;
          const toggle = () => setExpandedId(isExpanded ? null : row.id);

          return [
            <tr
              key={row.id}
              className={`group ${LIST_ROW} ${isExpanded ? "bg-mist-light" : ""}`}
              onClick={toggle}
            >
              {/* 顧客名だけは遷移リンク。行クリック（= 展開）と取り違えないよう伝播を止める。 */}
              <td className="text-ink px-6 py-3 font-medium">
                <Link
                  href={`/customers/${row.id}?tab=calls`}
                  onClick={(e) => e.stopPropagation()}
                  className="focus-visible:ring-primary/40 rounded-sm underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2"
                >
                  {row.name} {c.honorific}
                </Link>
              </td>
              <td className={LIST_TD}>{orNone(row.assigneeName)}</td>

              {/* 4 種のコールステータス — 通常行はバッジのみ（希望日時・メモは展開側）。 */}
              <StatusCell cell={row.maekaku} labelMap={p.maekakuStatusDisplayLabels} />
              <StatusCell cell={row.thankYouCall} labelMap={p.callPhaseStatusLabels} />
              <StatusCell cell={row.loanCompletionCall} labelMap={p.callPhaseStatusLabels} />
              <StatusCell cell={row.postCompletionCall} labelMap={p.callPhaseStatusLabels} />

              <NextTaskCellView task={row.nextTask} />

              <td className="px-3 py-3 text-right">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={bannerId}
                  aria-label={`${row.name}${c.honorific} ${isExpanded ? t.expand.close : t.expand.open}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle();
                  }}
                  className="text-mute-light hover:bg-surface-soft hover:text-ink focus-visible:ring-primary/40 rounded-md p-1 transition-colors focus:outline-none focus-visible:ring-2"
                >
                  <ChevronDown
                    className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                </button>
              </td>
            </tr>,

            isExpanded ? (
              <tr key={`${row.id}-detail`} className="bg-surface-soft/40">
                <td id={bannerId} colSpan={8} className="px-6 py-4">
                  <DetailBanner row={row} />
                </td>
              </tr>
            ) : null,
          ];
        })}
      </tbody>
    </table>
  );
}
