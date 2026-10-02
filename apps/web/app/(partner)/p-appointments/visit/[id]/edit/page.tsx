// 二次店ポータル：訪問アポの編集。自社が登録した行でなければ 404。
//
// アポ区分は変更できない（別フォームの項目が食い違うため）。

import { notFound } from "next/navigation";

import { PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext, franchiseNoLabel } from "@/lib/partner/context";
import { listPartnerOrigins } from "@/lib/partner/origins";

import { listPartnerCustomerOptions } from "../../../../p-customers/data";
import { getPartnerVisit, listPartnerSalespersonOptions } from "../../../data";
import { PartnerVisitForm } from "../../../visit-form";

export const dynamic = "force-dynamic";

export default async function EditPartnerVisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const partner = await requirePartnerContext("partner_visit_appointment.write");
  // 依頼先代理店の候補（複数の代理店から依頼を受ける会社では選択が要る）。
  const origins = await listPartnerOrigins("partner_visit_appointment.write");
  const row = await getPartnerVisit(id);
  if (!row) notFound();
  const [salespeople, customers] = await Promise.all([
    listPartnerSalespersonOptions(),
    listPartnerCustomerOptions(),
  ]);

  return (
    <div>
      <PartnerPageHeader title={labels.partner.visitAppointment.editTitle} />
      <p className="text-mute-light mb-4 text-xs">{labels.partner.appointmentKind.lockedHint}</p>
      <PartnerVisitForm
        mode="edit"
        initial={row}
        franchiseNo={franchiseNoLabel(partner)}
        origins={origins.options}
        salespeople={salespeople}
        customers={customers}
      />
    </div>
  );
}
