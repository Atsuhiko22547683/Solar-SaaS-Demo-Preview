// 出店希望の一覧・入力補助の URL クエリ。純関数。
//
// 検索の軸は業務の要望どおり「エリア」「店舗名・住所のフリーテキスト」「対象月」。
// 対象月はドロップダウンで選ぶ 1 値で、希望日程（複数日を指定する入力）とは別物。
// 混同しないよう、月は month（検索・絞り込み用）、希望日程はフォーム側の
// desiredDates（提出内容）として名前も分けている。

import { labels } from "@/lib/i18n/labels";
import {
  first,
  oneOf,
  page,
  sort,
  text,
  type RawParams,
  type SortState,
} from "@/lib/partner/list-query";

export const LANE_PREFERENCE_SORT_FIELDS = ["targetMonth", "submittedAt", "status"] as const;
export type LanePreferenceSortField = (typeof LANE_PREFERENCE_SORT_FIELDS)[number];

export const LANE_PREFERENCE_STATUS_VALUES = [
  "DRAFT",
  "SUBMITTED",
  "ANSWERED",
  "CONFIRMED",
] as const;
export type LanePreferenceStatusValue = (typeof LANE_PREFERENCE_STATUS_VALUES)[number];

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export interface LanePreferenceListQuery {
  /** 対象月（'YYYY-MM'）。1 値の絞り込み。 */
  month?: string;
  /** 依頼先代理店（Relationship.id）。 */
  origin?: string;
  status?: LanePreferenceStatusValue;
  /** 店舗名・住所のフリーテキスト（提出明細と候補の両方に効く）。 */
  venue?: string;
  /** エリア（候補のエリア名）。 */
  area?: string;
  sort: SortState<LanePreferenceSortField>;
  page: number;
  errors: string[];
}

export const LANE_PREFERENCE_DEFAULT_SORT: SortState<LanePreferenceSortField> = {
  field: "targetMonth",
  direction: "desc",
};

export function parseLanePreferenceQuery(raw: RawParams): LanePreferenceListQuery {
  const errors: string[] = [];
  const f = labels.partner.lanePreference.listFilters;
  const rawMonth = first(raw, "month");
  let month: string | undefined;
  if (rawMonth && rawMonth.length > 0) {
    if (MONTH_RE.test(rawMonth)) month = rawMonth;
    else errors.push(`${f.month}の指定が正しくありません`);
  }
  return {
    month,
    origin: text(raw, "origin", 64),
    status: oneOf(raw, "status", LANE_PREFERENCE_STATUS_VALUES),
    venue: text(raw, "venue"),
    area: text(raw, "area"),
    sort: sort(raw, LANE_PREFERENCE_SORT_FIELDS, LANE_PREFERENCE_DEFAULT_SORT),
    page: page(raw),
    errors,
  };
}

/** 当月（'YYYY-MM'）。ローカル時刻で数える（toISOString を使わない）。 */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** 'YYYY-MM' 以外は当月へ倒す（404 にはしない）。 */
export function resolveTargetMonth(raw: string | undefined): string {
  return raw && MONTH_RE.test(raw) ? raw : currentMonth();
}

/**
 * 月の選択肢。前後 12 か月ぶんを新しい順で返す。
 * ドロップダウンで簡単に選べるようにするための固定リスト。
 */
export function monthOptions(base = currentMonth()): { value: string; label: string }[] {
  const [y, m] = base.split("-").map(Number);
  const out: { value: string; label: string }[] = [];
  for (let offset = 12; offset >= -12; offset--) {
    const d = new Date((y ?? 2026) as number, ((m ?? 1) as number) - 1 - offset, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value, label: `${d.getFullYear()}年${d.getMonth() + 1}月` });
  }
  return out;
}
