// 二次店管理者だけが開ける画面のガード（レイアウト・ページから使う）。
//
// 画面を隠すためのものではない。実際の認可は各ローダー / Server Action の
// requirePartnerContext が「サイト区分 + ロール」で行い、Server Action の
// 直接呼び出しもそこで 403 になる。ここは、対象外の利用者が URL を直打ちしたときに
// 崩れた画面ではなく「管理者サイトのみ」と分かる案内を返すためのもの。
//
// 管理者サイトのプロセスでは middleware がパスごと塞ぐので、ここへ来るのは
// スタッフサイトと共通のパス（顧客の編集画面など）だけ。

import "server-only";

import Link from "next/link";

import { auth } from "@/auth";
import { partnerSiteFor } from "@/lib/app-variant";
import { labels } from "@/lib/i18n/labels";
import { partnerRoleForSite } from "@/lib/partner/role";

import type { ReactNode } from "react";

/**
 * いま管理者サイトを、管理者として開いているか。
 *
 * ページのデータ取得より **前** に呼ぶ。データ取得（requirePartnerContext）を先に走らせると、
 * 対象外の利用者には案内ではなくエラー画面が出てしまう。
 */
export async function isPartnerAdminSiteUser(): Promise<boolean> {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  const site = partnerSiteFor();
  return site === "ADMIN" && partnerRoleForSite(site, roles) === "ADMIN";
}

/** 管理者サイト以外では、案内だけを返すガード。 */
export function PartnerAdminOnlyNotice() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-ink text-lg font-bold">{labels.common.forbidden}</h1>
      <p role="alert" className="text-mute-light text-sm">
        {labels.partner.errors.adminOnly}
      </p>
      <Link href="/p-home" className="text-primary text-sm underline-offset-4 hover:underline">
        {labels.common.forbiddenBack}
      </Link>
    </div>
  );
}

export async function PartnerAdminOnly({ children }: { children: ReactNode }) {
  if (!(await isPartnerAdminSiteUser())) return <PartnerAdminOnlyNotice />;
  return <>{children}</>;
}
