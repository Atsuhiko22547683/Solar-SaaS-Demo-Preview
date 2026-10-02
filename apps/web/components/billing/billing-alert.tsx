// ホーム上部に出す決済状態の警告。
//
// 横長のコンパクトな 1 ブロックにする。決済は「気付けること」が目的で、
// 画面の主役ではないため、巨大なカードで一覧を下へ押し出さない。
// 390px では説明と操作が縦に積まれるだけで、はみ出さない。
//
// 支払い済み（ACTIVE）のときは何も描かない。

import Link from "next/link";

import { labels } from "@/lib/i18n/labels";

import type { BillingStatus } from "@/lib/billing/status";

const t = labels.billing.alert;

/** 状態ごとの見た目。未払いは「止まっている」ので危険色、未登録は注意色。 */
const TONE = {
  danger: "border-danger/30 bg-danger/5 text-danger",
  caution: "border-caution/30 bg-caution/5 text-caution",
  muted: "border-hairline-light bg-surface-soft text-body-light",
} as const;

export function BillingAlert({
  status,
  /** オーナーだけが決済管理ページへ進める（payment capability は OWNER のみ）。 */
  canManagePayment,
}: {
  status: BillingStatus;
  canManagePayment: boolean;
}) {
  if (status === "ACTIVE") return null;

  const copy =
    status === "UNPAID"
      ? { ...t.unpaid, tone: TONE.danger }
      : status === "PAYMENT_METHOD_MISSING"
        ? { ...t.paymentMethodMissing, tone: TONE.caution }
        : { ...t.unavailable, tone: TONE.muted, ownerAction: null, otherAction: null };

  return (
    <div
      role="status"
      className={`flex flex-col gap-2 rounded-md border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${copy.tone}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold">{copy.title}</p>
        <p className="text-body-light mt-0.5 text-[13px]">{copy.body}</p>
      </div>

      {canManagePayment && copy.ownerAction ? (
        <Link
          href="/payments"
          className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-9 shrink-0 items-center justify-center rounded-md border bg-white px-3 text-sm font-medium"
        >
          {copy.ownerAction}
        </Link>
      ) : copy.otherAction ? (
        // オーナー以外は自分で解決できないので、誰に頼めばよいかだけを出す。
        <p className="text-body-light shrink-0 text-[13px]">{copy.otherAction}</p>
      ) : null}
    </div>
  );
}
