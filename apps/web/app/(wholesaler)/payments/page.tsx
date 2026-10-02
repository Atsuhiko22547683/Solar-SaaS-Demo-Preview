// 決済管理 — 本システム（BizOrch）の利用契約と支払い状況。
//
// 太陽光顧客の決済ではない。Customer / Contract / ContractPayment は参照しない。
// 構成は「決済情報（定義リスト）」と「決済履歴（コンパクトな表）」の 2 セクションだけで、
// カードを何枚も積まない。
//
// 支払い方法・支払い状態・決済履歴は Stripe（Sandbox）から取得する。
// カード情報は保存せず、brand と下 4 桁・有効期限だけを表示する。
// カードの登録・変更は Stripe のホスト画面（決済管理ページ）で行うので、
// この画面にカード入力フォームは持たない。
//
// アクセス権: OWNER のみ。SYSTEM_ADMIN / GENERAL_USER は URL 直打ちでも 403。

import { BillingPortalButton } from "@/components/payments/billing-portal-button";
import { Card } from "@/components/ui/card";
import { formatCardExpiry, formatCardLabel } from "@/lib/billing/status";
import { formatDate } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";
import { assertPaymentAccess } from "@/lib/permissions/settings-guard";

import { getPaymentPageData } from "./data";

import type { SubscriptionInfo } from "./data";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

const t = labels.payment;

function yen(amount: number | null): string | null {
  if (amount === null) return null;
  return `¥${Math.round(amount).toLocaleString("ja-JP")}`;
}

/** 契約期間「2026/09/01 〜 2027/08/31（12か月契約）」。両端が揃って初めて出す。 */
function contractPeriod(info: SubscriptionInfo): string | null {
  if (!info.contractStartAt || !info.contractEndAt) return null;
  const start = new Date(info.contractStartAt);
  const end = new Date(info.contractEndAt);
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  const range = `${formatDate(info.contractStartAt)} ${t.info.periodSeparator} ${formatDate(info.contractEndAt)}`;
  if (months <= 0) return range;
  return `${range}（${t.info.periodMonths.replace("{n}", String(months))}）`;
}

/**
 * 定義リストの 1 項目。
 * スマホでは 1 列縦並び、sm 以上で 2 列、lg 以上で 3 列に自然に増える。
 */
function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-mute-light text-xs">{label}</dt>
      <dd className="text-ink mt-0.5 break-words text-sm">{value}</dd>
    </div>
  );
}

/** data 側が "<ISO>/<ISO>" で渡す対象期間を「2026/04/01 〜 2026/04/30」にする。 */
function invoicePeriod(period: string): string | null {
  const [start, end] = period.split("/");
  if (!start || !end) return null;
  return `${formatDate(start)} ${t.info.periodSeparator} ${formatDate(end)}`;
}

const TH = "px-4 py-2.5 text-left text-xs font-semibold text-mute-light";
const TD = "px-4 py-2.5 text-body-light";

