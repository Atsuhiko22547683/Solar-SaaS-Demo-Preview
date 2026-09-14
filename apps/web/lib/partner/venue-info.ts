// アポイントの催事情報を 1 か所で解決する。
//
// 催事は 2 通りの持ち方がある:
//   a. 代理店が登録済みのイベントを選んだ  … Customer.sourceEventId → EventCandidate
//   b. イベントが無い状態で直接入力した    … Customer.source* 列
//
// どちらが正かを各画面が判断すると、二次店側と代理店側で表示が食い違う。
// 解決はこのモジュールの関数だけが行い、画面は結果を受け取って描くだけにする。
//
// "use client" は付けない — Server Component / ローダーから呼ぶ純関数。

import type { BoothArea, VenueChain } from "@solar/db";

/** イベント（EventCandidate）から引ける催事情報。 */
export interface VenueInfoFromEvent {
  scheduledDate: Date | null;
  storeName: string | null;
  venueChain: VenueChain | null;
  boothArea: BoothArea | null;
  boothAreaNote: string | null;
}

/** 顧客行が持つフォールバック値。 */
export interface VenueInfoFromCustomer {
  sourceEventDate: Date | null;
  sourceVenuePlace: string | null;
  sourceVenueChain: VenueChain | null;
  sourceBoothArea: BoothArea | null;
  sourceBoothAreaNote: string | null;
}

/** 画面へ渡す解決済みの催事情報。日付は ISO 文字列にして描画側の型を揃える。 */
export interface ResolvedVenueInfo {
  /** 催事実施日（ISO）。 */
  eventDate: string | null;
  /** 催事場所。 */
  venuePlace: string | null;
  /** 催事種別。 */
  venueChain: VenueChain | null;
  /** 催事ブース場所。 */
  boothArea: BoothArea | null;
  /** ブース場所が OTHER のときの自由記述。 */
  boothAreaNote: string | null;
  /** イベント由来か（画面で「登録済み催事から」と示したいとき用）。 */
  fromEvent: boolean;
}

/**
 * 催事情報を解決する。
 *
 * イベントが紐づいていればイベント側を正とする（source* 列は書き込んでいないので
 * そもそも競合しないが、過去データや手動投入で両方入っていた場合もイベントを優先する）。
 */
export function resolveVenueInfo(
  event: VenueInfoFromEvent | null,
  customer: VenueInfoFromCustomer,
): ResolvedVenueInfo {
  if (event) {
    return {
      eventDate: event.scheduledDate ? event.scheduledDate.toISOString() : null,
      venuePlace: event.storeName,
      venueChain: event.venueChain,
      boothArea: event.boothArea,
      boothAreaNote: event.boothAreaNote,
      fromEvent: true,
    };
  }
  return {
    eventDate: customer.sourceEventDate ? customer.sourceEventDate.toISOString() : null,
    venuePlace: customer.sourceVenuePlace,
    venueChain: customer.sourceVenueChain,
    boothArea: customer.sourceBoothArea,
    boothAreaNote: customer.sourceBoothAreaNote,
    fromEvent: false,
  };
}

/**
 * ブース場所の表示文字列。
 *
 * OTHER のときだけ自由記述を使う。ラベルは呼び出し側から渡す
 * （UI 文言は labels.ts に集約する方針のため、ここには持たない）。
 */
export function boothAreaText(
  // DTO 側は enum を string 化して持つため、値域を固定せず受け取る。
  info: { boothArea: string | null; boothAreaNote: string | null },
  labelsByValue: Record<string, string>,
): string | null {
  if (!info.boothArea) return null;
  if (info.boothArea === "OTHER") {
    return info.boothAreaNote && info.boothAreaNote.length > 0
      ? info.boothAreaNote
      : (labelsByValue.OTHER ?? null);
  }
  return labelsByValue[info.boothArea] ?? info.boothArea;
}

/** Prisma の select に必要な Customer 側の列（取り違え防止のため 1 か所で定義）。 */
export const CUSTOMER_VENUE_SELECT = {
  sourceEventId: true,
  sourceEventDate: true,
  sourceVenuePlace: true,
  sourceVenueChain: true,
  sourceBoothArea: true,
  sourceBoothAreaNote: true,
} as const;

/** Prisma の select に必要な EventCandidate 側の列。 */
export const EVENT_VENUE_SELECT = {
  scheduledDate: true,
  storeName: true,
  venueChain: true,
  boothArea: true,
  boothAreaNote: true,
} as const;
