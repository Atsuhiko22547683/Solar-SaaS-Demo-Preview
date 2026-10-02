// 二次店ポータル：商談情報の編集。本人が担当の商談でなければ 404。

import { notFound } from "next/navigation";

import { PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";

import { getMyDeal } from "../../../../data";
import { PartnerDealForm } from "../../../../deal-form";

export const dynamic = "force-dynamic";

export default async function EditMyDealPage({
  params,
}: {
  params: Promise<{ id: string; dealId: string }>;
}) {
  const { id, dealId } = await params;
  const deal = await getMyDeal(dealId);
  // URL の顧客 id と商談の顧客が食い違う場合も 404（別顧客の商談を紛れ込ませない）。
  if (!deal || deal.customerId !== id) notFound();

  return (
    <div>
      <PartnerPageHeader
        title={labels.partner.customer.deal.editTitle}
        description={deal.customerName}
      />
      <PartnerDealForm initial={deal} customerId={id} />
    </div>
  );
}
