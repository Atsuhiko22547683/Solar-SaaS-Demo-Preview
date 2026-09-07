import Link from "next/link";

import { labels } from "@/lib/i18n/labels";

import { CONTRACT_STATUS_VALUES } from "./constants";

import type { ContractStatusValue } from "./constants";

/**
 * 契約状況のクイック絞り込み。
 *
 * 顧客一覧で最も頻繁に切り替える条件は契約状況ひとつなので、
 * 「検索条件」アコーディオンを開かせずに 1 クリックで到達できるようにする。
 * 使うのは既存の `contractStatus` クエリパラメータだけで、
 * 新しい絞り込み条件はサーバ側に追加していない。
 *
 * 全 7 値を横に並べるとタブ自体が一覧を圧迫するため、日常的に使う
 * 4 つ（商談中 / 見積提示済 / 契約済 / 失注）に絞り、残りは
 * 「詳細条件」の契約状況セレクトから選ぶ。
 */
const QUICK_VALUES: ContractStatusValue[] = [
  "negotiating",
  "quote_presented",
  "contracted",
  "lost",
];

export function StatusQuickFilter({
  current,
  buildUrl,
}: {
  /** 現在選択中の契約状況。未選択（すべて）は空文字。 */
  current: string;
  buildUrl: (status: string) => string;
}) {
  const t = labels.customer;
  const items: { value: string; label: string }[] = [
    { value: "", label: t.quickFilters.all },
    ...QUICK_VALUES.filter((v) => CONTRACT_STATUS_VALUES.includes(v)).map((v) => ({
      value: v,
      label: t.contractStatusLabels[v],
    })),
  ];

  return (
    <nav aria-label={t.columns.contractStatus} className="flex flex-wrap items-center gap-1">
      {items.map((it) => {
        const active = current === it.value;
        return (
          <Link
            key={it.value || "all"}
            href={buildUrl(it.value)}
            aria-current={active ? "page" : undefined}
            className={[
              "rounded-md px-3 py-1.5 text-[13px] transition-colors",
              active
                ? "bg-primary/10 text-primary font-medium"
                : "text-body-light hover:bg-surface-soft",
            ].join(" ")}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
