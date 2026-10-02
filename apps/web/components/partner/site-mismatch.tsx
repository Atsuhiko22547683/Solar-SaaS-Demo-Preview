// サイトの取り違え案内。
//
// 二次店スタッフサイトと二次店管理者サイトは別 URL・別プロセスで動く。
// 対象外のロールで開いたときに、黙って空の画面や 404 を返さず、
// 正しいサイトへの入口を出す。業務データは一切表示しない。
//
// リンク先は環境変数（lib/site-urls.ts）から作る。いま動いているサイトの URL を
// そのまま使い回さない。

import "server-only";

import Link from "next/link";

import { PartnerCard } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";
import { siteBaseUrl } from "@/lib/site-urls";

import type { PartnerSite } from "@/lib/app-variant";

const t = labels.partner.siteMismatch;

export function PartnerSiteMismatch({
  site,
  roles,
}: {
  /** いま開いているサイト。 */
  site: PartnerSite;
  roles: readonly string[];
}) {
  const isDealer = roles.some((r) => r === "DEALER_ADMIN" || r === "DEALER_STAFF");

  // 二次店アカウントなら、もう一方のサイトへ案内する。
  const other = site === "STAFF" ? "partner-admin" : "partner";
  const otherName = site === "STAFF" ? t.adminSiteName : t.staffSiteName;

  const title = !isDealer ? t.notDealerTitle : site === "STAFF" ? t.staffTitle : t.adminTitle;
  const body = !isDealer ? t.notDealerBody : site === "STAFF" ? t.staffBody : t.adminBody;

  return (
    <PartnerCard className="max-w-xl">
      <h1 className="text-ink text-lg font-bold">{title}</h1>
      <p role="alert" className="text-body-light mt-2 text-sm">
        {body}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {isDealer ? (
          <a
            href={`${siteBaseUrl(other)}/login`}
            className="bg-primary focus-visible:ring-primary/40 inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium text-white focus:outline-none focus-visible:ring-2"
          >
            {t.openOther.replace("{site}", otherName)}
          </a>
        ) : null}
        <Link
          href="/api/auth/signout"
          className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 items-center justify-center rounded-md border px-4 text-sm font-medium"
        >
          {t.signOut}
        </Link>
      </div>
    </PartnerCard>
  );
}
