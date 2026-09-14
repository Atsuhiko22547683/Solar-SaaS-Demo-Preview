// 二次店ポータルのトップ。
//
// 登録画面への入口だけを置く。グラフ・KPI・分析・通知は載せない
// （Google フォームの置き換えという目的を超えないため）。

import Link from "next/link";

import { PartnerCard, PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext } from "@/lib/partner/context";

export const dynamic = "force-dynamic";

const t = labels.partner.home;

const CARDS = [
  { key: "appointments", href: "/p-appointments", copy: t.cards.appointments },
  { key: "reports", href: "/p-reports", copy: t.cards.reports },
  { key: "salespeople", href: "/p-salespeople", copy: t.cards.salespeople },
] as const;

export default async function PartnerHomePage() {
  // 所属（加盟店番号）は認証情報から解決する。ここで落ちれば取引関係の設定漏れ。
  const partner = await requirePartnerContext("partner_appointment.read");

  return (
    <div>
      <PartnerPageHeader title={t.title} description={t.subtitle} />

      {/* 加盟店番号は表示のみ。入力させない（登録時はサーバー側で自動設定）。 */}
      {partner.franchiseNo ? (
        <p className="text-mute-light mb-5 text-[13px]">
          {t.franchiseNoLabel}: <span className="text-ink tabular-nums">{partner.franchiseNo}</span>
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CARDS.map((card) => (
          <PartnerCard key={card.key}>
            <h2 className="text-ink text-sm font-semibold">{card.copy.title}</h2>
            <p className="text-mute-light mt-1 text-[13px]">{card.copy.body}</p>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href={`${card.href}/new`}
                className="bg-primary focus-visible:ring-primary/40 inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-white focus:outline-none focus-visible:ring-2"
              >
                {card.copy.action}
              </Link>
              <Link
                href={card.href}
                className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm"
              >
                {card.copy.list}
              </Link>
            </div>
          </PartnerCard>
        ))}
      </div>
    </div>
  );
}
