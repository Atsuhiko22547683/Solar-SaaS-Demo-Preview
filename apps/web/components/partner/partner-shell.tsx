"use client";

// 二次店ポータルの画面枠。
//
// 代理店側の RoleShell（多階層サイドバー + 折りたたみ + 通知 …）は持ち込まない。
// 二次店が使うのは 4 画面だけで、Google フォームの置き換えが目的なので、
// 上部に横並びのタブを 1 段置くだけの構成にする。
//
// 390px では横スクロールを作らないよう、タブは折り返す。

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { labels } from "@/lib/i18n/labels";

import type { ReactNode } from "react";

const t = labels.partner;

/** 上部タブ。順序は固定（トップ → アポイント → 催事日報 → 販売員）。 */
const TABS = [
  { href: "/p-home", label: t.nav.home },
  { href: "/p-appointments", label: t.nav.appointments },
  { href: "/p-reports", label: t.nav.reports },
  { href: "/p-salespeople", label: t.nav.salespeople },
] as const;

export function PartnerShell({ isDealer, children }: { isDealer: boolean; children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="bg-page min-h-screen">
      <header className="border-hairline-light border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/p-home" className="inline-flex items-center gap-2">
            <Image
              src="/logo.png"
              alt={labels.brand}
              width={649}
              height={159}
              priority
              className="h-6 w-auto"
            />
            <span className="text-mute-light border-hairline-light border-l pl-2 text-xs">
              {t.title}
            </span>
          </Link>
          {/* サインアウトは常に届く位置に置く。 */}
          <Link href="/api/auth/signout" className="text-mute-light hover:text-ink text-sm">
            {labels.nav.signOut}
          </Link>
        </div>

        {/* 二次店アカウント以外にはタブを出さない（開ける画面が無いため）。 */}
        {isDealer ? (
          <nav aria-label={t.nav.ariaLabel} className="mx-auto max-w-5xl px-4">
            <ul className="flex flex-wrap gap-1">
              {TABS.map((tab) => {
                const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
                return (
                  <li key={tab.href}>
                    <Link
                      href={tab.href}
                      aria-current={active ? "page" : undefined}
                      className={[
                        "focus-visible:ring-primary/40 -mb-px inline-flex h-10 items-center rounded-t-sm border-b-2 px-3 text-sm transition-colors focus:outline-none focus-visible:ring-2",
                        active
                          ? "border-primary text-ink font-semibold"
                          : "text-mute-light hover:text-ink border-transparent",
                      ].join(" ")}
                    >
                      {tab.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
