// コール一覧（旧「マエカク一覧」）の値域・バッジ配色・絞り込み/並び替えキー。
//
// 表示する項目はすべて顧客詳細「コール」タブ（customer-project-info.tsx の
// ProjectCallStatusSection）が読み書きしている実 DB 列に由来する:
//   Customer.maekakuStatus / maekakuPreferredAt / maekakuCallNote
//   Customer.nextAppointmentAt / nextAppointmentAssigneeUserId
//   Customer.thankYouCall* / loanCompletionCall* / postCompletionCall*
//   CustomerCallLog.calledAt
// 新しいステータス値は増やさない（ここは既存値域の再掲であって定義ではない）。
//
// "server-only" を付けないことで client component（filter / table）が server-only な
// data.ts を巻き込まずに定数と型を import できる（顧客一覧 constants.ts と同じ方針）。

import { CALL_STATUS_VALUES } from "@solar/contracts/schemas/customer";

import type { BadgeVariant } from "@/components/ui/badge";
import type { CallStatusValue } from "@solar/contracts/schemas/customer";

// サンキュー / ローン審査完了 / 施工完了コールのステータス（not_done/done/unnecessary）。
// 値域の単一の真実は @solar/contracts の CallStatusEnum。顧客詳細の CallStatusSelect と同一。
export { CALL_STATUS_VALUES };
export type { CallStatusValue };

// マエカクのステータス。顧客詳細 MaekakuCallInlineEdit の select と同一値域
// （packages/contracts/src/schemas/customer.ts の maekakuStatus: pending/done/unnecessary）。
export const MAEKAKU_STATUS_VALUES = ["pending", "done", "unnecessary"] as const;
export type MaekakuStatusValue = (typeof MAEKAKU_STATUS_VALUES)[number];

// --- 絞り込み: 【対象項目】×【ステータス】の 2 段構成 ---------------------------

/** 絞り込みの対象となるコール種別。"all" は 4 種を横断（OR）する。 */
export const CALL_TYPE_VALUES = [
  "all",
  "maekaku",
  "thank_you",
  "loan_completion",
  "post_completion",
] as const;
export type CallTypeValue = (typeof CALL_TYPE_VALUES)[number];
export const DEFAULT_CALL_TYPE: CallTypeValue = "all";

/** 「未設定」（DB では null）を表す擬似ステータス CODE。DB には保存されない。 */
export const UNSET_STATUS = "unset";

/** 種別 → Customer のステータス列名（"all" は横断なので個別列を持たない）。 */
export const CALL_TYPE_STATUS_COLUMN = {
  maekaku: "maekakuStatus",
  thank_you: "thankYouCallStatus",
  loan_completion: "loanCompletionCallStatus",
  post_completion: "postCompletionCallStatus",
} as const;

// 対象項目 = すべて のときの統合ステータス値域。
// "not_done" は「マエカク pending / 他 3 種 not_done」を束ねた表示上の 1 値
// （新しい DB 値ではない。data.ts が OR 条件へ展開する）。
export const COMBINED_STATUS_VALUES = ["not_done", "done", "unnecessary"] as const;
export type CombinedStatusValue = (typeof COMBINED_STATUS_VALUES)[number];

/**
 * 対象項目ごとに選べるステータス CODE の並び（先頭は常に「未設定」）。
 * filter 側の option 生成と normalize の両方がこの 1 箇所を参照する。
 */
export const STATUS_OPTIONS_BY_CALL_TYPE: Record<CallTypeValue, readonly string[]> = {
  all: [UNSET_STATUS, ...COMBINED_STATUS_VALUES],
  maekaku: [UNSET_STATUS, ...MAEKAKU_STATUS_VALUES],
  thank_you: [UNSET_STATUS, ...CALL_STATUS_VALUES],
  loan_completion: [UNSET_STATUS, ...CALL_STATUS_VALUES],
  post_completion: [UNSET_STATUS, ...CALL_STATUS_VALUES],
};

// --- 絞り込み: 日付対象 × 開始日 / 終了日 --------------------------------------

