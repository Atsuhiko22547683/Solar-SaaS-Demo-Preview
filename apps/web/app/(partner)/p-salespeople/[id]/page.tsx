// 二次店ポータル：販売員の詳細。自社の販売員でなければ 404。

import Link from "next/link";
import { notFound } from "next/navigation";

import {
  PartnerCard,
  PartnerField,
  PartnerFieldGrid,
  PartnerPageHeader,
} from "@/components/partner/partner-ui";
import { formatDate } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { getPartnerSalesperson } from "../data";

export const dynamic = "force-dynamic";

const t = labels.partner.salesperson;
const c = labels.partner.common;

export default async function PartnerSalespersonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getPartnerSalesperson(id);
  if (!row) notFound();

  return (
    <div>
      <PartnerPageHeader
        title={t.detailTitle}
        action={
          <Link
            href={`/p-salespeople/${row.id}/edit`}
            className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 w-full items-center justify-center rounded-md border px-4 text-sm font-medium sm:h-9 sm:w-auto sm:px-3"
          >
            {c.edit}
          </Link>
        }
      />

      <PartnerCard>
        <PartnerFieldGrid>
          <PartnerField label={t.fields.name} value={row.name} />
          <PartnerField label={t.fields.kana} value={row.kana} />
          <PartnerField label={t.fields.franchiseNo} value={row.franchiseNo} />
          <PartnerField label={t.fields.email} value={row.email} />
          <PartnerField label={t.fields.phone} value={row.phone} />
          <PartnerField
            label={t.fields.gender}
            value={
              row.gender
                ? (t.genderLabels[row.gender as keyof typeof t.genderLabels] ?? row.gender)
                : null
            }
          />
          <PartnerField
            label={t.fields.birthDate}
            value={row.birthDate ? formatDate(row.birthDate) : null}
          />
          <PartnerField
            label={t.fields.employmentType}
            value={
              row.employmentType
                ? (t.employmentTypeLabels[
                    row.employmentType as keyof typeof t.employmentTypeLabels
                  ] ?? row.employmentType)
                : null
            }
          />
          <PartnerField label={t.fields.salesExperience} value={row.salesExperience} />
          <PartnerField label={t.fields.address} value={row.address} />
          <PartnerField label={t.fields.residentAddress} value={row.residentAddress} />
          <PartnerField
            label={t.fields.isActive}
            value={row.isActive ? t.activeLabels.active : t.activeLabels.inactive}
          />
          {/* ログインアカウントとの紐付け状況。設定は利用者アカウント管理側で行う。 */}
          <PartnerField
            label={t.columns.account}
            value={
              row.accountName
                ? `${row.accountName}（${row.accountEmail ?? c.dash}）`
                : t.linkLabels["UNLINKED"]
            }
          />
        </PartnerFieldGrid>
      </PartnerCard>

      <div className="mt-4">
        <Link
          href="/p-salespeople"
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          {c.backToList}
        </Link>
      </div>
    </div>
  );
}
