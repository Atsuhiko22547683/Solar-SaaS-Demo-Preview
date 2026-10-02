// 旧「パートナー報告」メニューの各画面に出す、統合先への案内。
//
// これらの画面は閲覧専用で、同じ内容をイベント管理・顧客管理からも見られるようにした
// （代理店-01）。旧 URL を急に消すと、共有されたリンクやブックマークが行き止まりになる。
// 権限確認は各画面のままで、ここは導線だけを足す。

import Link from "next/link";

import { labels } from "@/lib/i18n/labels";

const t = labels.integratedViewNotice;

export function IntegratedViewNotice({
  body,
  links,
}: {
  body: string;
  links: Array<{ href: string; label: string }>;
}) {
  return (
    <aside className="border-hairline-light bg-surface-soft/50 space-y-2 rounded-md border p-3">
      <p className="text-body-light text-sm">{body}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-primary text-sm underline underline-offset-4"
          >
            {l.label}
          </Link>
        ))}
      </div>
      <p className="text-mute-light text-xs">{t.keepsPermissions}</p>
    </aside>
  );
}
