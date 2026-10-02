"use client";

// スマートフォン用の並べ替え選択欄。
//
// 列見出し（list-filter.tsx の SortableTh）と同じ URL クエリ（sort / dir）を
// 読み書きするので、両者は常に同じ並べ替え状態を共有する。選択すると先頭ページへ戻す。
// 列見出しは狭い幅で隠れる列があるため、ここでは並べ替え可能な全列を出す。

import { useRouter } from "next/navigation";

import { labels } from "@/lib/i18n/labels";
import { withParams, type RawParams, type SortState } from "@/lib/partner/list-query";

const t = labels.partner.list;

// 狭い画面専用の部品なので、高さ 44px・文字 16px で固定する。
const SELECT_CLASS =
  "border-ash-light text-ink focus:border-primary focus:ring-primary/40 h-11 min-w-0 flex-1 rounded-md border bg-white px-3 text-base focus:outline-none focus:ring-2";

export function SortSelect<F extends string>({
  basePath,
  params,
  sort,
  options,
}: {
  basePath: string;
  params: RawParams;
  sort: SortState<F>;
  options: { field: F; label: string }[];
}) {
  const router = useRouter();
  const current = `${sort.field}:${sort.direction}`;

  function onChange(value: string) {
    const [field, dir] = value.split(":");
    router.push(withParams(basePath, params, { sort: field, dir, page: undefined }));
  }

  return (
    <div className="mb-3 flex items-center gap-2">
      <label htmlFor="list-sort" className="text-mute-light shrink-0 text-xs">
        {t.sortLabel}
      </label>
      <select
        id="list-sort"
        className={SELECT_CLASS}
        value={current}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.flatMap((o) => [
          <option key={`${o.field}:asc`} value={`${o.field}:asc`}>
            {o.label} {t.asc}
          </option>,
          <option key={`${o.field}:desc`} value={`${o.field}:desc`}>
            {o.label} {t.desc}
          </option>,
        ])}
      </select>
    </div>
  );
}
