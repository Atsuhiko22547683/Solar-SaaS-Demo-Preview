// 二次店ポータルのトップ。
//
// グラフ・KPI・分析・通知は載せない（Google フォームの置き換えという目的を超えないため）。
//
// サイトで構成が違う（利用者のロールでは切り替えない）。
//   スタッフサイト … 当日の催事シフト → 週間カレンダー。業務カードは置かない
//                    （同じ入口が上部ナビにあり、押す場所が二重になるため）。
//                    催事に対する操作（出退勤・アポ登録・日報入力）はシフト欄に残す。
//   管理者サイト   … 9 業務を 3 つのまとまりに分けて並べる。1 画面で全業務へ届くことを
//                    優先し、まとまりの見出しで探す手がかりを作る。
// 到達可否そのものは middleware のパス表と権限（can.ts + requirePartnerContext）が
// 決めるので、ここは入口の並びだけ。

import Link from "next/link";

import { PartnerCard, PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext, franchiseNoLabel } from "@/lib/partner/context";
import { first, type RawParams } from "@/lib/partner/list-query";

import { getHomeWeek, parseWeekOffset } from "./week-data";
import { HomeWeekPanel } from "./week-panel";

export const dynamic = "force-dynamic";

const t = labels.partner.home;

interface HomeCard {
  key: string;
  title: string;
  body: string;
  /** 登録画面への導線。閲覧専用の領域は持たない。 */
  action?: { label: string; href: string };
  /** 一覧への導線。 */
  list: { label: string; href: string };
}

interface HomeSection {
  key: string;
  title: string;
  body: string;
  cards: HomeCard[];
}

const a = t.adminCards;

/** 管理者：9 業務。並び順は業務一覧の表に合わせる。 */
const ADMIN_SECTIONS: HomeSection[] = [
  {
    key: "submissions",
    title: t.adminSections.submissions.title,
    body: t.adminSections.submissions.body,
    cards: [
      {
        key: "appointments",
        title: a.appointments.title,
        body: a.appointments.body,
        list: { label: a.appointments.list, href: "/p-appointments" },
      },
      {
        key: "contracts",
        title: a.contracts.title,
        body: a.contracts.body,
        list: { label: a.contracts.list, href: "/p-contracts" },
      },
      {
        key: "reports",
        title: a.reports.title,
        body: a.reports.body,
        list: { label: a.reports.list, href: "/p-reports" },
      },
    ],
  },
  {
    key: "organization",
    title: t.adminSections.organization.title,
    body: t.adminSections.organization.body,
    cards: [
      {
        key: "salespeople",
        title: a.salespeople.title,
        body: a.salespeople.body,
        action: { label: a.salespeople.action, href: "/p-salespeople/new" },
        list: { label: a.salespeople.list, href: "/p-salespeople" },
      },
      {
        key: "accounts",
        title: a.accounts.title,
        body: a.accounts.body,
        list: { label: a.accounts.list, href: "/p-accounts" },
      },
    ],
  },
  {
    key: "business",
    title: t.adminSections.business.title,
    body: t.adminSections.business.body,
    cards: [
      {
        key: "customers",
        title: a.customers.title,
        body: a.customers.body,
        list: { label: a.customers.list, href: "/p-customers" },
      },
      {
        key: "commissions",
        title: a.commissions.title,
        body: a.commissions.body,
        list: { label: a.commissions.list, href: "/p-commissions" },
      },
      {
        key: "lanePreferences",
        title: a.lanePreferences.title,
        body: a.lanePreferences.body,
        action: { label: a.lanePreferences.action, href: "/p-lane-preferences/new" },
        list: { label: a.lanePreferences.list, href: "/p-lane-preferences" },
      },
      {
        key: "consultations",
        title: a.consultations.title,
        body: a.consultations.body,
        action: { label: a.consultations.action, href: "/p-consultations/new" },
        list: { label: a.consultations.list, href: "/p-consultations" },
      },
      {
        key: "shifts",
        title: a.shifts.title,
        body: a.shifts.body,
        list: { label: a.shifts.list, href: "/p-shifts" },
      },
    ],
  },
];

function CardGrid({ cards }: { cards: HomeCard[] }) {
  return (
    // 390px では 1 列、それ以上で 2〜3 列。カードの高さを揃えて押し間違いを減らす。
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <PartnerCard key={card.key} className="flex flex-col">
          <h3 className="text-ink text-sm font-semibold">{card.title}</h3>
          <p className="text-mute-light mt-1 flex-1 text-[13px]">{card.body}</p>
          <div className="mt-4 flex flex-col gap-2">
            {card.action ? (
              <Link
                href={card.action.href}
                className="bg-primary focus-visible:ring-primary/40 inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 sm:h-9 sm:w-auto sm:px-3"
              >
                {card.action.label}
              </Link>
            ) : null}
            <Link
              href={card.list.href}
              className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 w-full items-center justify-center rounded-md border px-4 text-sm sm:h-9 sm:w-auto sm:px-3"
            >
              {card.list.label}
            </Link>
          </div>
        </PartnerCard>
      ))}
    </div>
  );
}

export default async function PartnerHomePage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  // 所属（加盟店番号）とサイト区分はサーバー側で解決する。
  // ここで落ちれば取引関係の設定漏れか、サイトの利用対象外。
  const partner = await requirePartnerContext("partner_appointment.read");
  const isStaff = partner.site === "STAFF";
  // スタッフのトップは「今週の本人の催事シフト」を先頭に置く。
  const params = await searchParams;
  const week = isStaff ? await getHomeWeek(parseWeekOffset(first(params, "week"))) : null;

  return (
    <div>
      <PartnerPageHeader title={t.title} description={isStaff ? t.staffSubtitle : t.subtitle} />

      {/* 加盟店番号は表示のみ。入力させない（登録時はサーバー側で自動設定）。 */}
      {franchiseNoLabel(partner) ? (
        <p className="text-mute-light mb-5 text-[13px]">
          {t.franchiseNoLabel}:{" "}
          <span className="text-ink tabular-nums">{franchiseNoLabel(partner)}</span>
        </p>
      ) : null}

      {/* スタッフ：当日の催事シフト → 週間カレンダー。 */}
      {week ? <HomeWeekPanel data={week} /> : null}

      {isStaff ? null : (
        <div className="space-y-8">
          {ADMIN_SECTIONS.map((section) => (
            <section key={section.key} aria-labelledby={`home-${section.key}`}>
              <h2 id={`home-${section.key}`} className="text-ink text-sm font-bold">
                {section.title}
              </h2>
              <p className="text-mute-light mb-3 mt-0.5 text-[13px]">{section.body}</p>
              <CardGrid cards={section.cards} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
