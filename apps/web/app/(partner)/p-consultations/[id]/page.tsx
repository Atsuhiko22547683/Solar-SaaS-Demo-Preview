// 場所確保の相談の詳細。相談内容と、代理店とのやり取りを同じ場所で確認する。

import { notFound } from "next/navigation";

import { BackToListLink } from "@/components/partner/back-to-list-link";
import {
  PartnerCard,
  PartnerField,
  PartnerFieldGrid,
  PartnerPageHeader,
  PartnerSection,
} from "@/components/partner/partner-ui";
import { ThreadPanel } from "@/components/partner/thread-panel";
import { labels } from "@/lib/i18n/labels";

import { postConsultationMessageAction } from "../actions";
import { getPartnerConsultation } from "../data";

export const dynamic = "force-dynamic";

const BASE = "/p-consultations";
const t = labels.partner.consultation;
const c = labels.partner.common;

export default async function ConsultationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPartnerConsultation(id);
  if (!data) notFound();

  return (
    <div>
      <PartnerPageHeader title={data.title} description={t.detailTitle} />

      <PartnerCard className="mb-4">
        <PartnerFieldGrid>
          <PartnerField label={t.columns.origin} value={data.originName} />
          <PartnerField label={t.columns.area} value={data.area ?? c.dash} />
          <PartnerField label={t.columns.targetMonth} value={data.targetMonth ?? c.dash} />
          <PartnerField label={t.columns.status} value={t.status[data.status]} />
        </PartnerFieldGrid>
      </PartnerCard>

      <PartnerCard className="mb-4">
        <PartnerSection title={labels.partner.lanePreference.threadTitle}>
          <ThreadPanel
            targetId={data.id}
            entries={data.thread}
            post={postConsultationMessageAction}
          />
        </PartnerSection>
      </PartnerCard>

      <BackToListLink href={BASE} label={c.backToList} />
    </div>
  );
}
