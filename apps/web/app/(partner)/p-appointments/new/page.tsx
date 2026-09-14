// 二次店ポータル：アポイントの新規登録。

import { PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext } from "@/lib/partner/context";

import { listPartnerSalespersonOptions } from "../../p-salespeople/data";
import { PartnerAppointmentForm } from "../appointment-form";
import { listPartnerEventOptions } from "../data";

export const dynamic = "force-dynamic";

export default async function NewPartnerAppointmentPage() {
  const partner = await requirePartnerContext("partner_appointment.write");
  // 逐次実行にして、1 リクエストで同時に開く DB トランザクションを 1 本に保つ。
  const salespeople = await listPartnerSalespersonOptions();
  const events = await listPartnerEventOptions();

  return (
    <div>
      <PartnerPageHeader title={labels.partner.appointment.newTitle} />
      <PartnerAppointmentForm
        mode="create"
        franchiseNo={partner.franchiseNo}
        salespeople={salespeople}
        events={events}
      />
    </div>
  );
}
