// 週次カレンダーの暦計算と曜日の色。
//
// 代理店のイベント管理（events/weekly-calendar.tsx）が持っていた純関数をここへ出し、
// パートナースタッフの週間カレンダーと同じ規則で描けるようにした。
// 週は月曜始まり。暦日は「その土地の日付」なのでローカルで読む（toISOString は使わない）。

export const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** Date → 'YYYY-MM-DD'（ローカル暦日）。 */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 'YYYY-MM-DD' → ローカル 0 時の Date。 */
export function parseLocalDate(s: string): Date {
  const parts = s.split("-").map(Number);
  return new Date(parts[0]!, parts[1]! - 1, parts[2]!);
}

/** その日を含む週の月曜（'YYYY-MM-DD'）。 */
export function mondayOf(d: Date = new Date()): string {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return localDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff));
}

/** 週頭を delta 週ずらす。 */
export function shiftWeekStart(weekStart: string, delta: number): string {
  const d = parseLocalDate(weekStart);
  d.setDate(d.getDate() + 7 * delta);
  return localDateKey(d);
}

/** 週頭から 7 日分の 'YYYY-MM-DD'。 */
export function weekDays(weekStart: string): string[] {
  const start = parseLocalDate(weekStart);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return localDateKey(d);
  });
}

/** 「2026年9月28日(月) 〜 10月4日(日)」。 */
export function formatWeekRange(start: string, end: string): string {
  const s = parseLocalDate(start);
  const e = parseLocalDate(end);
  return `${s.getFullYear()}年${s.getMonth() + 1}月${s.getDate()}日(${DAY_LABELS[s.getDay()]}) 〜 ${e.getMonth() + 1}月${e.getDate()}日(${DAY_LABELS[e.getDay()]})`;
}

/** 「9/28(月)」。狭い画面の日付見出し用。 */
export function formatShortDay(dateKey: string): string {
  const d = parseLocalDate(dateKey);
  return `${d.getMonth() + 1}/${d.getDate()}(${DAY_LABELS[d.getDay()]})`;
}

/** 曜日の文字色。日曜は赤、土曜は青（代理店カレンダーと同じ規則）。 */
export function weekdayTextClass(dateKey: string): string {
  const dow = parseLocalDate(dateKey).getDay();
  if (dow === 0) return "text-danger";
  if (dow === 6) return "text-link-light";
  return "text-ink";
}
