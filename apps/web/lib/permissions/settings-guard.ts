// 設定セクション / 決済管理の入口ガード（Server Component 用）。
//
// サイドバーからメニューを隠すだけでは、URL 直打ちで開けてしまう。
// 設定配下と /payments の各ページはこのガードを先頭で呼び、
// 権限が無ければ ForbiddenError を投げる（アプリの error boundary が 403 表示）。
//
// 個々のドメイン action（salesperson.read 等）は通常機能からも呼ばれるため
// capability を付けていない。入口をここで塞ぐのが役割分担。

import "server-only";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";

async function assertSectionAccess(action: "settings.read" | "payment.read"): Promise<void> {
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
}

/** 設定配下の画面（スタッフ一覧 / 取引先管理 / システムユーザー / エリア・場所管理 / 監査ログ）。 */
export async function assertSettingsAccess(): Promise<void> {
  await assertSectionAccess("settings.read");
}

/** 決済管理（/payments）。 */
export async function assertPaymentAccess(): Promise<void> {
  await assertSectionAccess("payment.read");
}
