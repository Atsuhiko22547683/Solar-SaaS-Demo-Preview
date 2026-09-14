// 代理店 / SaaS 運営者のアカウントで二次店専用環境へログインしたときの案内。
//
// 黙って 404 にせず、「環境を間違えている」と分かる形で止める。
// 業務データは一切表示しない。

import Link from "next/link";

import { PartnerCard } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";

export const dynamic = "force-dynamic";

const t = labels.partner.home.unavailable;

export default function PartnerUnavailablePage() {
  return (
    <PartnerCard className="max-w-xl">
      <h1 className="text-ink text-lg font-bold">{t.title}</h1>
      <p className="text-body-light mt-2 text-sm">{t.body}</p>
      <Link
        href="/api/auth/signout"
        className="border-hairline-light text-ink hover:bg-surface-soft mt-4 inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium"
      >
        {t.signOut}
      </Link>
    </PartnerCard>
  );
}
