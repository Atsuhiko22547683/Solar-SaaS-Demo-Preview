// 個人設定（スタッフ本人）。正本は既存の販売員マスタ（Salesperson）。
//
// 販売員情報と紐付いていない利用者には案内を出し、レコードを勝手に作らない。

import { PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";

import { getMyProfile } from "./data";
import { PartnerProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

const t = labels.partner.profile;

export default async function PartnerProfilePage() {
  const profile = await getMyProfile();

  return (
    <div>
      <PartnerPageHeader title={t.title} description={t.subtitle} />
      {profile ? (
        <PartnerProfileForm profile={profile} />
      ) : (
        <p className="text-mute-light text-[13px]">{t.errors.noSalesperson}</p>
      )}
    </div>
  );
}
