// 二次店ポータル：成約の新規登録。

import { PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext, franchiseNoLabel } from "@/lib/partner/context";
import { listPartnerOrigins } from "@/lib/partner/origins";

import { listPartnerCustomerOptions } from "../../p-customers/data";
import { PartnerContractForm } from "../contract-form";

export const dynamic = "force-dynamic";

export default async function NewPartnerContractPage() {
  const partner = await requirePartnerContext("partner_contract_report.write");
  // 依頼先代理店の候補（複数の代理店から依頼を受ける会社では選択が要る）。
  const [origins, customers] = await Promise.all([
    listPartnerOrigins("partner_contract_report.write"),
    // 成約報告の「対象の顧客」候補。自社が取り扱っている顧客だけ。
    listPartnerCustomerOptions(),
  ]);
  return (
    <div>
      <PartnerPageHeader title={labels.partner.contract.newTitle} />
      <PartnerContractForm
        mode="create"
        franchiseNo={franchiseNoLabel(partner)}
        customers={customers}
        origins={origins.options}
      />
    </div>
  );
}
