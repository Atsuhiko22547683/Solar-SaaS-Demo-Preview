// 希望ラインの提出（二次店管理者のみ）。

import { PartnerAdminOnly } from "@/components/partner/admin-only";

import type { ReactNode } from "react";

export default async function PartnerLanePreferencesLayout({ children }: { children: ReactNode }) {
  return <PartnerAdminOnly>{children}</PartnerAdminOnly>;
}
