// 場所確保の相談の新規送信。

import { PartnerCard, PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";

import { ConsultationForm } from "../consultation-form";
import { getConsultationFormData } from "../data";

export const dynamic = "force-dynamic";

const t = labels.partner.consultation;

export default async function NewConsultationPage() {
  const data = await getConsultationFormData();
  return (
    <div>
      <PartnerPageHeader title={t.newTitle} description={t.subtitle} />
      <PartnerCard>
        <ConsultationForm originOptions={data.originOptions} />
      </PartnerCard>
    </div>
  );
}