/** 期間絞り込みの対象日時。last_called_at のみ CustomerCallLog 側（relation filter）。 */
export const CALL_DATE_FIELD_VALUES = [
  // 既定は「すべて」= 下記すべての日時を横断して OR で絞り込む。
  "all",
  "maekaku_preferred_at",
  "thank_you_preferred_at",
  "loan_completion_preferred_at",
  "post_completion_preferred_at",
  "next_appointment_at",
  "last_called_at",
] as const;
export type CallDateFieldValue = (typeof CALL_DATE_FIELD_VALUES)[number];
export const DEFAULT_CALL_DATE_FIELD: CallDateFieldValue = "all";

/** 日付対象 → Customer の列名（last_called_at は relation なのでここには含めない）。 */
export const CALL_DATE_FIELD_COLUMN = {
  maekaku_preferred_at: "maekakuPreferredAt",
  thank_you_preferred_at: "thankYouCallPreferredAt",
  loan_completion_preferred_at: "loanCompletionCallPreferredAt",
  post_completion_preferred_at: "postCompletionCallPreferredAt",
  next_appointment_at: "nextAppointmentAt",
} as const;

// --- 並び替え: 【項目】×【昇順/降順】 ------------------------------------------

// いずれも Customer の実列なので DB の orderBy に落ち、ページネーション件数と整合する。
// 最終架電日時（CustomerCallLog.calledAt の最大値）は Prisma の orderBy に落とせないため
// 並び替え項目には含めない（DB 変更を伴う非正規化が必要になるので今回は見送り）。
export const CALL_SORT_FIELD_VALUES = [
  "updated_at",
  "name",
  "maekaku_preferred_at",
  "thank_you_preferred_at",
  "loan_completion_preferred_at",
  "post_completion_preferred_at",
  "next_appointment_at",
] as const;
export type CallSortFieldValue = (typeof CALL_SORT_FIELD_VALUES)[number];
export const DEFAULT_CALL_SORT_FIELD: CallSortFieldValue = "updated_at";

export const SORT_DIRECTION_VALUES = ["asc", "desc"] as const;
export type SortDirectionValue = (typeof SORT_DIRECTION_VALUES)[number];
/** 既定は「更新が新しい順」= updated_at の降順（従来の既定並び順を維持）。 */
export const DEFAULT_SORT_DIRECTION: SortDirectionValue = "desc";

/** 昇順が「近い順 / あいうえお順」になる項目は既定方向を昇順にする（項目切替時の初期値）。 */
export function defaultDirectionFor(field: CallSortFieldValue): SortDirectionValue {
  return field === "updated_at" ? "desc" : "asc";
}

/** 実施済=成功 / 未実施=要対応(注意) / 不要=対象外(灰)。既存 variant のみを使う。 */
export function callStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case "done":
      return "success";
    case "not_done":
    case "pending":
      return "warning";
    case "unnecessary":
      return "secondary";
    default:
      return "secondary";
  }
}

// --- URL クエリの正規化 ---------------------------------------------------------

/** URL クエリの対象項目を値域に丸める（不正値は既定 = すべて）。 */
export function normalizeCallType(value: string | undefined): CallTypeValue {
  return (CALL_TYPE_VALUES as readonly string[]).includes(value ?? "")
    ? (value as CallTypeValue)
    : DEFAULT_CALL_TYPE;
}

/**
 * 対象項目に対応するステータスだけを通す（不正値・種別違いは undefined = 絞り込みなし）。
 * 例: 対象項目 = サンキューコール で "pending"（マエカク側の値）が来ても弾く。
 */
export function normalizeStatusForCallType(
  callType: CallTypeValue,
  value: string | undefined,
): string | undefined {
  return STATUS_OPTIONS_BY_CALL_TYPE[callType].includes(value ?? "") ? value : undefined;
}

/** URL クエリの日付対象を値域に丸める（不正値は既定 = マエカク希望日時）。 */
export function normalizeCallDateField(value: string | undefined): CallDateFieldValue {
  return (CALL_DATE_FIELD_VALUES as readonly string[]).includes(value ?? "")
    ? (value as CallDateFieldValue)
    : DEFAULT_CALL_DATE_FIELD;
}

