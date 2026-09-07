import { auth } from "@/auth";
import { navForRoles } from "@/components/layout/nav-items";
import { RoleShell } from "@/components/layout/role-shell";

import type { ReactNode } from "react";

// 通知 / プロフィール / 監査ログなど、どのロールからも開く共通画面。
// ナビ定義は nav-items.ts が唯一の情報源なので、ここへ来てもメニュー構成は
// 各ロールのホームと完全に同一になる。
export default async function CommonGroupLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const navItems = navForRoles(session?.user?.roles ?? [], session?.user?.isSaasAdmin ?? false);

  return <RoleShell navItems={navItems}>{children}</RoleShell>;
}
