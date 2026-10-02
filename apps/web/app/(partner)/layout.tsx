import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ListQueryScope } from "@/components/partner/list-query-scope";
import { PartnerShell } from "@/components/partner/partner-shell";
import { PartnerSiteMismatch } from "@/components/partner/site-mismatch";
import { partnerSiteFor } from "@/lib/app-variant";
import { partnerRoleForSite } from "@/lib/partner/role";
import { siteBaseUrl } from "@/lib/site-urls";

import type { ReactNode } from "react";

// 二次店サイト共通のレイアウト。
//
// この配下は APP_VARIANT=partner（スタッフサイト）/ partner-admin（管理者サイト）の
// プロセスでのみ意味を持つ。代理店サイトで /p-* を開こうとした場合は middleware が
// 先に弾くが、ここでも落として「環境変数を変えれば同じビルドで 3 サイト動く」構成の
// 取り違えを防ぐ。
//
// サイトの利用対象でないロール（管理者サイトをスタッフが開く等）は、タブを出さずに
// 案内だけを返す。実際の認可は各ローダー / Server Action が requirePartnerContext() で
// もう一度行う（画面を隠すだけにしない）。

export default async function PartnerGroupLayout({ children }: { children: ReactNode }) {
  const site = partnerSiteFor();
  if (!site) {
    redirect("/dashboard");
  }

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // サイト区分は起動設定だけで決まる。ロールでサイトが変わることはない。
  const role = partnerRoleForSite(site, session.user.roles);

  if (!role) {
    return (
      <PartnerShell site={site} showNav={false}>
        <PartnerSiteMismatch site={site} roles={session.user.roles} />
      </PartnerShell>
    );
  }

  // 管理者はスタッフとしても働くので、両方の利用資格を持つ本人だけに
  // もう一方のサイトへの導線を出す。別 URL・別 Cookie のままなので、
  // 移動しただけでは権限は上がらない（先方のサイトで改めてサインインする）。
  const otherSite = site === "ADMIN" ? "STAFF" : "ADMIN";
  const canUseOther = partnerRoleForSite(otherSite, session.user.roles) !== null;
  const otherSiteUrl = canUseOther
    ? siteBaseUrl(otherSite === "ADMIN" ? "partner-admin" : "partner")
    : null;

  return (
    <PartnerShell site={site} showNav otherSiteUrl={otherSiteUrl}>
      {/* 一覧の検索条件の控えは利用者 + サイトごと。切り替わったら前の条件を捨てる。 */}
      <ListQueryScope scope={`${session.user.id}:${site}`} />
      {children}
    </PartnerShell>
  );
}