/** URL クエリの並び替え項目を値域に丸める（不正値は既定へ）。 */
export function normalizeSortField(value: string | undefined): CallSortFieldValue {
  return (CALL_SORT_FIELD_VALUES as readonly string[]).includes(value ?? "")
    ? (value as CallSortFieldValue)
    : DEFAULT_CALL_SORT_FIELD;
}

/**
 * URL クエリの並び順を値域に丸める。
 * 未指定・不正値はその項目にとって自然な向き（updated_at=降順 / 他=昇順）へ。
 * これにより `?sortField=name` だけで「あいうえお順」、`&sortDir=desc` で逆順になる。
 */
export function normalizeSortDirection(
  value: string | undefined,
  field: CallSortFieldValue = DEFAULT_CALL_SORT_FIELD,
): SortDirectionValue {
  return (SORT_DIRECTION_VALUES as readonly string[]).includes(value ?? "")
    ? (value as SortDirectionValue)
    : defaultDirectionFor(field);
}

/** "YYYY-MM-DD" 形式のみ通す（期間フィルタ）。それ以外は undefined。 */
export function normalizeDateParam(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}

// --- 一覧行の型（data.ts が返し、maekaku-table.tsx が描画する） ---------------

/** 各コール 1 セクション分。希望日時・メモは通常行には出さず、行を展開したときだけ見せる。 */
export interface CallSectionCell {
  /** ステータス CODE。未設定は null（バッジではなく "—" を出す）。 */
  status: string | null;
  /** 希望日時（ISO 文字列）。未設定は null。 */
  preferredAt: string | null;
  /** メモ（自由記述）。展開バナーでのみ表示。未設定は null。 */
  note: string | null;
}

// --- 「次回対応」の算出 ---------------------------------------------------------

// 通常行では各コールの希望日時を個別列に出さず、「次に対応が必要な 1 件」だけを示す。
// 候補は取得済みデータ（4 コールの希望日時 + 次回アポイント日時）のみで、追加クエリも
// DB 列の追加も伴わない。並び順を安定させるため候補の優先順はこの配列の順に固定する。
export const NEXT_TASK_KIND_VALUES = [
  "maekaku",
  "thank_you",
  "loan_completion",
  "post_completion",
  "next_appointment",
] as const;
export type NextTaskKindValue = (typeof NEXT_TASK_KIND_VALUES)[number];

export interface NextTaskCell {
  /** 対応項目（表示ラベルは labels.customer.calls.nextTaskKindLabels）。 */
  kind: NextTaskKindValue;
  /** 対応日時（ISO 文字列）。 */
  at: string;
  /** 現在時刻より前 = 期限超過（未来の候補が 1 件も無いときだけ true になる）。 */
  overdue: boolean;
}

/**
 * 「まだ対応が必要」なコールか。
 * 未設定 (null) / マエカク未実施 (pending) / 他 3 種の実施前 (not_done) が対象で、
 * 実施済 (done) と不要 (unnecessary) は次回対応の候補から外す。
 */
export function isOpenCallStatus(status: string | null): boolean {
  return status === null || status === "pending" || status === "not_done";
}

/** computeNextTask の入力（CallListItem の部分集合 = data.ts が既に持っている値のみ）。 */
export interface NextTaskSource {
  maekaku: CallSectionCell;
  thankYouCall: CallSectionCell;
  loanCompletionCall: CallSectionCell;
  postCompletionCall: CallSectionCell;
  nextAppointmentAt: string | null;
}

/**
 * 次回対応を 1 件だけ選ぶ。
 *   1. 候補 = 未完了コールの希望日時（実施済 / 不要 は除外）+ 次回アポイント日時（あれば常に候補）
 *   2. 未来（現在時刻以降）の候補があれば、その中で最も近いもの
 *   3. 未来が無ければ、過去の候補のうち最も直近のものを overdue = true で返す
 *   4. 候補が 1 件も無ければ null（表示は "—"）
 * 同時刻が並んだ場合は NEXT_TASK_KIND_VALUES の順で先勝ち（表示のブレ防止）。
 */
