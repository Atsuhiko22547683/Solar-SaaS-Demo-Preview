// 決済管理（トップレベル）。契約済み顧客の決済状況を確認し、
// 必要なら Stripe ダッシュボードで操作する、という導線だけを持つ画面。
//
// Stripe API はまだ接続していない（SDK / key / webhook / checkout なし）。
// このページが表示する値はすべて既存 DB の実データで、架空値は保存も表示もしない。
//
// アクセス権: OWNER / GENERAL_USER。SYSTEM_ADMIN は URL 直打ちでも 403。

import Link from "next/link";

import { StripeLinkButton } from "@/components/payments/stripe-link-button";
import { Card } from "@/components/ui/card";
import { stripePaymentUrl } from "@/lib/config/stripe";
import { formatDate } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";
import { assertPaymentAccess } from "@/lib/permissions/settings-guard";

import { listPayments } from "./data";

import type { PaymentFilterTab, PaymentListItem } from "./data";

export const dynamic = "force-dynamic";

const t = labels.payment;
const TABS: { value: PaymentFilterTab; label: string }[] = [
  { value: "all", label: t.tabs.all },
  { value: "unpaid", label: t.tabs.unpaid },
  { value: "paid", label: t.tabs.paid },
];

function toTab(value: string | undefined): PaymentFilterTab {
  return value === "unpaid" || value === "paid" ? value : "all";
}

function yen(amount: string): string {
  const n = Number(amount);
  return Number.isFinite(n) ? `¥${Math.round(n).toLocaleString("ja-JP")}` : t.notSet;
}

function statusLabel(item: PaymentListItem): string {
  return item.paymentStatus
    ? (t.statuses[item.paymentStatus] ?? item.paymentStatus)
    : t.statusUnset;
}

const TH = "px-4 py-2.5 text-left font-medium";
const TD = "px-4 py-2.5";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  // 決済管理は OWNER / GENERAL_USER のみ。URL 直打ちもここで 403 にする。
  await assertPaymentAccess();

  const tab = toTab((await searchParams).tab);
  const rows = await listPayments(tab);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-ink text-xl font-bold">{t.title}</h1>
        <StripeLinkButton href={stripePaymentUrl()} label={t.stripeLink} />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div role="tablist" aria-label={t.tabs.ariaLabel} className="flex gap-1">
          {TABS.map((item) => {
            const active = item.value === tab;
            return (
              <Link
                key={item.value}
                role="tab"
                aria-selected={active}
                href={item.value === "all" ? "/payments" : `/payments?tab=${item.value}`}
                className={
                  active
                    ? "border-primary text-ink rounded-md border px-3 py-1.5 text-sm font-medium"
                    : "border-hairline-light text-mute-light hover:text-ink rounded-md border px-3 py-1.5 text-sm"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <p className="text-mute-light text-sm tabular-nums">
          {rows.length}
          {t.countSuffix}
        </p>
      </div>

      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <p className="text-mute-light px-4 py-6 text-sm">{t.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th scope="col" className={TH}>
                    {t.columns.customer}
                  </th>
                  <th scope="col" className={TH}>
                    {t.columns.contractDate}
                  </th>
                  <th scope="col" className={`${TH} text-right`}>
                    {t.columns.amount}
                  </th>
                  <th scope="col" className={TH}>
                    {t.columns.status}
                  </th>
                  <th scope="col" className={TH}>
                    {t.columns.lastPaidAt}
                  </th>
                  <th scope="col" className={TH}>
                    {t.columns.method}
                  </th>
                  <th scope="col" className={TH}>
                    {t.columns.detail}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.contractId} className="border-hairline-light border-t">
                    <td className={`${TD} text-ink font-medium`}>{r.customerName}</td>
                    <td className={`${TD} tabular-nums`}>{formatDate(r.contractDate)}</td>
                    <td className={`${TD} text-right tabular-nums`}>{yen(r.contractAmount)}</td>
                    <td className={TD}>{statusLabel(r)}</td>
                    <td className={`${TD} tabular-nums`}>
                      {r.lastPaidAt ? formatDate(r.lastPaidAt) : t.notSet}
                    </td>
                    <td className={TD}>{r.paymentMethod ?? t.methodUnset}</td>
                    <td className={TD}>
                      <Link
                        href={`/payments/${r.contractId}`}
                        className="text-link-light underline-offset-4 hover:underline"
                      >
                        {t.detailLink}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
