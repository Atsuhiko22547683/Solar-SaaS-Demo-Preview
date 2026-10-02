// 二次店ポータル：初訪アポの編集。自社が登録した顧客でなければ 404。
//
// アポ区分は変更できない（別フォームの項目が食い違うため）。この画面は
// 初訪アポの項目だけを扱う。訪問アポの編集は /p-appointments/visit/[id]/edit。

import { notFound } from "next/navigation";

import { PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext, franchiseNoLabel } from "@/lib/partner/context";
import { listPartnerOrigins } from "@/lib/partner/origins";

import { PartnerFirstVisitForm } from "../../appointment-form";
import {
  getPartnerFirstVisit,
  listPartnerCloseCompanyOptions,
  listPartnerSalespersonOptions,
} from "../../data";

export const dynamic = "force-dynamic";

export default async function EditPartnerFirstVisitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const partner = await requirePartnerContext("partner_appointment.write");
  // 依頼先代理店の候補（複数の代理店から依頼を受ける会社では選択が要る）。
  const origins = await listPartnerOrigins("partner_appointment.write");
  const row = await getPartnerFirstVisit(id);
  if (!row) notFound();
  const salespeople = await listPartnerSalespersonOptions();
  const closeCompanies = await listPartnerCloseCompanyOptions();

  return (
    <div>
      <PartnerPageHeader title={labels.partner.appointment.editTitle} />
      <p className="text-mute-light mb-4 text-xs">{labels.partner.appointmentKind.lockedHint}</p>
      <PartnerFirstVisitForm
        mode="edit"
        initial={row}
        franchiseNo={franchiseNoLabel(partner)}
        origins={origins.options}
        salespeople={salespeople}
        closeCompanies={closeCompanies}
      />
    </div>
  );
}
