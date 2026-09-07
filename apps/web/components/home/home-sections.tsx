// ホーム画面（卸業者 / 二次店）が共有する構成部品。
//
// この事業は「期限」と「担当の割当」で売上が決まる催事営業なので、
// どちらのロールのホームも役割は同じ ——「実績を眺める場所」ではなく
// 「滞留している対応を拾う場所」。両者で同じ部品を使い、
// ロールが変わっても画面の読み方が変わらないようにする。

import Link from "next/link";

import type { ReactNode } from "react";

/**
 * 画面内の区切り見出し。
 * 塊をカードで囲うのではなく、小さなラベルと 1 本の罫線で領域を宣言する。
 * カードの中にカードを置くと枠が二重になり、情報密度だけが落ちるため。
 */
export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="border-hairline-light mb-2 flex items-baseline justify-between gap-3 border-b pb-1.5">
      <h2 className="text-mute-light text-xs font-semibold">{children}</h2>
      {action}
    </div>
  );
}

/**
 * 要対応キューの 1 行。
 *
 * 件数は「0 なら静か・1 以上なら目に付く」ようにだけ差を付ける。
 * 0 を巨大な数字として描くと、何も起きていない日の画面が「0」で埋まり、
 * 正常と異常の区別が付かなくなる。数字の大きさは緊急度に使う。
 */
export function TodoRow({
  title,
  count,
  unit,
  hint,
  clearedHint,
  href,
  linkLabel,
}: {
  title: string;
  count: number;
  unit: string;
  hint: string;
  clearedHint: string;
  href: string;
  linkLabel: string;
}) {
  const pending = count > 0;
  return (
    // 狭い画面では遷移リンクを本文の下へ回す。横並びのままだと
    // 見出しとリンクが互いを押し合って、両方とも折り返してしまう。
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
      <div
        className={[
          "w-12 shrink-0 text-right text-2xl font-bold tabular-nums leading-none",
          pending ? "text-ink" : "text-slate-300",
        ].join(" ")}
      >
        {count}
        <span className="ml-0.5 text-xs font-medium">{unit}</span>
      </div>
      <div className="min-w-[12rem] flex-1">
        <h3 className="text-ink text-sm font-semibold">{title}</h3>
        <p className="text-mute-light mt-0.5 text-xs">{pending ? hint : clearedHint}</p>
      </div>
      <Link
        href={href}
        className="text-link-light ml-16 shrink-0 text-xs underline-offset-4 hover:underline sm:ml-0"
      >
        {linkLabel}
      </Link>
    </div>
  );
}

/**
 * 実績の 1 項目。
 * 実績は「確認しに行くもの」なので、要対応より小さく、横一列に畳んで置く。
 */
export function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border-hairline-light flex-1 px-4 py-3 sm:border-l sm:first:border-l-0">
      <p className="text-mute-light text-xs">{label}</p>
      <p className="text-ink mt-1 text-lg font-bold tabular-nums leading-tight">{value}</p>
      {sub ? <p className="text-mute-light mt-0.5 text-xs tabular-nums">{sub}</p> : null}
    </div>
  );
}
