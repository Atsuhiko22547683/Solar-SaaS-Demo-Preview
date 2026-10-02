// 二次店ポータルの一覧共通：検索・絞り込みフォームと並べ替え見出し・ページ送り。
//
// 検索条件はふつうの GET フォームで URL クエリへ載せる（JS 無しでも動き、URL に
// 状態が残る）。並べ替えの列見出しとページ送りはリンク。どちらも Server Component
// から描けるよう "use client" は付けない。スマートフォン用の並べ替え選択欄だけ
// クライアント部品（list-sort-select.tsx）に分ける。
//
// 「詳細条件」は <details> で畳む。状態を持たないので、条件を入れた再読み込みでも
// 入力値は URL から復元される（開閉状態だけは保持しない）。

import Link from "next/link";

import { labels } from "@/lib/i18n/labels";
import { sortHref, type RawParams, type SortState } from "@/lib/partner/list-query";

import { RememberListQuery } from "./remember-list-query";

import type { ReactNode } from "react";

const t = labels.partner.list;

// 狭い画面では高さ 44px・文字 16px。16px 未満だと iOS が focus 時に自動拡大し、
// 「読むために拡大縮小が要らない」という前提が崩れる。広い画面は従来どおり。
// scroll-mt-28 は追従ヘッダ（2 段で最大 92px 程度）の分。
export const FILTER_INPUT_CLASS =
  "border-ash-light text-ink focus:border-primary focus:ring-primary/40 h-11 w-full scroll-mt-28 rounded-md border bg-white px-3 text-base focus:outline-none focus:ring-2 disabled:bg-surface-soft disabled:text-mute-light sm:h-9 sm:text-sm";

