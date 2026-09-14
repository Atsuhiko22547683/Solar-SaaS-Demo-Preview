// 二次店ポータル：催事日報の新規登録。
// イベントの事前登録は不要（フォーム同様、単独で提出できる）。

import { PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";

import { PartnerReportForm } from "../report-form";

export const dynamic = "force-dynamic";

export default function NewPartnerReportPage() {
  return (
    <div>
      <PartnerPageHeader title={labels.partner.report.newTitle} />
      <PartnerReportForm mode="create" />
    </div>
  );
}
