// 自社顧客の編集・削除（二次店管理者サイトのみ）。
//
// /p-customers 自体はスタッフサイトにもあるため、この配下だけをガードする。
// ローダー（partner_customer.write）も同じ条件で落ちるが、ここで止めておくと
// スタッフサイトで URL を直打ちしたときにエラー画面ではなく案内が出る。

import { PartnerAdminOnly } from "@/components/partner/admin-only";

import type { ReactNode } from "react";

export default async function PartnerCustomerEditLayout({ children }: { children: ReactNode }) {
  return <PartnerAdminOnly>{children}</PartnerAdminOnly>;
}