/** 検索フォームの枠。action は一覧のパス。並べ替えは hidden で引き継ぐ。 */
export function FilterPanel({
  action,
  sort,
  errors,
  children,
  advanced,
  advancedActive,
  notes,
}: {
  action: string;
  sort: SortState<string>;
  errors: string[];
  children: ReactNode;
  /** 「詳細条件」に畳む条件。 */
  advanced?: ReactNode;
  /**
   * 詳細条件に値が入っているか。畳んだままだと「効いている条件が見えない」ので、
   * 入っているときは最初から開き、見出しにも印を出す。
   */
  advancedActive?: boolean;
  /** 条件の適用状況などの注記。 */
  notes?: string[];
}) {
  return (
    <form
      method="get"
      action={action}
      className="border-hairline-light mb-4 rounded-lg border bg-white p-4"
      aria-label={t.filterTitle}
    >
      {/* 詳細から戻れるよう、いまの条件を控える。 */}
      <RememberListQuery basePath={action} />
      {/* 条件を変えても並べ替えは解除しない。ページは先頭へ戻す（hidden に含めない）。 */}
      <input type="hidden" name="sort" value={sort.field} />
      <input type="hidden" name="dir" value={sort.direction} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>

      {advanced ? (
        <details className="mt-3" open={advancedActive}>
          <summary className="text-primary flex min-h-11 cursor-pointer items-center gap-2 text-sm underline-offset-4 hover:underline sm:min-h-0">
            <span>{t.advanced}</span>
            {advancedActive ? (
              <span className="bg-primary/10 text-primary rounded-sm px-1.5 py-0.5 text-[11px] font-medium">
                {t.advancedActive}
              </span>
            ) : null}
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {advanced}
          </div>
        </details>
      ) : null}

      {errors.length > 0 ? (
        <ul role="alert" className="text-danger mt-3 space-y-1 text-xs">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {notes && notes.length > 0 ? (
        <ul className="text-mute-light mt-3 space-y-1 text-xs">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}

      {/* 狭い画面では縦に積み、指で押しやすい高さ（44px）にする。 */}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Link
          href={action}
          className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 items-center justify-center rounded-md border px-4 text-sm sm:h-9"
        >
          {t.clear}
        </Link>
        <button
          type="submit"
          className="bg-primary focus-visible:ring-primary/40 inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 sm:h-9"
        >
          {t.apply}
        </button>
      </div>
    </form>
  );
}

export function FilterField({
  label,
  htmlFor,
  children,
  hint,
  wide,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  hint?: string;
  /** 2 列ぶん使う（期間・範囲など）。 */
  wide?: boolean;
}) {
  return (
    <div className={wide ? "space-y-1 sm:col-span-2" : "space-y-1"}>
      <label htmlFor={htmlFor} className="text-mute-light block text-xs font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-mute-light text-[11px]">{hint}</p> : null}
    </div>
  );
}

/** 期間（開始 / 終了）。 */
export function DateRangeField({
  label,
  name,
  from,
  to,
  disabled,
  hint,
}: {
  label: string;
  /** name + "From" / "To" をパラメータ名にする。 */
  name: string;
  from?: string;
  to?: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <FilterField label={label} htmlFor={`${name}From`} wide hint={hint}>
      {/* date 入力は既定幅が広く、320px に 2 つ並べると画面外へ出る。
          狭い画面では縦に積み、区切りの「〜」も行として見せる。 */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
        <input
          id={`${name}From`}
          name={`${name}From`}
          type="date"
          aria-label={`${label} ${t.from}`}
          defaultValue={from ?? ""}
          disabled={disabled}
          className={FILTER_INPUT_CLASS}
        />
        <span aria-hidden="true" className="text-mute-light text-center text-xs sm:text-left">
          〜
        </span>
        <input
          id={`${name}To`}
          name={`${name}To`}
          type="date"
          aria-label={`${label} ${t.to}`}
          defaultValue={to ?? ""}
          disabled={disabled}
          className={FILTER_INPUT_CLASS}
        />
      </div>
    </FilterField>
  );
}

/**
 * 対象月の範囲（開始 / 終了）。値は 'YYYY-MM'。
 *
 * 日付ではなく月単位で持っている列（Incentive.settledMonth 等）に使う。
 * 入力は type="month" なので、ブラウザ側でも月だけの入力になる。
 */
export function MonthRangeField({
  label,
  name,
  from,
  to,
  hint,
}: {
  label: string;
  /** name + "From" / "To" をパラメータ名にする。 */
  name: string;
  from?: string;
  to?: string;
  hint?: string;
}) {
  return (
    <FilterField label={label} htmlFor={`${name}From`} wide hint={hint}>
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
        <input
          id={`${name}From`}
          name={`${name}From`}
          type="month"
          aria-label={`${label} ${t.from}`}
          defaultValue={from ?? ""}
          className={FILTER_INPUT_CLASS}
        />
        <span aria-hidden="true" className="text-mute-light text-center text-xs sm:text-left">
          〜
        </span>
        <input
          id={`${name}To`}
          name={`${name}To`}
          type="month"
          aria-label={`${label} ${t.to}`}
          defaultValue={to ?? ""}
          className={FILTER_INPUT_CLASS}
        />
      </div>
    </FilterField>
  );
}

/** 数値範囲（下限 / 上限）。 */
export function NumberRangeField({
  label,
  name,
  min,
  max,
  unit,
}: {
  label: string;
  name: string;
  min?: number;
  max?: number;
  unit?: string;
}) {
  return (
    <FilterField label={unit ? `${label}（${unit}）` : label} htmlFor={`${name}Min`} wide>
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
        <input
          id={`${name}Min`}
          name={`${name}Min`}
          inputMode="numeric"
          aria-label={`${label} ${t.min}`}
          placeholder={t.min}
          defaultValue={min ?? ""}
          className={FILTER_INPUT_CLASS}
        />
        <span aria-hidden="true" className="text-mute-light text-center text-xs sm:text-left">
          〜
        </span>
        <input
          id={`${name}Max`}
          name={`${name}Max`}
          inputMode="numeric"
          aria-label={`${label} ${t.max}`}
          placeholder={t.max}
          defaultValue={max ?? ""}
          className={FILTER_INPUT_CLASS}
        />
      </div>
    </FilterField>
  );
}

/** 選択式。先頭に「すべて」。 */
export function SelectField({
  label,
  name,
  value,
  options,
  disabled,
  hint,
}: {
  label: string;
  name: string;
  value?: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <FilterField label={label} htmlFor={name} hint={hint}>
      <select
        id={name}
        name={name}
        defaultValue={value ?? ""}
        disabled={disabled}
        className={FILTER_INPUT_CLASS}
      >
        <option value="">{t.all}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FilterField>
  );
}

/** 文字列の部分一致。 */
export function TextField({
  label,
  name,
  value,
  disabled,
  hint,
}: {
  label: string;
  name: string;
  value?: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <FilterField label={label} htmlFor={name} hint={hint}>
      <input
        id={name}
        name={name}
        type="search"
        defaultValue={value ?? ""}
        placeholder={t.keywordPlaceholder}
        disabled={disabled}
        className={FILTER_INPUT_CLASS}
      />
    </FilterField>
  );
}

/** 件数とページ位置。 */
export function ResultSummary({
  total,
  page,
  pageCount,
}: {
  total: number;
  page: number;
  pageCount: number;
}) {
  return (
    <p className="text-mute-light mb-3 text-sm" aria-live="polite">
      {t.resultCount.replace("{total}", String(total))}
      {pageCount > 1 ? (
        <span className="ml-2">
          {t.pageOf.replace("{page}", String(page)).replace("{pageCount}", String(pageCount))}
        </span>
      ) : null}
    </p>
  );
}

/** 並べ替え可能な列見出し。現在の対象列と方向を aria-sort と矢印で示す。 */
export function SortableTh<F extends string>({
  field,
  label,
  basePath,
  params,
  sort,
  className,
}: {
  field: F;
  label: string;
  basePath: string;
  params: RawParams;
  sort: SortState<F>;
  className: string;
}) {
  const active = sort.field === field;
  const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : "none";
  return (
    <th scope="col" aria-sort={ariaSort} className={className}>
      <Link
        href={sortHref(basePath, params, sort, field)}
        className="focus-visible:ring-primary/40 inline-flex items-center gap-1 rounded-sm focus:outline-none focus-visible:ring-2"
        title={active ? (sort.direction === "asc" ? t.sortedAsc : t.sortedDesc) : t.sortLabel}
      >
        <span>{label}</span>
        <span aria-hidden="true" className={active ? "text-primary" : "text-mute-light/60"}>
          {active ? (sort.direction === "asc" ? "▲" : "▼") : "⇅"}
        </span>
        {active ? (
          <span className="sr-only">{sort.direction === "asc" ? t.sortedAsc : t.sortedDesc}</span>
        ) : null}
      </Link>
    </th>
  );
}

/** ページ送り（前へ / 次へ）。1 ページに収まるときは出さない。 */
export function Pagination({
  basePath,
  params,
  page,
  pageCount,
}: {
  basePath: string;
  params: RawParams;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const linkClass =
    "border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 items-center rounded-md border px-4 text-sm sm:h-9 sm:px-3";
  const disabledClass =
    "border-hairline-light text-mute-light/60 inline-flex h-11 cursor-not-allowed items-center rounded-md border px-4 text-sm sm:h-9 sm:px-3";
  const build = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      const s = Array.isArray(v) ? v[0] : v;
      if (s) sp.set(k, s);
    }
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <nav
      aria-label={t.pageOf
        .replace("{page}", String(page))
        .replace("{pageCount}", String(pageCount))}
      className="mt-4 flex flex-wrap items-center justify-between gap-2"
    >
      {page > 1 ? (
        <Link href={build(page - 1)} className={linkClass}>
          {t.prev}
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          {t.prev}
        </span>
      )}
      <span className="text-mute-light text-sm tabular-nums">
        {t.pageOf.replace("{page}", String(page)).replace("{pageCount}", String(pageCount))}
      </span>
      {page < pageCount ? (
        <Link href={build(page + 1)} className={linkClass}>
          {t.next}
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          {t.next}
        </span>
      )}
    </nav>
  );
}

/** 0 件表示。条件入力欄は残す（このコンポーネントは表の代わりに置くだけ）。 */
export function NoMatch() {
  return (
    <div className="px-4 py-8">
      <p className="text-ink text-sm font-medium">{t.noMatch}</p>
      <p className="text-mute-light mt-1 text-xs">{t.noMatchHint}</p>
    </div>
  );
}
