// 催事シフト画面の URL クエリ。純関数。
//
// 並べ替え UI は持たない（業務要件どおり）。表示順は「開催日 → 開催開始時刻 → 開催場所」に固定。
// 月は 1 値。前月 / 当月 / 翌月の切替と、月の直接選択の両方でこの 1 値を変える。

import { first, oneOf, text, type RawParams } from "@/lib/partner/list-query";

export const SHIFT_VIEWS = ["list", "calendar"] as const;
export type ShiftView = (typeof SHIFT_VIEWS)[number];

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface ShiftMonthQuery {
  /** 'YYYY-MM'。未指定・値域外は当月。 */
  month: string;
  view: ShiftView;
  /** スタッフでの絞り込み（User.id）。 */
  member?: string;
  /** 開催場所のフリーテキスト。 */
  venue?: string;
  /** カレンダーで選択中の日（'YYYY-MM-DD'）。詳細を開くのに使う。 */
  day?: string;
  errors: string[];
}

/** 当月（'YYYY-MM'）。ローカル時刻で数える。 */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** 月を n か月ずらす。 */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date((y ?? 2026) as number, ((m ?? 1) as number) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 月の範囲（ローカル時刻の月初 00:00 〜 翌月初 00:00）。 */
export function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split("-").map(Number);
  const start = new Date((y ?? 2026) as number, ((m ?? 1) as number) - 1, 1, 0, 0, 0, 0);
  const end = new Date((y ?? 2026) as number, (m ?? 1) as number, 1, 0, 0, 0, 0);
  return { start, end };
}

/** 月の選択肢（前後 12 か月）。ドロップダウンで直接選べるようにする。 */
export function monthOptions(base = currentMonth()): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let offset = 12; offset >= -12; offset--) {
    const value = shiftMonth(base, -offset);
    const [y, m] = value.split("-");
    out.push({ value, label: `${y}年${Number(m)}月` });
  }
  return out;
}

export function parseShiftMonthQuery(raw: RawParams): ShiftMonthQuery {
  const errors: string[] = [];
  const rawMonth = first(raw, "month");
  let month = currentMonth();
  if (rawMonth && rawMonth.length > 0) {
    if (MONTH_RE.test(rawMonth)) month = rawMonth;
    else errors.push("表示する月の指定が正しくありません");
  }
  const rawDay = first(raw, "day");
  return {
    month,
    view: oneOf(raw, "view", SHIFT_VIEWS) ?? "list",
    member: text(raw, "member", 64),
    venue: text(raw, "venue"),
    day: rawDay && /^\d{4}-\d{2}-\d{2}$/.test(rawDay) ? rawDay : undefined,
    errors,
  };
}
