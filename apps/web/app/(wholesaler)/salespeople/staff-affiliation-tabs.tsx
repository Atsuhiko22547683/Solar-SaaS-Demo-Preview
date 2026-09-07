// スタッフ一覧の所属タブ（自社スタッフ / 取引先スタッフ）。
//
// 見た目・アクセシビリティ属性は共通の ListTabs が持つ。ここは
// 「どのタブがどの URL に対応するか」という画面固有の対応表だけを持つ。
// タブ切り替え時に検索条件はリセットする（取引先タブ専用の絞り込みを
// 自社タブへ持ち越さないため）。

import { ListTabs } from "@/components/list/list-shell";
import { labels } from "@/lib/i18n/labels";

import type { StaffAffiliation } from "@solar/contracts";

export function StaffAffiliationTabs({ current }: { current: StaffAffiliation }) {
  const t = labels.salespersonList.tabs;

  return (
    <ListTabs
      current={current}
      ariaLabel={labels.salespersonList.title}
      items={[
        { value: "self", label: t.self, href: "/salespeople" },
        { value: "dealer", label: t.dealer, href: "/salespeople?tab=dealer" },
      ]}
    />
  );
}
