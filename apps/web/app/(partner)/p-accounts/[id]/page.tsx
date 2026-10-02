// 二次店ポータル：利用者アカウントの詳細・設定（二次店管理者のみ）。
// 自社（同じテナント）の利用者でなければ 404。

import { notFound } from "next/navigation";

import { BackToListLink } from "@/components/partner/back-to-list-link";
import {
  PartnerCard,
  PartnerField,
  PartnerFieldGrid,
  PartnerPageHeader,
} from "@/components/partner/partner-ui";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { AccountForm } from "../account-form";
import { getPartnerAccount } from "../data";

export const dynamic = "force-dynamic";

const t = labels.partner.account;
const c = labels.partner.common;

export default async function PartnerAccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await getPartnerAccount(id);
  if (!account) notFound();

  return (
    <div>
      <PartnerPageHeader title={t.detailTitle} description={account.name} />

      <div className="space-y-4">
        <PartnerCard>
          <PartnerFieldGrid>
            <PartnerField label={t.columns.name} value={account.name} />
            <PartnerField label={t.columns.email} value={account.email} />
            <PartnerField
              label={t.columns.status}
              value={t.statusLabels[account.status] ?? account.status}
            />
            <PartnerField label={t.columns.salesperson} value={account.salespersonName ?? c.dash} />
            <PartnerField
              label={t.columns.lastLoginAt}
              value={account.lastLoginAt ? formatDateTime(account.lastLoginAt) : c.dash}
            />
            <PartnerField label={t.columns.createdAt} value={formatDate(account.createdAt)} />
          </PartnerFieldGrid>
        </PartnerCard>

        <PartnerCard>
          <h2 className="text-ink mb-3 text-sm font-semibold">{t.actions.title}</h2>
          <AccountForm account={account} />
        </PartnerCard>
      </div>

      <div className="mt-4">
        <BackToListLink href="/p-accounts" label={c.backToList} />
      </div>
    </div>
  );
}
