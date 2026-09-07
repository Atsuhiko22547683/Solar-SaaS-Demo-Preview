// 日付・日時の表示形式を 1 箇所に集約する。
//
// 以前は各ファイルが素の `toLocaleDateString("ja-JP")` か、ファイル内で
// 定義したローカル関数で整形していた。その結果、同じアプリの中に
// `2026/08/06 (木) 17:11` / `2026/8/5 17:11:44` / `2026/9/1` / `2026/06/02 14:32`
// が同居し、単発イベント一覧に至っては 1 画面の中に 2 形式が並んでいた。
//
// 表示規則:
//   - 日付は必ずゼロ埋め。一覧で縦に並んだとき桁が揃う（tabular-nums と対で使う）。
//   - 秒は出さない。業務上、秒単位の差が判断に影響する画面が無い。
//   - 曜日は「催事の開催日」にだけ付ける。催事営業は土日に人が集まるかどうかで
//     動くため、曜日は装飾ではなく判断材料。逆に登録日時・更新日時に曜日を
//     付けると情報量が増えるだけで読み取りが遅くなる。

/** 受け取り得る日付型。Prisma の Date / API の ISO 文字列 / 数値を許す。 */
export type DateLike = Date | string | number | null | undefined;

/** 値が無い・パースできないときの表示。 */
export const EMPTY_DATE = "—";

function toDate(value: DateLike): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const pad = (n: number) => String(n).padStart(2, "0");

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** `2026/08/06` — 一覧・詳細の既定の日付表示。 */
export function formatDate(value: DateLike): string {
  const d = toDate(value);
  if (!d) return EMPTY_DATE;
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/** `2026/08/06 17:11` — 登録日時・更新日時など。秒は出さない。 */
export function formatDateTime(value: DateLike): string {
  const d = toDate(value);
  if (!d) return EMPTY_DATE;
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `17:11` — 同一日の中での時刻だけを見せる場面。 */
export function formatTime(value: DateLike): string {
  const d = toDate(value);
  if (!d) return EMPTY_DATE;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * `2026/08/06 (木)` — 催事の開催日・シフト日など、曜日が判断に効く場面だけ。
 * 汎用の日付表示には使わない。
 */
export function formatEventDate(value: DateLike): string {
  const d = toDate(value);
  if (!d) return EMPTY_DATE;
  return `${formatDate(d)} (${WEEKDAYS[d.getDay()]})`;
}

/** `2026/08/06 (木) 17:11` — 催事の開催日時。 */
export function formatEventDateTime(value: DateLike): string {
  const d = toDate(value);
  if (!d) return EMPTY_DATE;
  return `${formatEventDate(d)} ${formatTime(d)}`;
}

/**
 * `2026/08/06 (木)` を月日だけに詰めた `8/6 (木)`。
 * 週次カレンダーのように、年が文脈から自明で横幅が限られる場所だけで使う。
 */
export function formatMonthDayWithWeekday(value: DateLike): string {
  const d = toDate(value);
  if (!d) return EMPTY_DATE;
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[d.getDay()]})`;
}

/** `2026/08` — 対象月。月次締め・手数料など月単位の画面で使う。 */
export function formatMonth(value: DateLike): string {
  const d = toDate(value);
  if (!d) return EMPTY_DATE;
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}`;
}

/**
 * `2026年08月` — 「対象月」列など、日付（YYYY/MM/DD）と隣り合う場所。
 * スラッシュ表記のままだと `2026/06` と `2026/06/02` が一列に並んだときに
 * 粒度の違いが読み取れないため、月単位であることを単位語で明示する。
 * 引数は `YYYY-MM` または日付。
 */
export function formatMonthLong(value: DateLike): string {
  if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-");
    return `${y}年${m}月`;
  }
  const d = toDate(value);
  if (!d) return EMPTY_DATE;
  return `${d.getFullYear()}年${pad(d.getMonth() + 1)}月`;
}

/** `2026-08` — `<input type="month">` の value など、機械可読が要る場面。 */
export function toMonthInputValue(value: DateLike): string {
  const d = toDate(value);
  if (!d) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
