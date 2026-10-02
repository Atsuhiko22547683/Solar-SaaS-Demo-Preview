// 二次店ポータル：販売員の新規登録。

import { PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext, franchiseNoLabel } from "@/lib/partner/context";

import { PartnerSalespersonForm } from "../salesperson-form";

export const dynamic = "force-dynamic";

export default async function NewPartnerSalespersonPage() {
  // 加盟店番号の表示用。保存時の所属設定は Server Action 側で行う。
  const partner = await requirePartnerContext("partner_salesperson.write");

  return (
    <div>
      <PartnerPageHeader title={labels.partner.salesperson.newTitle} />
      <PartnerSalespersonForm mode="create" franchiseNo={franchiseNoLabel(partner)} />
    </div>
  );
}
