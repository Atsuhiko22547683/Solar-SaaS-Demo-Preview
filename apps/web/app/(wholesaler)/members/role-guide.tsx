// システムユーザー一覧の権限早見表。
//
// ロールの意味を毎回ドキュメントで確認しなくて済むよう、一覧の上に常設する。
// カードを 3 枚積むと画面の主役（一覧）より目立ってしまうので、
// 罫線 1 本の横長領域に収め、1440px では 3 カラム・狭い画面では縦積みにする。

import { labels } from "@/lib/i18n/labels";

export function RoleGuide() {
  const t = labels.memberManagement.roleGuide;

  return (
    <section
      aria-label={t.title}
      className="border-hairline-light bg-surface-soft/40 rounded-md border px-4 py-3"
    >
      <h2 className="text-mute-light text-xs font-semibold">{t.title}</h2>
      <dl className="mt-2 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-3">
        {t.items.map((item) => (
          <div key={item.role} className="flex items-baseline gap-2">
            <dt className="text-ink shrink-0 text-[13px] font-medium">{item.role}</dt>
            <dd className="text-mute-light text-[13px]">{item.scope}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
