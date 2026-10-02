// 販売員管理（二次店管理者のみ）。ガードは共通コンポーネントに一本化する。

import { PartnerAdminOnly } from "@/components/partner/admin-only";

import type { ReactNode } from "react";

export default async function PartnerSalespeopleLayout({ children }: { children: ReactNode }) {
  return <PartnerAdminOnly>{children}</PartnerAdminOnly>;
}
