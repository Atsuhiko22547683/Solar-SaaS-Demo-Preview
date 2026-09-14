// 二次店ポータル：販売員の編集。自社の販売員でなければ 404。

import { notFound } from "next/navigation";

import { PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext } from "@/lib/partner/context";

import { getPartnerSalesperson } from "../../data";
import { PartnerSalespersonForm } from "../../salesperson-form";

export const dynamic = "force-dynamic";

export default async function EditPartnerSalespersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const partner = await requirePartnerContext("partner_salesperson.write");
  const row = await getPartnerSalesperson(id);
  if (!row) notFound();

  return (
    <div>
      <PartnerPageHeader title={labels.partner.salesperson.editTitle} />
      <PartnerSalespersonForm mode="edit" initial={row} franchiseNo={partner.franchiseNo} />
    </div>
  );
}
