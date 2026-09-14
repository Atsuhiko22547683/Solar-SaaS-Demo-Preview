// 二次店ポータル：アポイントの編集。自社が登録した顧客でなければ 404。

import { notFound } from "next/navigation";

import { PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext } from "@/lib/partner/context";

import { listPartnerSalespersonOptions } from "../../../p-salespeople/data";
import { PartnerAppointmentForm } from "../../appointment-form";
import { getPartnerAppointment, listPartnerEventOptions } from "../../data";

export const dynamic = "force-dynamic";

export default async function EditPartnerAppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const partner = await requirePartnerContext("partner_appointment.write");
  const row = await getPartnerAppointment(id);
  if (!row) notFound();
  const salespeople = await listPartnerSalespersonOptions();
  const events = await listPartnerEventOptions();

  return (
    <div>
      <PartnerPageHeader title={labels.partner.appointment.editTitle} />
      <PartnerAppointmentForm
        mode="edit"
        initial={row}
        franchiseNo={partner.franchiseNo}
        salespeople={salespeople}
        events={events}
      />
    </div>
  );
}
