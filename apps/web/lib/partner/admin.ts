// 二次店管理者向けの共通ヘルパ。
//
// 管理者側の一覧は「誰が提出したか」を必ず扱う。提出者は各テーブルの
// createdByUserId / registeredByUserId に入っているが、User へのリレーションは
// 張っていない（提出物テーブルは relationship 複合 FK だけを持つ設計）。
// そのため氏名は同じ withTenant トランザクション内で bulk findMany して解決する。
// RLS が自テナントに絞るので、他社のユーザー名はそもそも引けない。
//
// スタッフ側の画面はこのモジュールを使わない（本人提出分しか扱わないため）。

import "server-only";

import type { PartnerContext } from "./context";
import type { TxClient } from "@solar/db";

/** 自社（同一テナント）の利用者。提出者セレクトと氏名解決の両方で使う。 */
export interface DealerUserOption {
  id: string;
  name: string;
}

/**
 * 提出者セレクトの選択肢。
 *
 * 削除済み（status=DELETED）も含める — 退職者が過去に提出した行を絞り込めなく
 * なると、管理者が提出物をたどれなくなるため。
 */
export async function listDealerUserOptions(
  tx: TxClient,
  partner: PartnerContext,
): Promise<DealerUserOption[]> {
  const rows = await tx.user.findMany({
    where: { tenantId: partner.tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return rows;
}

/** 提出者 id → 氏名。見つからない id は Map に入らない（画面側で「—」になる）。 */
export async function resolveUserNames(
  tx: TxClient,
  userIds: readonly string[],
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return new Map();
  const rows = await tx.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r) => [r.id, r.name]));
}

/**
 * 提出者による絞り込み条件。
 *
 * 閲覧範囲は自社全件（lib/partner/scope.ts）なので、これは利用者が選んだ絞り込み。
 * 管理者・スタッフとも使える — 「本人提出分だけ見る」も「同僚の提出分を見る」も
 * 同じ会社の中の操作なので、区分で分けない。
 * 対象外の userId を渡しても範囲外の行は出ない（範囲は scope 側が決める）。
 */
export function submittedByWhere(
  _partner: PartnerContext,
  userId: string | undefined,
): { createdByUserId: string } | Record<string, never> {
  if (!userId) return {};
  return { createdByUserId: userId };
}

/** 初訪アポ（Customer.registeredByUserId）版。 */
export function registeredByWhere(
  _partner: PartnerContext,
  userId: string | undefined,
): { registeredByUserId: string } | Record<string, never> {
  if (!userId) return {};
  return { registeredByUserId: userId };
}
