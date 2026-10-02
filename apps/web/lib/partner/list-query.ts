// 二次店ポータルの一覧共通：URL クエリの解釈と並べ替えの規約。
//
// 検索条件・並べ替え・ページはすべて URL クエリに持つ（再読み込み・戻る/進む・
// 詳細からの復帰で同じ一覧に戻すため）。URL は利用者が書き換えられる入力なので、
// ここで必ず検証する:
//   - 並べ替え対象は許可リスト（画面ごとに列挙）以外を受け付けない
//   - 選択式の値は候補の値域に無ければ「すべて」に倒す
//   - 日付・数値の範囲は形式と大小関係を検証し、不正ならエラー文言を返す
//
// 処理順は「権限による対象限定 → 絞り込み → 並べ替え → ページ分割」。
// 各画面のローダーはこのモジュールで解釈した条件を Prisma の where / orderBy か
// メモリ上の比較関数に写す。
//
// "use client" も "server-only" も付けない — Server Component とクライアント部品の
// 両方から同じ規約を使う純関数。

export type SortDirection = "asc" | "desc";

export interface SortState<F extends string> {
  field: F;
  direction: SortDirection;
}

export interface DateRange {
  /** YYYY-MM-DD */
  from?: string;
  /** YYYY-MM-DD */
  to?: string;
}

export interface NumberRange {
  min?: number;
  max?: number;
}

export type RawParams = Record<string, string | string[] | undefined>;

/** 業務上のタイムゾーン（JST）。日付境界はここを基準にする。 */
export const BUSINESS_TZ_OFFSET = "+09:00";

export const DEFAULT_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// 単値の取り出し
// ---------------------------------------------------------------------------

export function first(raw: RawParams, key: string): string | undefined {
  const v = raw[key];
  const s = Array.isArray(v) ? v[0] : v;
  const t = s?.trim();
  return t && t.length > 0 ? t : undefined;
}

/** 部分一致検索用の文字列。長すぎる入力は切る（DB への無駄な負荷を避ける）。 */
export function text(raw: RawParams, key: string, max = 100): string | undefined {
  const v = first(raw, key);
  return v ? v.slice(0, max) : undefined;
}

