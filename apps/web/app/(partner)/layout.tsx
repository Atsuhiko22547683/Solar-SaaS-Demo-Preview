import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PartnerShell } from "@/components/partner/partner-shell";
import { isPartnerVariant } from "@/lib/app-variant";

import type { ReactNode } from "react";

// 二次店ポータル共通のレイアウト。
//
// この配下は APP_VARIANT=partner の実行環境でのみ意味を持つ。代理店環境で
// /p-* を開こうとした場合は middleware が先に弾くが、ここでも落として
// 「環境変数を変えれば同じビルドで両方動く」構成の取り違えを防ぐ。
//
// 二次店以外（代理店 / SaaS 運営者）のアカウントがこの環境へログインした場合は、
// 黙って 404 にせず案内ページへ送る（原因が分からない問い合わせを生まないため）。
// 実際の認可は各ローダー / Server Action が requirePartnerContext() で行う。

export default async function PartnerGroupLayout({ children }: { children: ReactNode }) {
  if (!isPartnerVariant()) {
    redirect("/dashboard");
  }

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const isDealer = session.user.roles.some((r) => r === "DEALER_ADMIN" || r === "DEALER_STAFF");

  return <PartnerShell isDealer={isDealer}>{children}</PartnerShell>;
}
