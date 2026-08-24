"use client";

// コール一覧の並び替え操作（項目 × 昇順/降順）。
//
// 検索条件とは性質が違う（絞り込みではなく見せ方の切り替え）ため検索パネルから分離し、
// 一覧直前の「表示件数」の横に置く。検索ボタンを介さず、select を変えた時点で
// URL クエリを更新して即反映する（表示件数セレクト PageSizeSelect と同じ操作感）。
//
// URL クエリの契約は検索パネルにあった頃と完全に同じ:
//   sortField … 既定 (updated_at) のときは載せない
//   sortDir   … その項目にとって自然な向き（更新日時=降順 / 他=昇順）のときは載せない
// そのため page.tsx 側の normalize / data.ts の orderBy は一切変更していない。

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { labels } from "@/lib/i18n/labels";

import {
  CALL_SORT_FIELD_VALUES,
  DEFAULT_CALL_SORT_FIELD,
  SORT_DIRECTION_VALUES,
  defaultDirectionFor,
} from "./constants";

import type { CallSortFieldValue, SortDirectionValue } from "./constants";

const BASE_PATH = "/customers/maekaku";

// 一覧の外に置く単体セレクト。検索パネル内の FILTER_SELECT_CLASS は w-full 前提なので使わず、
// 同じ並びに置く表示件数セレクト（../page-size-select.tsx）と同一のクラスに揃える。
//
// 幅は明示する: 項目名が「ローン審査完了コール希望日時」まで伸びるため、内容なりに任せると
// 行に収まらず flex が縮めて 2 段に折り返してしまう（shrink-0 と併せて 1 行に固定する）。
const SORT_SELECT_CLASS =
  "h-9 shrink-0 rounded-md border border-hairline-light bg-white px-3 py-1 text-sm text-body-light focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

interface CallSortSelectProps {
  sortField: CallSortFieldValue;
  sortDirection: SortDirectionValue;
}

export function CallSortSelect({ sortField, sortDirection }: CallSortSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = labels.customer.calls;

  /** 現在の検索条件を保ったまま並び替えだけ差し替える（ページは 1 に戻す）。 */
  const push = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      // 並び順が変わると何ページ目かの意味が変わるので 1 ページ目へ戻す。
      params.delete("page");
      const qs = params.toString();
      router.push(qs ? `${BASE_PATH}?${qs}` : BASE_PATH);
    },
    [router, searchParams],
  );

  const onFieldChange = useCallback(
    (value: string) => {
      push((params) => {
        if (value === DEFAULT_CALL_SORT_FIELD) params.delete("sortField");
        else params.set("sortField", value);
        // 項目を変えたら向きはその項目にとって自然な既定へ戻す
        // （日時・顧客名は昇順＝近い順/あいうえお順、更新日時は降順）。
        params.delete("sortDir");
      });
    },
    [push],
  );

  const onDirectionChange = useCallback(
    (value: string) => {
      push((params) => {
        if (value === defaultDirectionFor(sortField)) params.delete("sortDir");
        else params.set("sortDir", value);
      });
    },
    [push, sortField],
  );

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="text-mute-light shrink-0 text-sm">{t.filters.sortField}</span>

      <select
        value={sortField}
        onChange={(e) => onFieldChange(e.target.value)}
        aria-label={t.filters.sortField}
        className={`${SORT_SELECT_CLASS} w-60`}
      >
        {CALL_SORT_FIELD_VALUES.map((v) => (
          <option key={v} value={v}>
            {t.sortFieldLabels[v] ?? v}
          </option>
        ))}
      </select>

      <select
        value={sortDirection}
        onChange={(e) => onDirectionChange(e.target.value)}
        aria-label={t.filters.sortDirection}
        className={`${SORT_SELECT_CLASS} w-24`}
      >
        {SORT_DIRECTION_VALUES.map((v) => (
          <option key={v} value={v}>
            {t.sortDirectionLabels[v] ?? v}
          </option>
        ))}
      </select>
    </div>
  );
}
