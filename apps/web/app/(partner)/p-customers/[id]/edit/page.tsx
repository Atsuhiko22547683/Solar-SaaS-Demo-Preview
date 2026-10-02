// 二次店ポータル：自社顧客の編集・削除（二次店管理者のみ）。
//
// 個人情報が伏せられている設定では編集させない（伏せた値の保存を防ぐ）。
// 自社の顧客でなければ 404。

import { notFound } from "next/navigation";

import { PartnerAdminOnlyNotice, isPartnerAdminSiteUser } from "@/components/partner/admin-only";
import { BackToListLink } from "@/components/partner/back-to-list-link";
import { PartnerCard, PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";

import { CustomerDeleteForm } from "../../customer-delete-form";
import { CustomerForm } from "../../customer-form";
import { checkPartnerCustomerDeletable, getPartnerCustomerForEdit } from "../../data";

export const dynamic = "force-dynamic";

const t = labels.partner.customer;
const c = labels.partner.common;

export default async function PartnerCustomerEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // ガードを先に通す。データ取得（partner_customer.write）を先に走らせると、
  // スタッフサイトでは案内ではなく 403 のエラー画面になってしまう。
  // このパスは /p-customers 配下なので middleware では塞がれない。
  if (!(await isPartnerAdminSiteUser())) return <PartnerAdminOnlyNotice />;

  const { id } = await params;
  const { canEdit, data } = await getPartnerCustomerForEdit(id);

  if (!canEdit) {
    return (
      <div>
        <PartnerPageHeader title={t.admin.editTitle} />
        <PartnerCard>
          <p role="alert" className="text-mute-light text-sm">
            {t.admin.maskedEditDisabled}
          </p>
        </PartnerCard>
        <div className="mt-4">
          <BackToListLink href="/p-customers" label={c.backToList} />
        </div>
      </div>
    );
  }
  if (!data) notFound();

  const deletable = await checkPartnerCustomerDeletable(id);
  if (!deletable) notFound();

  return (
    <div>
      <PartnerPageHeader title={t.admin.editTitle} description={data.name} />

      <div className="space-y-4">
        <PartnerCard>
          <CustomerForm data={data} />
        </PartnerCard>

        <PartnerCard>
          <h2 className="text-danger mb-3 text-sm font-semibold">{t.admin.deleteTitle}</h2>
          <CustomerDeleteForm customerId={data.id} deletable={deletable} />
        </PartnerCard>
      </div>

      <div className="mt-4">
        <BackToListLink href="/p-customers" label={c.backToList} />
      </div>
    </div>
  );
}
