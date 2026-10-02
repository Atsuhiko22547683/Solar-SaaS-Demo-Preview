"use client";

// 二次店サイトの画面枠（スタッフサイト / 管理者サイト共通）。
//
// 代理店側の RoleShell（多階層サイドバー + 折りたたみ + 通知 …）は持ち込まない。
// 広い画面では上部に横並びのタブを 1 段、狭い画面では開閉メニューにする。
//
// タブは「どのサイトで動いているか」で決まる。利用者のロールでは切り替えない
// （管理者ロールの利用者がスタッフサイトを開いても管理者タブは出ない）。
//
// ヘッダは 2 段（ロゴ行 + ナビ行）をまとめて position: sticky で画面上部に残す。
// スクロール領域はビューポートなので、外側の要素に overflow / 高さ制限を付けない
// （付けると sticky が効かなくなる）。重なり順は z-30 — 本文より前、
// ダイアログ（z-50）より後ろに置き、ダイアログとの前後関係を変えない。
//
// 狭い画面で開閉メニューにする理由:
//   管理者サイトは 9 業務 + トップで 10 本ある。折り返しの横並びだと 320px で
//   4 段になり、本文が画面外へ押し出される。開閉式にして、閉じているときは
//   「いま開いている業務」だけを見せる。

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { labels } from "@/lib/i18n/labels";

import type { PartnerSite } from "@/lib/app-variant";
import type { ReactNode } from "react";

const t = labels.partner;

/**
 * 上部タブ。サイトごとに固定順。
 *
 *   管理者サイト   : トップ → 提出情報（アポイント / 成約報告 / 催事日報）→ 組織（販売員 /
 *                    アカウント）→ 取引・顧客（顧客 / 手数料 / 希望ライン / シフト）
 *   スタッフサイト : トップ → アポイント → 成約報告 → 催事日報 → カタログ → 顧客情報 → シフト
 *
 * 各サイトのプロセスは、もう一方のサイトのパスを middleware で通さない。
 * タブは到達できる画面だけを並べる（表示を隠すだけの制御にしない）。
 */
const ADMIN_TABS = [
  { href: "/p-home", label: t.nav.home },
  { href: "/p-appointments", label: t.nav.appointments },
  { href: "/p-contracts", label: t.nav.contracts },
  { href: "/p-reports", label: t.nav.reports },
  { href: "/p-salespeople", label: t.nav.salespeople },
  { href: "/p-accounts", label: t.nav.accounts },
  { href: "/p-customers", label: t.nav.customers },
  { href: "/p-commissions", label: t.nav.commissions },
  { href: "/p-lane-preferences", label: t.nav.lanePreferences },
  { href: "/p-consultations", label: t.nav.consultations },
  { href: "/p-shifts", label: t.nav.shifts },
] as const;

const STAFF_TABS = [
  { href: "/p-home", label: t.nav.home },
  { href: "/p-appointments", label: t.nav.appointments },
  { href: "/p-contracts", label: t.nav.contracts },
  { href: "/p-reports", label: t.nav.reports },
  { href: "/p-catalog", label: t.nav.catalog },
  { href: "/p-customers", label: t.nav.customers },
  { href: "/p-shifts", label: t.nav.shifts },
  { href: "/p-profile", label: t.nav.profile },
] as const;

