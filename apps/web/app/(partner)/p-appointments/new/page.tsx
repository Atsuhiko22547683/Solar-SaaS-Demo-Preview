// パートナーポータル：アポイントの新規登録。
//
// 初訪アポ / 訪問アポを 1 画面のタブで切り替える。選択状態は URL クエリ
// （?type=first-visit / ?type=visit）に持たせるので、再読み込みしても維持される。
// 保存先はタブごとに違う（初訪 = Customer + Appointment / 訪問 = 専用テーブル）。
//
// 催事からの登録:
//   トップの「この催事からアポ登録」は ?eventId=&eventDayId= を付けて来る。
//   催事が決まっていれば上部の業務情報を初期入力し、担当者・アポ獲得者の候補を
//   その催事・当日の参加スタッフに限る。決まっていなければ候補を並べて選ばせる
//   （ログイン利用者だけを根拠に対象催事を推測して確定しない）。

import Link from "next/link";

import { PartnerCard, PartnerPageHeader } from "@/components/partner/partner-ui";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext, franchiseNoLabel } from "@/lib/partner/context";
import { listPartnerOrigins } from "@/lib/partner/origins";

import { listPartnerCustomerOptions } from "../../p-customers/data";
import { PartnerFirstVisitForm } from "../appointment-form";
import {
  getAppointmentEventContext,
  listMyEventChoices,
  listPartnerCloseCompanyOptions,
  listPartnerSalespersonOptions,
} from "../data";
import { resolveKindParam } from "../kind";
import { AppointmentKindTabs } from "../kind-tabs";
import { PartnerVisitForm } from "../visit-form";

export const dynamic = "force-dynamic";

const ec = labels.partner.appointment.eventContext;
const ep = labels.partner.appointment.eventPicker;

export default async function NewPartnerAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string | string[];
    eventId?: string | string[];
    eventDayId?: string | string[];
  }>;
}) {
  const { type, eventId, eventDayId } = await searchParams;
  const kindParam = resolveKindParam(type);
  const eventIdValue = Array.isArray(eventId) ? eventId[0] : eventId;
  const eventDayIdValue = Array.isArray(eventDayId) ? eventDayId[0] : eventDayId;

  const partner = await requirePartnerContext("partner_appointment.write");

  // 依頼先代理店の候補（複数の代理店から依頼を受ける会社では選択が要る）。

  const origins = await listPartnerOrigins("partner_appointment.write");
  // 逐次実行にして、1 リクエストで同時に開く DB トランザクションを 1 本に保つ。
  const [salespeople, customers] = await Promise.all([
    listPartnerSalespersonOptions(),
    // 訪問アポ報告の「対象の顧客」候補。自社が取り扱っている顧客だけ。
    listPartnerCustomerOptions(),
  ]);
  // 催事から来たときだけ、その催事の文脈（初期入力と参加スタッフ）を読む。
  // 範囲外・不明な催事 id は null になり、通常の登録として続けられる。
  const eventContext = eventIdValue
    ? await getAppointmentEventContext(eventIdValue, eventDayIdValue ?? null)
    : null;
  // 催事が決まっていないときだけ候補を出す。
  const eventChoices = eventContext ? [] : await listMyEventChoices();

  const choiceHref = (choice: { eventId: string; eventDayId: string | null }): string => {
    const params = new URLSearchParams({ eventId: choice.eventId });
    if (choice.eventDayId) params.set("eventDayId", choice.eventDayId);
    return `/p-appointments/new?${params.toString()}`;
  };

  return (
    <div>
      <PartnerPageHeader title={labels.partner.appointment.newTitle} />
      <div className="mb-5">
        <AppointmentKindTabs current={kindParam} />
      </div>

      {/* 催事の文脈。初期入力の出どころを明示し、選び直せるようにする。 */}
      {eventContext ? (
        <PartnerCard className="mb-5">
          <h2 className="text-ink text-sm font-semibold">{ec.title}</h2>
          <dl className="mt-2 grid gap-x-4 gap-y-1 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-mute-light inline">{ec.venue}: </dt>
              <dd className="text-ink inline">{eventContext.venuePlace}</dd>
            </div>
            <div>
              <dt className="text-mute-light inline">{ec.date}: </dt>
              <dd className="text-ink inline tabular-nums">{eventContext.eventDate}</dd>
            </div>
            <div>
              <dt className="text-mute-light inline">{ec.origin}: </dt>
              <dd className="text-ink inline">{eventContext.originName}</dd>
            </div>
            <div>
              <dt className="text-mute-light inline">{ec.company}: </dt>
              <dd className="text-ink inline">{eventContext.companyName}</dd>
            </div>
          </dl>
          <p className="text-mute-light mt-2 text-xs">{ec.registeredByHint}</p>
          <Link
            href="/p-appointments/new"
            className="text-primary mt-2 inline-block text-sm underline-offset-4 hover:underline"
          >
            {ec.change}
          </Link>
        </PartnerCard>
      ) : kindParam !== "visit" ? (
        <PartnerCard className="mb-5">
          <h2 className="text-ink text-sm font-semibold">{ep.title}</h2>
          <p className="text-mute-light mb-2 mt-0.5 text-[13px]">{ep.hint}</p>
          {eventChoices.length === 0 ? (
            <p className="text-mute-light text-sm">{ep.empty}</p>
          ) : (
            <ul className="space-y-1">
              {eventChoices.map((choice) => (
                <li key={`${choice.eventId}-${choice.eventDayId ?? "none"}`}>
                  <Link
                    href={choiceHref(choice)}
                    className="border-hairline-light text-ink hover:bg-surface-soft flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm"
                  >
                    <span className="tabular-nums">{choice.date}</span>
                    <span className="min-w-0 truncate">{choice.venuePlace}</span>
                    <span className="text-mute-light shrink-0 text-xs">{choice.originName}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PartnerCard>
      ) : null}

      {kindParam === "visit" ? (
        <PartnerVisitForm
          mode="create"
          franchiseNo={franchiseNoLabel(partner)}
          origins={origins.options}
          salespeople={salespeople}
          customers={customers}
        />
      ) : (
        <PartnerFirstVisitForm
          mode="create"
          franchiseNo={franchiseNoLabel(partner)}
          origins={origins.options}
          salespeople={salespeople}
          closeCompanies={await listPartnerCloseCompanyOptions()}
          eventContext={eventContext}
        />
      )}
    </div>
  );
}
