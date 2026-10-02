import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { applyBillingBlockToNav, wholesalerNavFor } from "@/components/layout/nav-items";
import { RoleShell } from "@/components/layout/role-shell";
import { isBillingBlocked, isPathAllowedWhileBlocked } from "@/lib/billing/access";
import { getBillingSnapshot } from "@/lib/billing/resolve";

import type { ReactNode } from "react";

// 卸業者グループ共通のレイアウト。
//
// ここが「支払い起因の利用制限」の唯一のガード。各ページに if を足さず、
// このグループ配下（顧客 / イベント / 手数料 / 製品カタログ / 設定 …）へ
// まとめて効かせる。決済情報が未登録、または未払いのときは、ホームと決済管理
// 以外を開けない — サイドバーで非活性にするだけでは URL 直打ちで開けてしまうため。
//
// pathname は layout へ渡ってこないので、middleware が付ける x-pathname を読む
// （Stripe API は Edge の middleware から呼べないため、判定自体はここ = Node 側）。

export default async function WholesalerGroupLayout({ children }: { children: ReactNode }) {
  // 設定 / 決済管理はシステムロールで出し分ける（遮断は各ページのガードが行う）。
  const session = await auth();
  const roles = session?.user?.roles ?? [];

  const billing = await getBillingSnapshot();
  const blocked = isBillingBlocked(billing.status);

  if (blocked) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    // ホームへ戻す。ホームには理由と次の一手（オーナーなら決済管理ページ、
    // それ以外はオーナーへの依頼）を出しているので、行き止まりにはならない。
    if (pathname && !isPathAllowedWhileBlocked(pathname)) {
      redirect("/dashboard");
    }
  }

  const nav = wholesalerNavFor(roles);
  return <RoleShell navItems={blocked ? applyBillingBlockToNav(nav) : nav}>{children}</RoleShell>;
}
