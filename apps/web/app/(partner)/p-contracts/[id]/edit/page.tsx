// 二次店ポータル：成約の編集。自社が登録した行でなければ 404。

import { notFound } from "next/navigation";

import { PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext, franchiseNoLabel } from "@/lib/partner/context";
import { listPartnerOrigins } from "@/lib/partner/origins";

import { listPartnerCustomerOptions } from "../../../p-customers/data";
import { PartnerContractForm } from "../../contract-form";
import { getPartnerContract } from "../../data";

export const dynamic = "force-dynamic";

export default async function EditPartnerContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const partner = await requirePartnerContext("partner_contract_report.write");
  // 依頼先代理店の候補（複数の代理店から依頼を受ける会社では選択が要る）。
  const [origins, customers, row] = await Promise.all([
    listPartnerOrigins("partner_contract_report.write"),
    listPartnerCustomerOptions(),
    getPartnerContract(id),
  ]);
  if (!row) notFound();

  return (
    <div>
      <PartnerPageHeader title={labels.partner.contract.editTitle} />
      <PartnerContractForm
        mode="edit"
        initial={row}
        franchiseNo={franchiseNoLabel(partner)}
        customers={customers}
        origins={origins.options}
      />
    </div>
  );
}
