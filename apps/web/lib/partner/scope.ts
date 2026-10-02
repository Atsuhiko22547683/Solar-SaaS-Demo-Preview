// パートナーポータルの「行の閲覧範囲」を決める唯一の場所。
//
// デモ段階の方針: 所属パートナー会社が取り扱うデータは、通常スタッフ・ゲストスタッフとも
// 全件閲覧できる。「本人提出分のみ」「本人担当分のみ」「参加した催事のみ」は閲覧の
// 制限には使わない。これらは絞り込み条件（submittedBy / assignee / eventId）として
// 使い、閲覧範囲とは分けて扱う。
//
// ここを通す対象: 一覧・詳細・件数・検索候補・関連データ取得。同じ関数を使うことで、
// 「一覧では出ないが詳細を直接開けば見える」といったずれを作らない。
//
// 「全件」は自社が当事者の取引関係（relationshipIds）に限る。複数の代理店から依頼を
// 受けている場合はその全社ぶんが範囲になるが、無関係な他社のデータは入らない。
//
// 項目単位のマスキング（氏名・電話・住所）はここでは扱わない。行が見えることと、
// 個人情報が出ることは別の判断（@solar/contracts の masking サービス）。

import "server-only";

import type { PartnerContext } from "./context";
import type { Prisma } from "@solar/db";

/**
 * relationshipId 列を持つ表（DealerEventReport / DealerVisitAppointment /
 * DealerContractReport / LanePreference / VenueConsultation など）の閲覧範囲。
 */
export function relationshipScope(partner: PartnerContext): { relationshipId: { in: string[] } } {
  return { relationshipId: { in: partner.relationshipIds } };
}

/**
 * 顧客の閲覧範囲。自社が保有している顧客と、自社が登録した顧客の両方。
 *
 * 会社割当の変更で過去の帰属が書き換わらないよう、ownerRelationshipId と
 * registeredByRelationshipId の両方を見る（登録した側からも辿れるようにする）。
 */
export function customerScope(partner: PartnerContext): Prisma.CustomerWhereInput {
  const ids = partner.relationshipIds;
  return {
    OR: [{ ownerRelationshipId: { in: ids } }, { registeredByRelationshipId: { in: ids } }],
  };
}

/**
 * 催事の閲覧範囲。自社が担当会社として割り当てられている催事。
 *
 * 別の依頼元代理店の催事も、自社が担当なら範囲に入る。これがスタッフの
 * 配置重複判定（代理店をまたいだ重複）を成り立たせる根拠。
 */
export function eventScope(partner: PartnerContext): Prisma.EventWhereInput {
  return { dealers: { some: { relationshipId: { in: partner.relationshipIds } } } };
}

/** 催事の開催日の閲覧範囲（親 Event 経由）。 */
export function eventDayScope(partner: PartnerContext): Prisma.EventDayWhereInput {
  return { event: eventScope(partner) };
}

/** シフトの閲覧範囲（親 Event 経由）。 */
export function shiftScope(partner: PartnerContext): Prisma.EventShiftWhereInput {
  return { event: eventScope(partner) };
}

/** 自社スタッフ（販売員マスタ）の閲覧範囲。 */
export function salespersonScope(partner: PartnerContext): Prisma.SalespersonWhereInput {
  return { relationshipId: { in: partner.relationshipIds } };
}

// ---------------------------------------------------------------------------
// 絞り込み条件（閲覧範囲ではない）
//
// 「本人が提出した分だけ見たい」「この担当者の分だけ見たい」は利用者の操作なので、
// 範囲の制限ではなく where の追加条件として扱う。値が無ければ何も足さない。
// ---------------------------------------------------------------------------

/** 提出者（createdByUserId）での絞り込み。管理者・スタッフとも利用できる。 */
export function submittedByFilter(userId: string | undefined): { createdByUserId?: string } {
  return userId ? { createdByUserId: userId } : {};
}

/** 登録者（registeredByUserId）での絞り込み。 */
export function registeredByFilter(userId: string | undefined): { registeredByUserId?: string } {
  return userId ? { registeredByUserId: userId } : {};
}

/** 依頼元代理店での絞り込み。自社の集合外の id は無視する（存在を教えない）。 */
export function relationshipFilter(
  partner: PartnerContext,
  relationshipId: string | undefined,
): { relationshipId?: string } {
  if (!relationshipId) return {};
  return partner.relationshipIds.includes(relationshipId) ? { relationshipId } : {};
}
