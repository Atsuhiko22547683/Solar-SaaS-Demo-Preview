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

import { Card } from "@/components/ui/card";

import type { ReactNode } from "react";

// --- 絞り込み領域（customer-filter.tsx と同一） ------------------------------

export const FILTER_LABEL_CLASS = "text-xs font-medium text-mute-light";

export const FILTER_SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-hairline-light bg-white px-3 py-1 text-sm text-body-light focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

export const FILTER_INPUT_CLASS =
  "h-9 appearance-none rounded-md border border-hairline-light bg-white px-3 text-sm text-ink placeholder:text-mute-light focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 [&::-webkit-search-cancel-button]:appearance-none";

// --- テーブル（customer-table.tsx と同一） -----------------------------------

export const LIST_TH =
  "whitespace-nowrap px-6 py-3 text-left text-xs font-medium text-mute-light uppercase tracking-wider";

export const LIST_TD = "whitespace-nowrap px-6 py-3 text-body-light";

export const LIST_TD_STRONG = "whitespace-nowrap px-6 py-3 font-medium text-ink";

export const LIST_TD_NUM = "whitespace-nowrap px-6 py-3 tabular-nums text-body-light";

export const LIST_ROW =
  "cursor-pointer transition-colors hover:bg-mist-light active:bg-surface-soft focus:outline-none focus-visible:bg-mist-light focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40";

// --- 画面骨格 ---------------------------------------------------------------

/** 画面上部のタイトル + 説明文（+ 任意の右上アクション）。 */
export function ListPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-ink text-2xl font-bold">{title}</h1>
        <p className="text-mute-light mt-1 text-sm">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

/** 検索・絞り込みを収める白いカード。 */
export function ListFilterCard({ children }: { children: ReactNode }) {
  return <Card className="p-4">{children}</Card>;
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
  return (
    <Card className="overflow-hidden p-0">
      {isEmpty ? (
        <div className="p-12 text-center">
          <p className="text-ink font-medium">{emptyTitle}</p>
          <p className="text-mute-light mt-2 text-sm">{emptyBody}</p>
        </div>
      ) : (
        children
      )}
    </Card>
  );
}
