import "server-only";

// システムユーザー管理のロール階層ガード（サーバー側）。
//
//   OWNER > SYSTEM_ADMIN > GENERAL_USER
//
// 「自分より上位のユーザーは登録・編集・削除できない」を、invite / update /
// delete のすべての Server Action で同じ関数から強制する。
// 各 action 内でロール名を直接比較しない（判定は can.ts の 1 か所に集約）。
//
// クライアントから送られてきた対象ロールは信用せず、必ず DB から
// 対象 User の現在ロールを読み直してから判定する（docs の指針どおり）。

import { ForbiddenError, ValidationError } from "@/lib/errors";
import { canManageRole, canManageUser } from "@/lib/permissions/can";

import type { AppRole, TxClient } from "@solar/db";

const UPPER_ROLE_MESSAGE = "上位権限のユーザーは操作できません";
const UPPER_TARGET_ROLE_MESSAGE = "自分より上位の権限は指定できません";

/** DB から読んだロール一覧（1 ユーザー 1 ロール運用だが配列で扱う）。 */
async function rolesOf(tx: TxClient, userId: string): Promise<AppRole[]> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { roles: { select: { role: true } } },
  });
  if (!user) return [];
  return user.roles.map((r) => r.role);
}

/**
 * 操作主体（ログイン中ユーザー）の現在ロール。
 *
 * セッションの値ではなく DB を正とする。セッション発行後にロールが下げられた
 * ケースでも、その場で正しく弾けるようにするため。
 */
export async function actorRoles(tx: TxClient, actorUserId: string): Promise<AppRole[]> {
  return rolesOf(tx, actorUserId);
}

/**
 * 対象ユーザーを管理できることを確認する（編集 / 削除の入口）。
 * 対象が存在しない場合もここで弾く。
 */
export async function assertCanManageTargetUser(
  tx: TxClient,
  actorUserId: string,
  targetUserId: string,
): Promise<void> {
  const exists = await tx.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
  if (!exists) throw new ValidationError("ユーザーが見つかりません");

  const [actor, target] = await Promise.all([rolesOf(tx, actorUserId), rolesOf(tx, targetUserId)]);
  if (!canManageUser(actor, target)) {
    throw new ForbiddenError(UPPER_ROLE_MESSAGE, { actorRoles: actor });
  }
}

/**
 * 付与しようとしているロールが自分以下であることを確認する。
 * 招待（新規登録）と、編集によるロール変更の両方で使う。
 */
export async function assertCanAssignRole(
  tx: TxClient,
  actorUserId: string,
  nextRole: string,
): Promise<void> {
  const actor = await rolesOf(tx, actorUserId);
  if (!canManageRole(actor, nextRole)) {
    throw new ForbiddenError(UPPER_TARGET_ROLE_MESSAGE, { actorRoles: actor, nextRole });
  }
}