export function computeNextTask(source: NextTaskSource, nowMs: number): NextTaskCell | null {
  const candidates: { kind: NextTaskKindValue; ms: number; at: string }[] = [];
  const push = (kind: NextTaskKindValue, at: string | null) => {
    if (!at) return;
    const ms = new Date(at).getTime();
    if (Number.isNaN(ms)) return;
    candidates.push({ kind, ms, at });
  };

  if (isOpenCallStatus(source.maekaku.status)) push("maekaku", source.maekaku.preferredAt);
  if (isOpenCallStatus(source.thankYouCall.status)) {
    push("thank_you", source.thankYouCall.preferredAt);
  }
  if (isOpenCallStatus(source.loanCompletionCall.status)) {
    push("loan_completion", source.loanCompletionCall.preferredAt);
  }
  if (isOpenCallStatus(source.postCompletionCall.status)) {
    push("post_completion", source.postCompletionCall.preferredAt);
  }
  // 次回アポイントはステータスを持たないので、日時があれば常に候補。
  push("next_appointment", source.nextAppointmentAt);

  if (candidates.length === 0) return null;

  const upcoming = candidates.filter((c) => c.ms >= nowMs);
  if (upcoming.length > 0) {
    // 最も近い未来。< で比較するので同時刻は先に push された種別が残る。
    const best = upcoming.reduce((a, b) => (b.ms < a.ms ? b : a));
    return { kind: best.kind, at: best.at, overdue: false };
  }
  // 未来が無い = 全て期限超過。最も直近（= 最大 = 現在に一番近い過去）を出す。
  const latest = candidates.reduce((a, b) => (b.ms > a.ms ? b : a));
  return { kind: latest.kind, at: latest.at, overdue: true };
}

export interface CallListItem {
  id: string;
  /** PII マスク済みの顧客名（顧客一覧と同じ maskName を通す）。 */
  name: string;
  /** 顧客の担当者名（Customer.registeredByUserId → User.name）。解決不能は null。 */
  assigneeName: string | null;
  /** マエカク（ステータスは MAEKAKU_STATUS_VALUES）。 */
  maekaku: CallSectionCell;
  thankYouCall: CallSectionCell;
  loanCompletionCall: CallSectionCell;
  postCompletionCall: CallSectionCell;
  /** 通常行に出す唯一の日時。候補が無ければ null。 */
  nextTask: NextTaskCell | null;

  // --- ここから下は展開バナー専用（通常行には出さない） ---
  /** マスク済み固定電話。未設定は null。 */
  landlinePhone: string | null;
  /** マスク済み携帯電話。未設定は null。 */
  mobilePhone: string | null;
  nextAppointmentAt: string | null;
  nextAppointmentAssigneeName: string | null;
  /** Customer.nextAction（次回アクションの自由記述）。 */
  nextAction: string | null;
  /** CustomerCallLog のうち calledAt が最新の 1 件。履歴が無ければ全て null。 */
  lastCalledAt: string | null;
  lastHandlerName: string | null;
  lastCallNote: string | null;
  updatedAt: string;
}

export interface CallListFilter {
  /** 顧客名の部分一致（大文字小文字を無視）。 */
  query?: string;
  /** 担当者 = Customer.registeredByUserId（顧客一覧の 担当者 と同一意味論）。 */
  assigneeUserId?: string;
  /** 【対象項目】。既定は "all"。 */
  callType?: CallTypeValue;
  /** 【ステータス】。callType に対応する CODE か UNSET_STATUS。未指定は絞り込みなし。 */
  callStatus?: string;
  /** 【日付対象】＋【開始日】【終了日】（"YYYY-MM-DD"、to は当日終端まで含む）。 */
  dateField?: CallDateFieldValue;
  dateFrom?: string;
  dateTo?: string;
  sortField?: CallSortFieldValue;
  sortDirection?: SortDirectionValue;
  page?: number;
  pageSize?: number;
}

export interface PagedCallListResult {
  items: CallListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
