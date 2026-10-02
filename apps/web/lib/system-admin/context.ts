// 運営管理サイト（BizOrch 運営管理）のサーバー側ガード。
//
// 会社をまたぐ取得・更新は、必ずこの関数を通した専用処理だけが行う。
// ページ・Server Action・API のどこから来ても同じ入口に揃える
//（画面を隠すだけでは URL 直打ちや Action への直接送信を止められない）。
//
// 既存のテナント分離・RLS は解除しない。運営者（SAAS_ADMIN）の文脈では
// `getTenantContext()` が横断の文脈を返す既存動作をそのまま使い、
// その手前で「運営権限があるか」を毎回確かめる。
//
// 代理店管理者・パートナー管理者であるだけでは通らない（`system_admin.*` は
// SAAS_ADMIN だけに与えている）。

import "server-only";

import { headers } from "next/headers";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";

import type { TenantContext } from "@solar/db";

/** 運営者の文脈。監査記録に残す操作者もここから取る。 */
export interface SystemAdminContext {
  ctx: TenantContext;
  actorUserId: string;
  actorName: string;
  actorEmail: string;
}

type SystemAdminAction =
  | "system_admin.access"
  | "system_admin.company.read"
  | "system_admin.company.write"
  | "system_admin.user.read"
  | "system_admin.user.write"
  | "system_admin.operator.read"
  | "system_admin.operator.write"
  | "system_admin.audit.read"
  | "system_admin.status.read";

/**
 * 運営権限を確かめて文脈を返す。
 *
 * 未ログインは UnauthorizedError、権限が無ければ assertCan が ForbiddenError を投げる。
 */
export async function requireSystemAdmin(
  action: SystemAdminAction = "system_admin.access",
): Promise<SystemAdminContext> {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError({
      code: "INVALID_CREDENTIALS",
      message: "Session missing — sign in is required",
    });
  }
  const ctx = await getTenantContext();
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
  return {
    ctx,
    actorUserId: ctx.actorUserId,
    actorName: session.user.name ?? "—",
    actorEmail: session.user.email ?? "—",
  };
}

/** 監査記録に添える接続元。取れなければ記録しない（作り話をしない）。 */
export async function requestMeta(): Promise<{ ip?: string; userAgent?: string }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const userAgent = h.get("user-agent") ?? undefined;
  return { ...(ip ? { ip } : {}), ...(userAgent ? { userAgent } : {}) };
}
