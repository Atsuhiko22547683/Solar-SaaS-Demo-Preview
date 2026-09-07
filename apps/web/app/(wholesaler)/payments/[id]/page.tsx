// 決済詳細。決済情報（A）と決済履歴（B）を確認し、Stripe へ移動する。
//
// 表示するのは既存 DB の実データのみ。Stripe API は呼ばない。

import Link from "next/link";
import { notFound } from "next/navigation";

import { StripeLinkButton } from "@/components/payments/stripe-link-button";
import { Card } from "@/components/ui/card";
import { stripePaymentUrl } from "@/lib/config/stripe";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";
import { assertPaymentAccess } from "@/lib/permissions/settings-guard";

import { getPaymentDetail } from "../data";

import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

const t = labels.payment;
const d = t.detail;

function yen(amount: string | number | null): string {
  if (amount === null) return t.notSet;
  const n = Number(amount);
  return Number.isFinite(n) ? `¥${Math.round(n).toLocaleString("ja-JP")}` : t.notSet;
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-mute-light text-xs">{label}</dt>
      <dd className="text-ink mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await assertPaymentAccess();

  const { id } = await params;
  const detail = await getPaymentDetail(id);
  if (!detail) notFound();

  const status = detail.paymentStatus
    ? (t.statuses[detail.paymentStatus] ?? detail.paymentStatus)
    : t.statusUnset;

  return (
    <div className="space-y-4">
      <Link
        href="/payments"
        className="text-mute-light hover:text-ink text-sm underline-offset-4 hover:underline"
      >
        {d.backToList}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-ink text-xl font-bold">{detail.customerName}</h1>
        {/* 将来 Stripe Customer ID / Payment ID を保存したら、この呼び出しに渡すだけで
            個別決済ページへ飛べる。現在は保存していないのでダッシュボードのトップ。 */}
        <StripeLinkButton href={stripePaymentUrl()} label={t.stripeManage} />
      </div>

      {/* A. 決済情報 */}
      <Card className="p-5">
        <h2 className="text-ink mb-3 text-sm font-semibold">{d.infoSection}</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
          <InfoRow label={d.fields.customer} value={detail.customerName} />
          <InfoRow
            label={d.fields.contract}
            value={
              <Link
                href={`/contracts/${detail.contractId}`}
                className="text-link-light underline-offset-4 hover:underline"
              >
                {d.contractLink}
              </Link>
            }
          />
          <InfoRow label={d.fields.contractDate} value={formatDate(detail.contractDate)} />
          <InfoRow
            label={d.fields.amount}
            value={<span className="tabular-nums">{yen(detail.contractAmount)}</span>}
          />
          <InfoRow label={d.fields.method} value={detail.paymentMethod ?? t.methodUnset} />
          <InfoRow label={d.fields.status} value={status} />
          <InfoRow
            label={d.fields.paymentCount}
            value={detail.paymentCount != null ? `${detail.paymentCount}回` : t.notSet}
          />
          <InfoRow label={d.fields.downPayment} value={yen(detail.downPayment)} />
          <InfoRow label={d.fields.loanNote} value={detail.loanNote ?? t.notSet} />
        </dl>
      </Card>

      {/* B. 決済履歴 */}
      <Card className="overflow-hidden p-0">
        <h2 className="text-ink border-hairline-light border-b px-5 py-3 text-sm font-semibold">
          {d.historySection}
        </h2>
        {detail.history.length === 0 ? (
          <p className="text-mute-light px-5 py-5 text-sm">{d.historyEmpty}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th scope="col" className="px-5 py-2.5 text-left font-medium">
                  {d.historyColumns.occurredAt}
                </th>
                <th scope="col" className="px-5 py-2.5 text-left font-medium">
                  {d.historyColumns.label}
                </th>
              </tr>
            </thead>
            <tbody>
              {detail.history.map((h) => (
                <tr key={`${h.label}-${h.occurredAt}`} className="border-hairline-light border-t">
                  <td className="px-5 py-2.5 tabular-nums">{formatDateTime(h.occurredAt)}</td>
                  <td className="text-ink px-5 py-2.5">{h.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
