"use client";

// 顧客管理配下の各一覧が共有する並び替え操作（項目 × 昇順/降順）。
//
// 並び替えは絞り込みではなく見せ方の切り替えなので検索パネルから分離し、
// 一覧直前の「表示件数」の横に置く。検索ボタンを介さず、select を変えた時点で
// URL クエリを更新して即反映する（表示件数セレクト PageSizeSelect と同じ操作感）。
//
// URL クエリの契約:
//   sortField … 既定項目のときは載せない
//   sortDir   … その項目にとって自然な向き（defaultDirection）のときは載せない
// 現在の検索条件は URLSearchParams をコピーして保つので、並び替えで絞り込みが消えない。
// 並び順が変わると「何ページ目か」の意味が変わるため page は必ず 1 ページ目へ戻す。

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { labels } from "@/lib/i18n/labels";

import type { ListSortOption, SortDirection } from "./list-sort";

// 一覧の外に置く単体セレクト。検索パネル内の FILTER_SELECT_CLASS は w-full 前提なので使わず、
// 同じ並びに置く表示件数セレクトと同一のクラスに揃える。幅は明示する（項目名が長いと
// 内容なりでは行に収まらず flex が縮めて 2 段に折り返すため）。
const SELECT_CLASS =
  "h-9 shrink-0 rounded-md border border-hairline-light bg-white px-3 py-1 text-sm text-body-light focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

interface ListSortSelectProps {
  /** 遷移先のベースパス（例: "/contracts"）。 */
  basePath: string;
  options: ListSortOption[];
  sortField: string;
  sortDirection: SortDirection;
  /** 既定の並び替え項目（この値のときは sortField を URL に載せない）。 */
  defaultField: string;
}

export function ListSortSelect({
  basePath,
  options,
  sortField,
  sortDirection,
  defaultField,
}: ListSortSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = labels.listCommon;

  const naturalDirectionOf = useCallback(
    (field: string): SortDirection =>
      options.find((o) => o.value === field)?.defaultDirection ?? "desc",
    [options],
  );

  /** 現在の検索条件を保ったまま並び替えだけ差し替える（ページは 1 に戻す）。 */
  const push = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete("page");
      const qs = params.toString();
      router.push(qs ? `${basePath}?${qs}` : basePath);
    },
    [router, searchParams, basePath],
  );

  const onFieldChange = useCallback(
    (value: string) => {
      push((params) => {
        if (value === defaultField) params.delete("sortField");
        else params.set("sortField", value);
        // 項目を変えたら向きはその項目にとって自然な既定へ戻す。
        params.delete("sortDir");
      });
    },
    [push, defaultField],
  );

  const onDirectionChange = useCallback(
    (value: string) => {
      push((params) => {
        if (value === naturalDirectionOf(sortField)) params.delete("sortDir");
        else params.set("sortDir", value);
      });
    },
    [push, sortField, naturalDirectionOf],
  );

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-mute-light shrink-0 text-sm">{t.sortField}</span>

      <select
        value={sortField}
        onChange={(e) => onFieldChange(e.target.value)}
        aria-label={t.sortField}
        className={`${SELECT_CLASS} w-60`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        value={sortDirection}
        onChange={(e) => onDirectionChange(e.target.value)}
        aria-label={t.sortDirection}
        className={`${SELECT_CLASS} w-24`}
      >
        {(["asc", "desc"] as const).map((v) => (
          <option key={v} value={v}>
            {t.sortDirectionLabels[v]}
          </option>
        ))}
      </select>
    </div>
  );
}
