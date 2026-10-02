// 出店希望の新規提出。
//
// 対象月・依頼先代理店はフォーム側で選ぶ。候補（代理店が自社に公開しているイベント候補）は
// エリア・店舗名/住所・対象月で絞り込めるようにし、入力補助として出す。

import { PartnerCard, PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";

import { getLanePreferenceFormData } from "../data";
import { LanePreferenceForm } from "../lane-preference-form";
import { parseLanePreferenceQuery } from "../query";

import type { RawParams } from "@/lib/partner/list-query";

export const dynamic = "force-dynamic";

const t = labels.partner.lanePreference;

export default async function NewLanePreferencePage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const q = parseLanePreferenceQuery(params);
  const data = await getLanePreferenceFormData(null, q);

  return (
    <div>
      <PartnerPageHeader title={t.newSubmission} description={t.listSubtitle} />
      <PartnerCard>
        <LanePreferenceForm data={data} />
      </PartnerCard>
    </div>
  );
}
