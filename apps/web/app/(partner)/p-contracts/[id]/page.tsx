// 二次店ポータル：成約の詳細。自社が登録した行でなければ 404。

import Link from "next/link";
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

import { getPartnerContract } from "../data";

export const dynamic = "force-dynamic";

const t = labels.partner.contract;
const c = labels.partner.common;

export default async function PartnerContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getPartnerContract(id);
  if (!row) notFound();

  return (
    <div>
      <PartnerPageHeader
        title={t.detailTitle}
        action={
          <Link
            href={`/p-contracts/${row.id}/edit`}
            className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 w-full items-center justify-center rounded-md border px-4 text-sm font-medium sm:h-9 sm:w-auto sm:px-3"
          >
            {c.edit}
          </Link>
        }
      />

      {/* 誰が出した報告かは管理者にだけ出る（スタッフの詳細には submitterName が入らない）。 */}
      {row.submitterName ? (
        <p className="text-mute-light mb-3 text-[13px]">
          {labels.partner.list.submittedByColumn}:{" "}
          <span className="text-ink">{row.submitterName}</span>
        </p>
      ) : null}

      <div className="space-y-4">
        <PartnerCard>
          <h2 className="text-mute-light mb-3 text-xs font-semibold">{t.sections.contract}</h2>
          <PartnerFieldGrid>
            <PartnerField label={t.fields.contractDate} value={formatDate(row.contractDate)} />
            <PartnerField label={t.fields.tossDate} value={formatDate(row.tossDate)} />
          </PartnerFieldGrid>
        </PartnerCard>

        <PartnerCard>
          <h2 className="text-mute-light mb-3 text-xs font-semibold">{t.sections.org}</h2>
          <PartnerFieldGrid>
            <PartnerField label={t.fields.tossDept} value={row.tossDept} />
            <PartnerField label={t.fields.apptGetter} value={row.apptGetter} />
            <PartnerField label={t.fields.salesRep} value={row.salesRep} />
            <PartnerField label={t.fields.referralBranch} value={row.referralBranch} />
            <PartnerField
              label={t.fields.affiliation}
              value={t.affiliationLabels[row.affiliation] ?? row.affiliation}
            />
            <PartnerField label={t.fields.affiliationDept} value={row.affiliationDept} />
            <PartnerField
              label={t.fields.acquisitionChannel}
              value={t.acquisitionChannelLabels[row.acquisitionChannel] ?? row.acquisitionChannel}
            />
            <PartnerField label={t.fields.createdAt} value={formatDateTime(row.createdAt)} />
          </PartnerFieldGrid>
        </PartnerCard>
      </div>

      <div className="mt-4">
        <BackToListLink href="/p-contracts" label={c.backToList} />
      </div>
    </div>
  );
}
