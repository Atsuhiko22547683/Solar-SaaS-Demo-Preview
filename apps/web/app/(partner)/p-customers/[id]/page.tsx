// 二次店ポータル：担当顧客の詳細。お客様情報は閲覧のみ、商談は本人担当分だけ編集可。

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

import { getMyCustomer, getPartnerNegotiation } from "../data";
import { NegotiationPanel } from "./negotiation-panel";

export const dynamic = "force-dynamic";

const t = labels.partner.customer;
const c = labels.partner.common;

const ASSIGNMENT_LABEL: Record<string, string> = {
  TOSS_UP: t.assignment.tossUp,
  CLOSING: t.assignment.closing,
  DEAL: t.assignment.deal,
};

function yen(value: string | null): string | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? `¥${Math.round(n).toLocaleString("ja-JP")}` : value;
}

export default async function PartnerCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await getMyCustomer(id);
  // 商談履歴は同じ顧客に対する読み出しなので、顧客が見えないときは読まない。
  const negotiation = row ? await getPartnerNegotiation(id) : null;
  if (!row) notFound();

  return (
    <div>
      <PartnerPageHeader
        title={row.isAdmin ? t.admin.detailTitle : t.detailTitle}
        action={
          row.isAdmin ? (
            <Link
              href={`/p-customers/${row.id}/edit`}
              className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 w-full items-center justify-center rounded-md border px-4 text-sm font-medium sm:h-9 sm:w-auto sm:px-3"
            >
              {t.admin.edit}
            </Link>
          ) : undefined
        }
      />

      <div className="space-y-4">
        <PartnerCard>
          <h2 className="text-mute-light mb-1 text-xs font-semibold">{t.sections.customer}</h2>
          {/* 基本情報を直せるのは管理者だけ。スタッフには触れない旨を出す。 */}
          {row.isAdmin ? null : <p className="text-mute-light mb-3 text-xs">{t.readOnlyNote}</p>}
          <PartnerFieldGrid>
            <PartnerField label={t.fields.name} value={row.name} />
            <PartnerField label={t.fields.kana} value={row.kana} />
            <PartnerField label={t.fields.phone} value={row.phone} />
            <PartnerField label={t.fields.address} value={row.address} />
            {row.isAdmin ? (
              <>
                <PartnerField
                  label={t.admin.fields.tossUpSalesperson}
                  value={row.tossUpSalespersonName}
                />
                <PartnerField
                  label={t.admin.fields.closingSalesperson}
                  value={row.closingSalespersonName}
                />
                <PartnerField
                  label={t.fields.status}
                  value={t.admin.statusLabels[row.status] ?? row.status}
                />
              </>
            ) : (
              <PartnerField
                label={t.columns.assignment}
                value={row.assignments.map((a) => ASSIGNMENT_LABEL[a] ?? a).join(" / ")}
              />
            )}
            <PartnerField label={t.fields.registeredAt} value={formatDate(row.registeredAt)} />
          </PartnerFieldGrid>
        </PartnerCard>

        <PartnerCard>
          <h2 className="text-mute-light mb-3 text-xs font-semibold">{t.sections.deals}</h2>
          {row.deals.length === 0 ? (
            <p className="text-mute-light text-sm">{t.deal.empty}</p>
          ) : (
            <ul className="divide-hairline-light divide-y">
              {row.deals.map((d) => (
                <li key={d.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-ink text-sm font-medium">
                      {t.deal.statusLabels[d.status] ?? d.status}
                    </span>
                    {/* 編集できるのは本人が担当の商談だけ。他の担当の商談には導線を出さない。 */}
                    {d.mine ? (
                      <Link
                        href={`/p-customers/${row.id}/deals/${d.id}/edit`}
                        className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-8 items-center rounded-md border px-3 text-xs font-medium"
                      >
                        {t.deal.edit}
                      </Link>
                    ) : null}
                  </div>
                  <PartnerFieldGrid>
                    <PartnerField label={t.deal.fields.proposedProduct} value={d.proposedProduct} />
                    <PartnerField
                      label={t.deal.fields.proposedAmount}
                      value={yen(d.proposedAmount)}
                    />
                    <PartnerField
                      label={t.deal.fields.expectedContractDate}
                      value={d.expectedContractDate ? formatDate(d.expectedContractDate) : null}
                    />
                    <PartnerField label={t.deal.fields.nextAction} value={d.nextAction} />
                    <PartnerField label={t.deal.fields.lostReason} value={d.lostReason} />
                    <PartnerField label={t.deal.fields.note} value={d.note} />
                    <PartnerField
                      label={t.deal.fields.updatedAt}
                      value={formatDateTime(d.updatedAt)}
                    />
                  </PartnerFieldGrid>
                </li>
              ))}
            </ul>
          )}
        </PartnerCard>
      </div>

      {/* 商談履歴（接点の積み重ね）と業務情報。既存顧客への再接点はここから記録する。 */}
      {negotiation ? (
        <PartnerCard className="mt-4">
          <NegotiationPanel data={negotiation} />
        </PartnerCard>
      ) : null}

      <div className="mt-4">
        <BackToListLink href="/p-customers" label={c.backToList} />
      </div>
    </div>
  );
}
