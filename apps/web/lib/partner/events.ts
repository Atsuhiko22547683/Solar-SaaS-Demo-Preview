// 催事（Event / EventDay）をパートナー側から扱う共通処理。
//
// 催事と顧客・アポ・日報は必ず id で結ぶ。店舗名などの文字列一致では結ばない
// （同名店舗・表記ゆれで別催事の実績に混ざるため）。
//
// 閲覧範囲は lib/partner/scope.ts の eventScope（自社が担当会社として割り当てられた催事）。
// 別の依頼元代理店の催事も、自社が担当なら範囲に入る。

import "server-only";

import { NotFoundError } from "@/lib/errors";

import { eventScope } from "./scope";

import type { PartnerContext } from "./context";
import type { TxClient } from "@solar/db";

/** 催事の識別と、アポ登録時に初期入力へ使う値。 */
export interface PartnerEventRef {
  eventId: string;
  /** 依頼元代理店（この催事を計画した代理店）の Relationship.id。自社ぶんに限る。 */
  relationshipId: string;
  wholesalerId: string;
  wholesalerName: string;
  /** 催事場所（EventCandidate.storeName）。 */
  venuePlace: string;
  venueChain: string | null;
  boothArea: string | null;
  boothAreaNote: string | null;
  /** 選択された開催日。指定が無ければ催事の最初の開催日。 */
  eventDayId: string | null;
  eventDate: Date | null;
  startAt: Date | null;
  endAt: Date | null;
}

/**
 * 催事が自社の担当範囲にあることを確かめ、初期入力に使う値を返す。
 *
 * 受け取った eventId / eventDayId は必ずここを通す。範囲外なら存在を教えず NotFound。
 */
export async function resolvePartnerEvent(
  tx: TxClient,
  partner: PartnerContext,
  eventId: string,
  eventDayId?: string | null,
): Promise<PartnerEventRef> {
  const event = await tx.event.findFirst({
    where: { id: eventId, ...eventScope(partner) },
    select: {
      id: true,
      wholesalerId: true,
      eventCandidate: {
        select: {
          storeName: true,
          venueChain: true,
          boothArea: true,
          boothAreaNote: true,
          scheduledDate: true,
        },
      },
      dealers: {
        where: { relationshipId: { in: partner.relationshipIds } },
        select: { relationshipId: true },
      },
      days: {
        orderBy: { eventDate: "asc" },
        select: { id: true, eventDate: true, startAt: true, endAt: true },
      },
    },
  });
  if (!event) throw new NotFoundError("対象の催事が見つかりません");

  // 自社ぶんの割当。eventScope で絞っているので必ず 1 件以上ある。
  const own = event.dealers[0];
  if (!own) throw new NotFoundError("対象の催事が見つかりません");

  const rel = partner.relationships.find((r) => r.id === own.relationshipId);

  // 指定された開催日が該当催事のものかを確認する。指定が無ければ最初の日。
  const day = eventDayId
    ? (event.days.find((d) => d.id === eventDayId) ?? null)
    : (event.days[0] ?? null);
  if (eventDayId && !day) throw new NotFoundError("対象の開催日が見つかりません");

  return {
    eventId: event.id,
    relationshipId: own.relationshipId,
    wholesalerId: event.wholesalerId,
    wholesalerName: rel?.wholesalerName ?? "—",
    venuePlace: event.eventCandidate.storeName,
    venueChain: event.eventCandidate.venueChain,
    boothArea: event.eventCandidate.boothArea,
    boothAreaNote: event.eventCandidate.boothAreaNote,
    eventDayId: day?.id ?? null,
    // 開催日が未登録の催事は候補の予定日に倒す（架空の日付は作らない）。
    eventDate: day?.eventDate ?? event.eventCandidate.scheduledDate ?? null,
    startAt: day?.startAt ?? null,
    endAt: day?.endAt ?? null,
  };
}

/**
 * 任意の催事リンク。eventId が未指定なら null を返す（催事外からの登録）。
 */
export async function resolveOptionalPartnerEvent(
  tx: TxClient,
  partner: PartnerContext,
  eventId: string | undefined,
  eventDayId?: string | null,
): Promise<PartnerEventRef | null> {
  if (!eventId) return null;
  return resolvePartnerEvent(tx, partner, eventId, eventDayId);
}
