// 出店希望の再提出（内容の修正）。
//
// 同じ対象月・同じ依頼先代理店への再提出は明細の入れ替えになるが、代理店とのやり取りは
// 別テーブルなので残る。何を出し直したかも提出の記録としてスレッドに積まれる。

import { notFound } from "next/navigation";

import { PartnerCard, PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";

import { getLanePreferenceFormData } from "../../data";
import { LanePreferenceForm } from "../../lane-preference-form";
import { parseLanePreferenceQuery } from "../../query";

import type { RawParams } from "@/lib/partner/list-query";

export const dynamic = "force-dynamic";

const t = labels.partner.lanePreference;

export default async function EditLanePreferencePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<RawParams>;
}) {
  const [{ id }, rawParams] = await Promise.all([params, searchParams]);
  const q = parseLanePreferenceQuery(rawParams);
  const data = await getLanePreferenceFormData(id, q);
  if (!data.existing) notFound();

  return (
    <div>
      <PartnerPageHeader
        title={t.resubmit}
        description={`${t.monthLabel}: ${data.existing.targetMonth} / ${t.originLabel}: ${data.existing.originName}`}
      />
      <PartnerCard>
        <LanePreferenceForm data={data} />
      </PartnerCard>
    </div>
  );
}
