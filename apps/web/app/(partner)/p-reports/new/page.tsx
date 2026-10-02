// 二次店ポータル：催事日報の新規登録。
// イベントの事前登録は不要（フォーム同様、単独で提出できる）。

import { PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext, franchiseNoLabel } from "@/lib/partner/context";
import { listPartnerOrigins } from "@/lib/partner/origins";

import { listPartnerLinkableEvents } from "../data";
import { PartnerReportForm } from "../report-form";

export const dynamic = "force-dynamic";

export default async function NewPartnerReportPage({
  searchParams,
}: {
  // 催事シフト・催事一覧の「日報を入力」から対象を引き継ぐ。
  searchParams: Promise<{ eventId?: string; eventDayId?: string }>;
}) {
  const sp = await searchParams;
  const partner = await requirePartnerContext("partner_event_report.write");
  // 依頼先代理店の候補（複数の代理店から依頼を受ける会社では選択が要る）。
  const origins = await listPartnerOrigins("partner_event_report.write");
  // 自社が担当している催事。紐付けると代理店のイベント詳細「日報・実績」に並ぶ。
  const events = await listPartnerLinkableEvents();
  return (
    <div>
      <PartnerPageHeader title={labels.partner.report.newTitle} />
      <PartnerReportForm
        mode="create"
        franchiseNo={franchiseNoLabel(partner)}
        origins={origins.options}
        events={events}
        initialEventId={sp.eventId ?? ""}
        initialEventDayId={sp.eventDayId ?? ""}
      />
    </div>
  );
}
