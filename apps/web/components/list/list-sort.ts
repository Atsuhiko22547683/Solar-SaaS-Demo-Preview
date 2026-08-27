// 顧客管理配下の各一覧が共有する並び替えの型と、URL クエリの正規化。
//
// "use client" は付けない — これらは page.tsx（Server Component）から呼ぶ純関数で、
// クライアント側の ListSortSelect からも型として参照される。
// （client モジュールに置くと Server Component から呼べないため独立させている）

export type SortDirection = "asc" | "desc";

export interface ListSortOption {
  /** URL の sortField に載る値。 */
  value: string;
  /** 表示名。 */
  label: string;
  /**
   * その項目にとって自然な向き。項目を切り替えたときの既定で、
   * この向きのときは sortDir を URL に載せない（日付・氏名は昇順、更新日時は降順が自然）。
   */
  defaultDirection: SortDirection;
}

/** URL クエリの並び替え項目を値域に丸める（不正値は既定へ）。 */
export function normalizeSortField(
  value: string | undefined,
  options: readonly ListSortOption[],
  defaultField: string,
): string {
  return options.some((o) => o.value === value) ? value! : defaultField;
}

/** URL クエリの並び順を値域に丸める（未指定はその項目にとって自然な向き）。 */
export function normalizeSortDirection(
  value: string | undefined,
  field: string,
  options: readonly ListSortOption[],
): SortDirection {
  if (value === "asc" || value === "desc") return value;
  return options.find((o) => o.value === field)?.defaultDirection ?? "desc";
}