export default async function PaymentsPage() {
  // 決済管理はオーナーのみ。URL 直打ちもここで 403 にする。
  await assertPaymentAccess();

  const { info, invoices, stripeUnavailable } = await getPaymentPageData();
  const notSet = <span className="text-mute-light">{t.notSet}</span>;
  const period = contractPeriod(info);
  const price = yen(info.unitPrice);

  // 「Visa •••• 4242」。ブランドが取れなければ「カード •••• 4242」、
  // 下 4 桁も無ければ「カード」、カード自体が無ければ「未登録」。
  const cardLabel = formatCardLabel(info.card, labels.billing.card.generic);
  const cardExpiry = formatCardExpiry(info.card);
  const paymentMethodValue = cardLabel ? (
    <span>
      <span className="tabular-nums">{cardLabel}</span>
      {cardExpiry ? (
        <span className="text-mute-light ml-2 text-xs tabular-nums">
          {labels.billing.card.expiry} {cardExpiry}
        </span>
      ) : null}
    </span>
  ) : (
    <span className="text-mute-light">{labels.billing.card.none}</span>
  );

  return (
    <div className="space-y-6">
      {/* スマホでは見出しとボタンを縦に積み、ボタンは幅いっぱいにする。 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-ink text-xl font-bold">{t.title}</h1>
          <p className="text-mute-light mt-0.5 text-[13px]">{t.subtitle}</p>
        </div>
        <BillingPortalButton
          hasCustomer={info.hasStripeCustomer}
          disabled={stripeUnavailable}
          className="w-full justify-center sm:w-auto"
        />
      </div>

      {/* A. 決済情報 */}
      <Card className="p-5">
        <h2 className="text-ink mb-3 text-sm font-semibold">{t.info.section}</h2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoRow label={t.info.fields.tenantName} value={info.tenantName} />
          <InfoRow
            label={t.info.fields.plan}
            value={info.plan ? (t.info.planLabels[info.plan] ?? info.plan) : notSet}
          />
          <InfoRow
            label={t.info.fields.unitPrice}
            value={
              price ? (
                <span className="tabular-nums">
                  {price}
                  <span className="text-mute-light">{t.info.cycleSuffix[info.cycle] ?? ""}</span>
                </span>
              ) : (
                notSet
              )
            }
          />
          <InfoRow label={t.info.fields.contractPeriod} value={period ?? notSet} />
          <InfoRow label={t.info.fields.method} value={paymentMethodValue} />
          <InfoRow
            label={t.info.fields.nextBillingAt}
            value={
              info.nextBillingAt ? (
                <span className="tabular-nums">{formatDate(info.nextBillingAt)}</span>
              ) : (
                notSet
              )
            }
          />
          <InfoRow
            label={t.info.fields.status}
            value={labels.billing.statusLabels[info.paymentStatus] ?? notSet}
          />
        </dl>
      </Card>

      {/* B. 決済履歴 */}
      <Card className="overflow-hidden p-0">
        <h2 className="text-ink border-hairline-light border-b px-5 py-3 text-sm font-semibold">
          {t.history.section}
        </h2>
        {invoices.length === 0 ? (
          <div className="px-5 py-8">
            <p className="text-ink text-sm font-medium">{t.history.empty}</p>
            <p className="text-mute-light mt-1 text-[13px]">{t.history.emptyHint}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-surface-soft/50">
                <tr className="border-hairline-light border-b">
                  <th scope="col" className={`${TH} w-[34%] sm:w-[18%]`}>
                    {t.history.columns.paidAt}
                  </th>
                  {/* 対象期間・支払い方法は補助情報。狭い画面では落とす。 */}
                  <th scope="col" className={`${TH} hidden sm:table-cell sm:w-[26%]`}>
                    {t.history.columns.period}
                  </th>
                  <th scope="col" className={`${TH} w-[34%] text-right sm:w-[18%]`}>
                    {t.history.columns.amount}
                  </th>
                  <th scope="col" className={`${TH} w-[32%] sm:w-[18%]`}>
                    {t.history.columns.status}
                  </th>
                  <th scope="col" className={`${TH} hidden md:table-cell md:w-[20%]`}>
                    {t.history.columns.method}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-hairline-light divide-y">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    {/* 未払いの請求はまだ支払日が無い。架空の日付は入れない。 */}
                    <td className={`${TD} tabular-nums`}>
                      {inv.paidAt ? formatDate(inv.paidAt) : t.dash}
                    </td>
                    <td className={`${TD} hidden tabular-nums sm:table-cell`}>
                      {invoicePeriod(inv.period) ?? t.dash}
                    </td>
                    <td className={`${TD} text-ink text-right tabular-nums`}>
                      {yen(inv.amount) ?? t.dash}
                    </td>
                    <td className={TD}>
                      {t.history.invoiceStatus[inv.status] ?? inv.status ?? t.dash}
                    </td>
                    <td className={`${TD} hidden md:table-cell`}>
                      {inv.method ?? cardLabel ?? t.dash}
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
