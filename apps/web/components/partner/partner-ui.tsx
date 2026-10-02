// 二次店ポータルで共有する最小の表示部品。
//
// 代理店側の一覧部品（list-shell）は折りたたみ検索・並び替え・ページャ込みで、
// Google フォーム置き換えには過剰なので持ち込まない。ここに置くのは
// 「見出し」「カード」「定義リスト」「素の表」だけ。
//
// "use client" は付けない（Server Component から直接描く）。

import Link from "next/link";

import { labels } from "@/lib/i18n/labels";

import type { ReactNode } from "react";

const t = labels.partner.common;

export function PartnerPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-ink text-xl font-bold">{title}</h1>
        {description ? <p className="text-mute-light mt-0.5 text-[13px]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PartnerCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={[
        "border-hairline-light rounded-md border bg-white p-4 sm:p-5",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function PartnerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-mute-light text-xs font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** 詳細画面の 1 項目（ラベル上・値下）。未入力は「—」。 */
export function PartnerField({ label, value }: { label: string; value: ReactNode }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="min-w-0">
      <dt className="text-mute-light text-xs leading-tight">{label}</dt>
      <dd className="text-ink mt-0.5 break-words text-sm">
        {empty ? <span className="text-mute-light">{t.dash}</span> : value}
      </dd>
    </div>
  );
}

export function PartnerFieldGrid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>;
}

/** 空状態。0 件は異常ではないので、左寄せで淡々と出す。 */
export function PartnerEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-1 py-8">
      <p className="text-ink text-sm font-medium">{title}</p>
      <p className="text-mute-light mt-1 text-[13px]">{body}</p>
    </div>
  );
}

export const P_TH = "whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-mute-light";
export const P_TD = "px-3 py-3 text-body-light text-sm sm:py-2.5";

/**
 * 狭い画面で主要セルの下に畳む補助情報。
 *
 * 一覧は幅の狭い画面で補助列を隠すが、隠したままだと確認する手段が無くなる。
 * 隠した項目はこの行に「ラベル: 値」で並べ、広い画面では列に戻す。
 */
export const P_SUB = "text-mute-light mt-0.5 block text-xs sm:hidden";

/**
 * 表の横スクロール枠。
 *
 * ページ全体を横スクロールさせず、表の領域内だけで動かす。狭い画面では
 * スクロールできることが分かるよう案内を出し、キーボードでも動かせるよう
 * tabIndex を付ける（スクロール領域はフォーカスできないと操作できない）。
 */
export function PartnerTableScroll({ children }: { children: ReactNode }) {
  return (
    <div>
      <p className="text-mute-light px-3 pt-2 text-[11px] sm:hidden">
        {labels.partner.list.tableScrollHint}
      </p>
      <div
        tabIndex={0}
        className="focus-visible:ring-primary/40 overflow-x-auto focus:outline-none focus-visible:ring-2"
      >
        {children}
      </div>
    </div>
  );
}

/** 一覧の行リンク。狭い画面でも押しやすいよう行全体をリンクにする。 */
export function PartnerRowLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-primary focus-visible:ring-primary/40 rounded-sm font-medium underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2"
    >
      {children}
    </Link>
  );
}
