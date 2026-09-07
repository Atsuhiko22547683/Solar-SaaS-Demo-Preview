import { saasAdminNav } from "@/components/layout/nav-items";
import { RoleShell } from "@/components/layout/role-shell";

import type { ReactNode } from "react";

export default function SaasAdminGroupLayout({ children }: { children: ReactNode }) {
  return <RoleShell navItems={saasAdminNav}>{children}</RoleShell>;
}