interface Tab {
  href: string;
  label: string;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PartnerShell({
  site,
  showNav,
  otherSiteUrl,
  children,
}: {
  site: PartnerSite;
  /** サイトの利用対象でない利用者にはタブを出さない（開ける画面が無いため）。 */
  showNav: boolean;
  /**
   * もう一方のサイト（管理者 ⇄ スタッフ）の URL。両方の利用資格を持つ本人にだけ渡す。
   * 別 URL・別 Cookie のままなので、移動しただけで権限は上がらない。
   */
  otherSiteUrl?: string | null;
  children: ReactNode;
}) {
  const TABS: readonly Tab[] = site === "ADMIN" ? ADMIN_TABS : STAFF_TABS;
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  // 画面が変わったらメニューは閉じる（開いたまま次の画面へ残らないように）。
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const current = TABS.find((tab) => isActive(pathname, tab.href));

  return (
    <div className="bg-page min-h-screen">
      {/* ページ末尾まで追従させる。背景を不透明にして本文が透けないようにする。 */}
      <header className="border-hairline-light sticky top-0 z-30 border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3 sm:gap-4">
          {/* 320px でもロゴ・サイト名・サインアウトが重ならないよう、
              サイト名は詰まったら省略する（サイトの区別はヘッダの役割）。 */}
          <Link href="/p-home" className="inline-flex min-w-0 items-center gap-2">
            <Image
              src="/logo.png"
              alt={labels.brand}
              width={649}
              height={159}
              priority
              className="h-6 w-auto shrink-0"
            />
            <span className="text-mute-light border-hairline-light truncate border-l pl-2 text-xs">
              {site === "ADMIN" ? t.adminTitle : t.title}
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-3">
            {/* 両方の資格を持つ本人だけ、もう一方のサイトへ移動できる。 */}
            {otherSiteUrl ? (
              <a
                href={otherSiteUrl}
                className="text-mute-light hover:text-ink whitespace-nowrap text-sm"
              >
                {site === "ADMIN" ? t.switchToStaff : t.switchToAdmin}
              </a>
            ) : null}
            {/* サインアウトは常に届く位置に置く。 */}
            <Link
              href="/api/auth/signout"
              className="text-mute-light hover:text-ink whitespace-nowrap text-sm"
            >
              {labels.nav.signOut}
            </Link>
          </div>
        </div>

        {/* サイトの利用対象でない利用者にはタブを出さない（開ける画面が無いため）。 */}
        {showNav ? (
          <nav aria-label={t.nav.ariaLabel} className="relative mx-auto max-w-5xl px-4">
            {/* 狭い画面：開閉メニュー。閉じているときは現在の業務だけ見せる。 */}
            <div className="sm:hidden">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={menuId}
                onClick={() => setOpen((v) => !v)}
                className="focus-visible:ring-primary/40 -mx-1 flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-1 text-sm focus:outline-none focus-visible:ring-2"
              >
                <span className="text-ink truncate font-semibold">
                  {current ? current.label : t.nav.menu}
                </span>
                <span className="text-mute-light flex shrink-0 items-center gap-1 text-xs">
                  {open ? t.nav.menuClose : t.nav.menuOpen}
                  <span aria-hidden="true">{open ? "▲" : "▼"}</span>
                </span>
              </button>
              {/* ヘッダの下に重ねて出す。本文を押し出さず、ヘッダの高さも変わらないので
                  追従中に配置が飛ばない。画面の高さが足りないとき（横向き等）は
                  メニュー内だけを縦スクロールさせる。 */}
              <ul
                id={menuId}
                hidden={!open}
                className="border-hairline-light absolute inset-x-0 top-full max-h-[60vh] overflow-y-auto overscroll-contain border-t bg-white px-4 py-1 shadow-lg"
              >
                {TABS.map((tab) => {
                  const active = isActive(pathname, tab.href);
                  return (
                    <li key={tab.href}>
                      <Link
                        href={tab.href}
                        aria-current={active ? "page" : undefined}
                        className={[
                          "focus-visible:ring-primary/40 flex min-h-11 items-center rounded-md px-2 text-sm focus:outline-none focus-visible:ring-2",
                          active
                            ? "bg-surface-soft text-ink font-semibold"
                            : "text-mute-light hover:text-ink",
                        ].join(" ")}
                      >
                        {tab.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* 広い画面：従来どおりの横並びタブ。 */}
            <ul className="hidden flex-wrap gap-1 sm:flex">
              {TABS.map((tab) => {
                const active = isActive(pathname, tab.href);
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