/** 選択式。候補に無い値は undefined（= すべて）に倒す。 */
export function oneOf<T extends string>(
  raw: RawParams,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const v = first(raw, key);
  return allowed.find((a) => a === v);
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(s: string): boolean {
  if (!DATE_PATTERN.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * 日付範囲（開始 / 終了）。形式不正は無視し、開始 > 終了はエラーにする。
 * エラーは errors に積み、条件自体は適用しない（0 件になるより分かりやすい）。
 */
export function dateRange(
  raw: RawParams,
  fromKey: string,
  toKey: string,
  label: string,
  errors: string[],
): DateRange {
  const from = first(raw, fromKey);
  const to = first(raw, toKey);
  const f = from && isValidDate(from) ? from : undefined;
  const t = to && isValidDate(to) ? to : undefined;
  if ((from && !f) || (to && !t)) {
    errors.push(`${label}は YYYY-MM-DD 形式で指定してください`);
    return {};
  }
  if (f && t && f > t) {
    errors.push(`${label}の開始日が終了日より後になっています`);
    return {};
  }
  return { from: f, to: t };
}

/** 数値範囲（下限 / 上限）。負数・非数は無視し、下限 > 上限はエラーにする。 */
export function numberRange(
  raw: RawParams,
  minKey: string,
  maxKey: string,
  label: string,
  errors: string[],
): NumberRange {
  const parse = (v: string | undefined) => {
    if (v === undefined) return undefined;
    // 「¥」やカンマを含む表示文字列で比較しない。数字だけを取り出して数値化する。
    const n = Number(v.replace(/[¥,\s]/g, ""));
    return Number.isFinite(n) ? n : NaN;
  };
  const min = parse(first(raw, minKey));
  const max = parse(first(raw, maxKey));
  if (Number.isNaN(min) || Number.isNaN(max)) {
    errors.push(`${label}は数値で指定してください`);
    return {};
  }
  if (min !== undefined && max !== undefined && min > max) {
    errors.push(`${label}の下限が上限より大きくなっています`);
    return {};
  }
  return { min, max };
}

/** 並べ替え。許可リスト外の列は既定に倒す。 */
export function sort<F extends string>(
  raw: RawParams,
  allowed: readonly F[],
  fallback: SortState<F>,
): SortState<F> {
  const requested = first(raw, "sort");
  const field = allowed.find((a) => a === requested);
  // 許可リスト外（または未指定）の列なら方向も含めて既定へ倒す — 方向だけ引き継ぐと
  // 「並べ替え列を差し替えられた」と誤解される表示になるため。
  if (!field) return fallback;
  const dir = first(raw, "dir");
  const direction: SortDirection =
    dir === "asc" || dir === "desc" ? dir : field === fallback.field ? fallback.direction : "asc";
  return { field, direction };
}

/** ページ番号（1 始まり）。不正は 1。 */
export function page(raw: RawParams): number {
  const n = Number(first(raw, "page") ?? "1");
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

// ---------------------------------------------------------------------------
// 日付境界（DB の where 句へ渡す Date）
// ---------------------------------------------------------------------------

/**
 * 日付のみを UTC 0 時で保存している列（催事実施日 / 契約日 / トス日 など）向け。
 * 終了日当日を含めるため、終了側はその日の 23:59:59.999（UTC）。
 */
export function dateOnlyBounds(r: DateRange): { gte?: Date; lte?: Date } {
  return {
    ...(r.from ? { gte: new Date(`${r.from}T00:00:00.000Z`) } : {}),
    ...(r.to ? { lte: new Date(`${r.to}T23:59:59.999Z`) } : {}),
  };
}

/**
 * 日時列（登録日時 / 初回訪問アポ日時 / 勤務開始 など）向け。JST の日付境界で切る。
 * 終了日当日を含める。
 */
export function dateTimeBounds(r: DateRange): { gte?: Date; lte?: Date } {
  return {
    ...(r.from ? { gte: new Date(`${r.from}T00:00:00.000${BUSINESS_TZ_OFFSET}`) } : {}),
    ...(r.to ? { lte: new Date(`${r.to}T23:59:59.999${BUSINESS_TZ_OFFSET}`) } : {}),
  };
}

export function hasBounds(b: { gte?: Date; lte?: Date }): boolean {
  return b.gte !== undefined || b.lte !== undefined;
}

// ---------------------------------------------------------------------------
// メモリ上の並べ替え（複数テーブルの統合結果など、DB で並べられないとき）
// ---------------------------------------------------------------------------

export type SortValue = string | number | Date | null | undefined;

/**
 * 比較関数を作る。未設定値（null / undefined / 空文字）は昇順・降順とも末尾。
 * 同値は id で安定させる（ページを跨いでも順序が揺れない）。
 */
export function comparator<T extends { id: string }>(
  pick: (row: T) => SortValue,
  direction: SortDirection,
): (a: T, b: T) => number {
  const sign = direction === "asc" ? 1 : -1;
  const norm = (v: SortValue): string | number | null => {
    if (v === null || v === undefined || v === "") return null;
    if (v instanceof Date) return v.getTime();
    return v;
  };
  return (a, b) => {
    const va = norm(pick(a));
    const vb = norm(pick(b));
    if (va === null && vb === null) return a.id.localeCompare(b.id);
    if (va === null) return 1;
    if (vb === null) return -1;
    let c: number;
    if (typeof va === "number" && typeof vb === "number") c = va - vb;
    else c = String(va).localeCompare(String(vb), "ja");
    if (c !== 0) return c * sign;
    return a.id.localeCompare(b.id);
  };
}

/** メモリ上のページ分割。 */
export function paginate<T>(rows: T[], current: number, size = DEFAULT_PAGE_SIZE) {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const p = Math.min(current, pageCount);
  return { rows: rows.slice((p - 1) * size, p * size), total, page: p, pageCount };
}

/** 部分一致（大文字小文字を区別しない）。 */
export function includesText(haystack: string | null | undefined, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

// ---------------------------------------------------------------------------
// URL の組み立て（並べ替えリンク・ページリンク用）
// ---------------------------------------------------------------------------

/** 現在のクエリを引き継ぎつつ一部を差し替えた URL を作る。空値のキーは落とす。 */
export function withParams(
  basePath: string,
  current: RawParams,
  overrides: Record<string, string | number | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s && s.length > 0) sp.set(k, s);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === "") sp.delete(k);
    else sp.set(k, String(v));
  }
  const q = sp.toString();
  return q ? `${basePath}?${q}` : basePath;
}

/** 列見出しクリック用：同じ列なら方向を反転、別の列なら昇順で先頭ページへ。 */
export function sortHref<F extends string>(
  basePath: string,
  current: RawParams,
  state: SortState<F>,
  field: F,
): string {
  const direction: SortDirection =
    state.field === field ? (state.direction === "asc" ? "desc" : "asc") : "asc";
  return withParams(basePath, current, { sort: field, dir: direction, page: undefined });
}
