// 二次店ポータルのサーバー側コンテキスト。
//
// 「どの二次店として書き込むか」を決める唯一の場所。画面・Server Action は
// すべてここを通し、フォームや URL から relationshipId / wholesalerId /
// createdByUserId を受け取らない（§3 データ整合性）。
//
// 当面 1 アカウント = 取引先代理店 1 社固定の運用なので、ACTIVE な Relationship が
// ちょうど 1 件であることを前提にする。0 件・複数件は業務設定の誤りとして明示的に
// 落とす（黙ってどれかを選ぶと、別の代理店の配下にデータが入る事故になる）。

import "server-only";

import { auth } from "@/auth";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { assertCan, type PermissionAction } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { TenantContext } from "@solar/db";

export interface PartnerContext {
  /** withTenant に渡すテナント文脈（RLS の GUC 設定元）。 */
  ctx: TenantContext;
  /** 提出元の二次店（卸業者×二次店）。 */
  relationshipId: string;
  /** 取引先の代理店。 */
  wholesalerId: string;
  /** 加盟店番号（Relationship 由来。ユーザーには入力させない）。 */
  franchiseNo: string | null;
  /** 操作者。 */
  userId: string;
}

/**
 * 二次店ポータルの実行文脈を解決する。
 *
 * 1. 認証必須
 * 2. 二次店テナントであること（代理店アカウントはここへ来ない）
 * 3. 指定アクションの権限
 * 4. ACTIVE な Relationship が 1 件であること
 */
export async function requirePartnerContext(action: PermissionAction): Promise<PartnerContext> {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError({
      code: "INVALID_CREDENTIALS",
      message: "Session missing — sign in is required",
    });
  }

  const ctx = await getTenantContext();

  // SaaS 運営者も含め、二次店テナント以外はこのポータルの対象外。
  // 代理店アカウントは variant ガードで先に止まるが、Server Action を直接
  // 叩かれた場合に備えてここでも落とす。
  if (!ctx.dealerId) {
    throw new ForbiddenError("二次店アカウントでのみ利用できます", { action });
  }

  assertCan({
    user: {
      userId: ctx.actorUserId,
      roles: session.user.roles,
      isSaasAdmin: ctx.isSaasAdmin,
      tenantId: ctx.tenantId,
      wholesalerId: ctx.wholesalerId,
      dealerId: ctx.dealerId,
      relationshipIds: ctx.relationshipIds,
    },
    action,
  });

  const relationshipIds = ctx.relationshipIds ?? [];
  if (relationshipIds.length === 0) {
    throw new ForbiddenError("取引先の代理店が設定されていません。代理店にご確認ください");
  }
  if (relationshipIds.length > 1) {
    // 1 社固定運用の前提が崩れている。推測で 1 件目を選ばず、運用側に直させる。
    throw new ValidationError(
      "複数の代理店と取引がある状態は現在サポートしていません。代理店にご確認ください",
    );
  }

  const relationshipId = relationshipIds[0]!;

  // Relationship の実在と、それが本当に自社のものかを DB 側でも確認する
  // （RLS 越しに引くので、他社の relationshipId は初めから見えない）。
  const relationship = await withTenant(ctx, (tx) =>
    tx.relationship.findFirst({
      where: { id: relationshipId, dealerId: ctx.dealerId, status: "ACTIVE" },
      select: { id: true, wholesalerId: true, franchiseNo: true },
    }),
  );
  if (!relationship) {
    throw new ForbiddenError("有効な取引関係が見つかりません");
  }

  return {
    ctx,
    relationshipId: relationship.id,
    wholesalerId: relationship.wholesalerId,
    franchiseNo: relationship.franchiseNo,
    userId: ctx.actorUserId,
  };
}
