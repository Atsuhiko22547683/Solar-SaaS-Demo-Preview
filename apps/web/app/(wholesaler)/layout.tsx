import { auth } from "@/auth";
import { wholesalerNavFor } from "@/components/layout/nav-items";
import { RoleShell } from "@/components/layout/role-shell";

import type { ReactNode } from "react";

export default async function WholesalerGroupLayout({ children }: { children: ReactNode }) {
  // 設定 / 決済管理はシステムロールで出し分ける（遮断は各ページのガードが行う）。
  const session = await auth();
  return <RoleShell navItems={wholesalerNavFor(session?.user?.roles ?? [])}>{children}</RoleShell>;
}
