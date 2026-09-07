import { dealerNav } from "@/components/layout/nav-items";
import { RoleShell } from "@/components/layout/role-shell";

import type { ReactNode } from "react";

export default function DealerGroupLayout({ children }: { children: ReactNode }) {
  return <RoleShell navItems={dealerNav}>{children}</RoleShell>;
}
