// 運営管理サイトの共通表示部品。
//
// 代理店の一覧部品（list-shell）と同じ配色・余白に合わせた薄い包み。
// 画面ごとに同じマークアップを書かないためのもので、新しい設計は持ち込まない。

import Link from "next/link";

import { labels } from "@/lib/i18n/labels";

import type { ReactNode } from "react";

const c = labels.systemAdmin.common;

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h1 className="text-ink text-xl font-bold">{title}</h1>
      {description ? <p className="text-mute-light mt-1 text-[13px]">{description}</p> : null}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-hairline-light mb-5 rounded-md border bg-white p-4">
      {title ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-ink text-sm font-semibold">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** 数値の要約。単位を必ず添える。 */
export function Metric({
  label,
  value,
  unit,
  href,
}: {
  label: string;
  value: number | string;
  unit?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-mute-light text-xs">{label}</p>
      <p className="text-ink mt-1 text-2xl font-bold tabular-nums">
        {value}
        {unit ? <span className="text-mute-light ml-1 text-xs font-normal">{unit}</span> : null}
      </p>
    </>
  );
  return href ? (
    <Link
      href={href}
      className="border-hairline-light hover:bg-surface-soft focus-visible:ring-primary/40 block rounded-md border p-3 focus:outline-none focus-visible:ring-2"
    >
      {body}
    </Link>
  ) : (
    <div className="border-hairline-light rounded-md border p-3">{body}</div>
  );
}

/** 状態バッジ。色だけで区別せず文字も出す。 */
export function StateBadge({ state, label }: { state: string; label: string }) {
  const tone =
    state === "ACTIVE" || state === "up"
      ? "bg-primary/10 text-primary"
      : state === "SUSPENDED" || state === "down"
        ? "bg-danger/10 text-danger"
        : "border-hairline-light text-mute-light border";
  return (
    <span className={`inline-flex shrink-0 rounded px-1.5 py-0.5 text-[11px] ${tone}`}>
      {label}
    </span>
  );
}

/** 横スクロールできる表の枠。390px でも列が潰れないようにする。 */
export function TableCard({ children }: { children: ReactNode }) {
  return (
    <div className="border-hairline-light overflow-x-auto rounded-md border">
      <table className="w-full min-w-[40rem] text-sm">{children}</table>
    </div>
  );
}

export const TH = "whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-mute-light";
export const TD = "whitespace-nowrap px-3 py-2.5 text-body-light";
export const TD_STRONG = "whitespace-nowrap px-3 py-2.5 font-medium text-ink";

/** ページ送り。件数と現在位置を必ず出す。 */
export function Pager({
  page,
  pages,
  total,
  hrefFor,
}: {
  page: number;
  pages: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const btn =
    "border-hairline-light text-ink hover:bg-surface-soft inline-flex h-9 items-center rounded-md border px-3 text-sm";
  const disabled =
    "border-hairline-light text-mute-light inline-flex h-9 items-center rounded-md border px-3 text-sm opacity-50";
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-mute-light text-xs tabular-nums">
        {c.total.replace("{n}", String(total))} ／{" "}
        {c.page.replace("{page}", String(page)).replace("{pages}", String(pages))}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={btn}>
            {c.prev}
          </Link>
        ) : (
          <span className={disabled}>{c.prev}</span>
        )}
        {page < pages ? (
          <Link href={hrefFor(page + 1)} className={btn}>
            {c.next}
          </Link>
        ) : (
          <span className={disabled}>{c.next}</span>
        )}
      </div>
    </div>
  );
}

export function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-mute-light px-3 py-6 text-center text-sm">
        {c.empty}
      </td>
    </tr>
  );
}
