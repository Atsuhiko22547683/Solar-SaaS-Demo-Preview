// 催事シフトの一括配置（パートナー管理者のみ）。
//
// /p-shifts はスタッフサイトにもあるが、配置はここだけ。実際の認可は
// requirePartnerContext("partner_shift.write")（管理者サイト × DEALER_ADMIN）が行う。

import { PartnerAdminOnlyNotice, isPartnerAdminSiteUser } from "@/components/partner/admin-only";
import { PartnerCard, PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";

import { getAssignFormData } from "../data";
import { parseShiftMonthQuery } from "../query";
import { ShiftAssignForm } from "./assign-form";

import type { RawParams } from "@/lib/partner/list-query";

export const dynamic = "force-dynamic";

const t = labels.partner.shift;

export default async function ShiftAssignPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  // ガードを先に通す。データ取得（partner_shift.write）を先に走らせると、
  // スタッフサイトでは案内ではなく 403 のエラー画面になってしまう。
  if (!(await isPartnerAdminSiteUser())) return <PartnerAdminOnlyNotice />;

  const params = await searchParams;
  const q = parseShiftMonthQuery(params);
  const data = await getAssignFormData(q.month);

  return (
    <>
      <div>
        <PartnerPageHeader
          title={t.assign.title}
          description={`${t.assign.subtitle}（${data.month}）`}
        />
        <PartnerCard>
          <ShiftAssignForm data={data} />
        </PartnerCard>
      </div>
    </>
  );
}
