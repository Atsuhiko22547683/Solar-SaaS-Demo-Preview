// 顧客管理系の横断一覧画面（アポイント / 契約 / 施工 / 設置申請 / ローン審査）が
// 共有するレイアウト部品とスタイル定数。
//
// 基準は S-032 顧客一覧（app/(wholesaler)/customers/page.tsx, customer-table.tsx,
// customer-filter.tsx）。新しいデザイン体系は作らず、そこで確立済みの
// カード余白 / テーブル行高 / 罫線 / タイポグラフィ / フォーカスリングを
// そのまま定数として切り出している。顧客一覧本体は既に安定稼働しているため
// 変更していない（将来この定数へ寄せる余地は残す）。
//
// "use client" は付けない — スタイル定数は client component からも import される。

import Link from "next/link";

import { Card } from "@/components/ui/card";

import type { ReactNode } from "react";

// --- 絞り込み領域（customer-filter.tsx と同一） ------------------------------

export const FILTER_LABEL_CLASS = "text-xs font-semibold text-mute-light";

// 入力欄の枠は ash-light（白背景に対し 3.28:1）。WCAG 1.4.11 が UI 部品の
// 境界に求める 3:1 を満たす。フォーカスリングは 40% で、キーボード操作時に
// 現在地が確実に見える濃さにする。
export const FILTER_SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-ash-light bg-white px-3 py-1 text-sm text-body-light focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary";

export const FILTER_INPUT_CLASS =
  "h-9 appearance-none rounded-md border border-ash-light bg-white px-3 text-sm text-ink placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 [&::-webkit-search-cancel-button]:appearance-none";

// --- テーブル ---------------------------------------------------------------
//
// 業務データの走査が主目的なので、1 画面に入る行数を優先した密度にする
// （行高 約 40px）。見出しに uppercase / tracking は掛けない — 日本語に
// 大文字は無く、字間が開いて読みにくくなるだけのため。

export const LIST_TH =
  "whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold text-mute-light";

export const LIST_TD = "whitespace-nowrap px-4 py-2.5 text-body-light";

export const LIST_TD_STRONG = "whitespace-nowrap px-4 py-2.5 font-medium text-ink";

export const LIST_TD_NUM = "whitespace-nowrap px-4 py-2.5 tabular-nums text-body-light";

export const LIST_ROW =
  "cursor-pointer transition-colors hover:bg-page active:bg-surface-soft focus:outline-none focus-visible:bg-page focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60";

/**
 * 画面幅ごとの列の出し分け。
 *
 * 全テーブルへ同じ設定を機械的に当てるのではなく、画面ごとに
 * 「その一覧を開いた人が最初に何を判断するか」で段を決める。
 * ここは段の語彙だけを提供し、どの列をどの段に置くかは各テーブルが持つ。
 *
 *   ALWAYS … 対象の識別と、その画面の主目的にあたる状態
 *   SM     … 次の行動を決めるのに要る情報（640px〜）
 *   MD     … 補助的な状態（768px〜）
 *   LG     … 絞り込みの軸で、走査中に常時見てはいない列（1024px〜）
 *   XL     … 連絡先・メタ情報など、必要になったら見る列（1280px〜）
 */
export const COL_ALWAYS = "";
export const COL_SM = "hidden sm:table-cell";
export const COL_MD = "hidden md:table-cell";
export const COL_LG = "hidden lg:table-cell";
export const COL_XL = "hidden xl:table-cell";

// --- 画面骨格 ---------------------------------------------------------------

/**
 * 画面上部のタイトル（+ 任意の説明文 / 右上アクション）。
 *
 * subtitle は任意。「〇〇を一覧で確認できます」のように画面名から読み取れる
 * 内容しか持たない説明文は渡さない — 縦 1 段ぶん一覧が下へ押し出されるだけで、
 * 読む理由が無いため。業務上の補足がある場合だけ渡す。
 */
export function ListPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  // 見出しは 20px。業務ツールでは画面名より一覧そのものが主役なので、
  // タイトルに視線を奪わせず、その分の高さをデータ表示へ回す。
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-ink text-xl font-bold">{title}</h1>
        {subtitle ? <p className="text-mute-light mt-0.5 text-[13px]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** 一覧上部のタブ 1 つ分。 */
export interface ListTabItem {
  /** URL の識別子（?tab= の値など）。 */
  value: string;
  label: string;
  href: string;
}

/**
 * 一覧上部のタブ（所属タブなど）。
 *
 * スタッフ一覧とシステムユーザー一覧で下線・字送り・高さが別々になっていたため、
 * ここに 1 つだけ持つ。role="tablist" / aria-selected を明示して、
 * キーボード・スクリーンリーダーからも現在地が分かるようにする。
 */
export function ListTabs({
  items,
  current,
  ariaLabel,
}: {
  items: ListTabItem[];
  current: string;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="border-hairline-light flex gap-1 border-b"
    >
      {items.map((tab) => {
        const isActive = tab.value === current;
        return (
          <Link
            key={tab.value}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={[
              "focus-visible:ring-primary/40 -mb-px rounded-t-sm border-b-2 px-4 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2",
              isActive
                ? "border-primary text-ink font-semibold"
                : "text-mute-light hover:text-ink border-transparent",
            ].join(" ")}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

/** 検索・絞り込みを収める白いカード。 */
export function ListFilterCard({ children }: { children: ReactNode }) {
  return <Card className="p-3">{children}</Card>;
}

/** 一覧上部の表示件数。 */
export function ListResultCount({ total, template }: { total: number; template: string }) {
  return <p className="text-mute-light text-sm">{template.replace("{total}", String(total))}</p>;
}

/** テーブル本体を収めるカード。0 件のときは空表示に切り替える。 */
export function ListTableCard({
  isEmpty,
  emptyTitle,
  emptyBody,
  children,
}: {
  isEmpty: boolean;
  emptyTitle: string;
  emptyBody: string;
  children: ReactNode;
}) {
  // 空表示は左揃え・上寄せにする。中央に大きく置くと「壊れている」ように
  // 見えるが、業務上は「まだ 0 件」という通常の状態でしかないため。
  return (
    <Card className="overflow-hidden p-0">
      {isEmpty ? (
        <div className="px-4 py-10">
          <p className="text-ink text-sm font-medium">{emptyTitle}</p>
          <p className="text-mute-light mt-1 text-[13px]">{emptyBody}</p>
        </div>
      ) : (
        children
      )}
    </Card>
  );
}
