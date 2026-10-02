"use client";

// 運営管理サイトの画面枠（左サイドメニュー + 上部ヘッダー）。
//
// 代理店の RoleShell（多階層・ロールで切り替え・通知）は持ち込まない。
// 運営管理は 6 メニューの平坦な構成で、サイト区分は起動設定で固定されている。
//
// ヘッダは sticky で画面上部に残す。狭い画面ではサイドメニューを開閉式にし、
// 閉じているときは本文を潰さない（390px で操作不能なはみ出しを作らない）。

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { labels } from "@/lib/i18n/labels";

import type { ReactNode } from "react";

const t = labels.systemAdmin;

/** 6 メニュー。並び順は仕様どおり固定。 */
const MENU = [
  { href: "/s-dashboard", label: t.nav.dashboard },
  { href: "/s-companies", label: t.nav.companies },
  { href: "/s-users", label: t.nav.users },
  { href: "/s-operators", label: t.nav.operators },
  { href: "/s-audit", label: t.nav.audit },
  { href: "/s-status", label: t.nav.status },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function MenuList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="space-y-1">
      {MENU.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={[
                "focus-visible:ring-primary/40 flex min-h-11 items-center rounded-md px-3 text-sm focus:outline-none focus-visible:ring-2 sm:min-h-9",
                active
                  ? "bg-primary font-medium text-white"
                  : "text-body-light hover:bg-surface-soft",
              ].join(" ")}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function SystemAdminShell({
  operatorName,
  environment,
  children,
}: {
  operatorName: string;
  /** 環境区分（ローカル / 本番）。取り違え防止のため常時出す。 */
  environment: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  // 画面が変わったらメニューは閉じる。
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="bg-page min-h-screen">
      <header className="border-hairline-light sticky top-0 z-30 border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:gap-4">
          <div className="flex min-w-0 items-center gap-2">
            {/* 狭い画面のメニュー開閉。広い画面では常設のサイドメニューを出す。 */}
            <button
              type="button"
              aria-expanded={open}
              aria-controls={menuId}
              onClick={() => setOpen((v) => !v)}
              className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-9 shrink-0 items-center rounded-md border px-2 text-xs lg:hidden"
            >
              {open ? t.nav.menuClose : t.nav.menuOpen}
            </button>
            <Link href="/s-dashboard" className="inline-flex min-w-0 items-center gap-2">
              <Image
                src="/logo.png"
                alt={labels.brand}
                width={649}
                height={159}
                priority
                className="h-6 w-auto shrink-0"
              />
              <span className="text-ink truncate text-sm font-semibold">{t.brand}</span>
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {/* 環境区分。ローカルと本番の取り違えを防ぐ。 */}
            <span className="border-hairline-light text-mute-light hidden rounded border px-1.5 py-0.5 text-[11px] sm:inline">
              {t.envLabel}: {environment}
            </span>
            <span className="text-mute-light hidden max-w-[12rem] truncate text-sm md:inline">
              {t.operator}: <span className="text-ink">{operatorName}</span>
            </span>
            <Link
              href="/api/auth/signout"
              className="text-mute-light hover:text-ink whitespace-nowrap text-sm"
            >
              {t.signOut}
            </Link>
          </div>
        </div>

        {/* 狭い画面：開閉メニュー */}
        {open ? (
          <nav
            id={menuId}
            aria-label={t.nav.ariaLabel}
            className="border-hairline-light border-t px-4 py-2 lg:hidden"
          >
            <MenuList pathname={pathname} onNavigate={() => setOpen(false)} />
          </nav>
        ) : null}
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        {/* 広い画面：常設の左サイドメニュー */}
        <nav aria-label={t.nav.ariaLabel} className="hidden w-52 shrink-0 lg:block">
          <div className="sticky top-20">
            <MenuList pathname={pathname} />
          </div>
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
