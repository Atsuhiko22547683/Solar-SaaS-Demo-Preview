// Data loader for wholesaler member management (F-006 / S-018 sub).
// Lists all Users that have a UserRole scoped to this wholesaler's tenant.
// Guard: auth → assertCan(member.read) → withTenant.
//
// 設定 >「システムユーザー」画面が使う。ここで扱うのは本アプリへログインできる
// User だけで、催事に立つスタッフ全般（Salesperson）は /salespeople が担当する
// 別概念。User 情報はどこにも複製せず、常にこのローダーから読む。

import "server-only";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { assignableRoles, canManageUser, type SystemRole } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { AppRole, UserStatus } from "@solar/db";

export interface MemberListItem {
  id: string;
  name: string;
  email: string;
  roles: AppRole[];
  twoFactorRequired: boolean;
  status: UserStatus;
  lastLoginAt: string | null;
  /**
   * ログイン中ユーザーがこの行を管理（編集 / 削除）できるか。
   * 自分より上位のロールを持つ相手は false。表示自体は行う。
   * 実際の遮断は Server Action 側の階層ガードが行い、ここは導線制御。
   */
  canManage: boolean;
}

/** ログイン中ユーザーが新規登録で指定できるロール（上位は含まない）。 */
export async function listAssignableMemberRoles(): Promise<SystemRole[]> {
  const { session } = await requireCtx();
  return assignableRoles(session.user.roles);
}

async function requireCtx() {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError({
      code: "INVALID_CREDENTIALS",
      message: "Session missing",
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
    action: "member.read",
    resource: ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined,
  });
  return { ctx, session };
}

export async function listWholesalerMembers(): Promise<MemberListItem[]> {
  const { ctx, session } = await requireCtx();
  return withTenant(ctx, async (tx) => {
    const users = await tx.user.findMany({
      // 論理削除済み（status = DELETED）は通常一覧に出さない。行は残るので
      // 監査ログや担当履歴からの参照は切れない。
      where: { tenantId: ctx.tenantId, status: { not: "DELETED" } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        twoFactorRequired: true,
        status: true,
        lastLoginAt: true,
        roles: { select: { role: true } },
      },
    });

    // 階層判定はセッションのロールで行う（表示の出し分けのみ。
    // 書き込み時は Server Action が DB のロールで再判定する）。
    const actorRoles = session.user.roles;
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      roles: u.roles.map((r) => r.role),
      twoFactorRequired: u.twoFactorRequired,
      status: u.status,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      canManage: canManageUser(
        actorRoles,
        u.roles.map((r) => r.role),
      ),
    }));
  });
}

// ---------------------------------------------------------------------------
// 取引先タブ — Relationship で接続された取引先テナントのシステムユーザー
// ---------------------------------------------------------------------------

export interface DealerMemberListItem extends MemberListItem {
  /** 所属取引先（Tenant.name）。 */
  dealerName: string;
  dealerId: string;
}

/**
 * 自卸業者と Relationship で繋がっている取引先の User を返す。
 *
 * User の RLS は `tenantId = current_setting('app.current_tenant_id')` なので、
 * 卸業者セッションのままでは取引先 User を読めない。ここを解くために RLS を
 * 緩めると「卸業者なら全ての DEALER User を読める」ことになり、他卸業者配下の
 * 取引先まで見えてしまう。そこで RLS には触れず、rawPrisma を使いつつ
 * 対象範囲をアプリ側で厳密に閉じる:
 *
 *   1. 権限は member.read（assertCan）＋ WHOLESALER_ADMIN のみ
 *   2. wholesalerId はセッション由来の値だけを使う（クライアントから受け取らない）
 *   3. その wholesalerId の Relationship から dealerId 集合をサーバで解決し、
 *      その集合に含まれる tenantId の User だけを取得する
 *   4. 論理削除済み（TERMINATED）の取引先は除く
 *
 * 結果として、他 Wholesaler 配下の取引先 User には到達できない。
 */
export async function listDealerMembers(): Promise<DealerMemberListItem[]> {
  const { ctx, session } = await requireCtx();

  // 取引先のアカウント一覧は卸業者の管理者だけが見る。
  const roles = session.user.roles;
  if (!ctx.isSaasAdmin && !roles.includes("WHOLESALER_ADMIN")) {
    return [];
  }
  const wholesalerId = ctx.wholesalerId;
  if (!wholesalerId) return [];

  // 対象の取引先テナントは自テナントの Relationship からだけ導く。
  const dealerIds = await withTenant(ctx, async (tx) => {
    const rels = await tx.relationship.findMany({
      where: { wholesalerId, status: { not: "TERMINATED" } },
      select: { dealerId: true },
    });
    return rels.map((r) => r.dealerId);
  });
  if (dealerIds.length === 0) return [];

  const { rawPrisma } = await import("@solar/db");
  const users = await rawPrisma.user.findMany({
    where: { tenantId: { in: dealerIds }, status: { not: "DELETED" } },
    orderBy: [{ tenantId: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      twoFactorRequired: true,
      status: true,
      lastLoginAt: true,
      tenantId: true,
      roles: { select: { role: true } },
      tenant: { select: { name: true } },
    },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    roles: u.roles.map((r) => r.role),
    twoFactorRequired: u.twoFactorRequired,
    status: u.status,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    // 取引先のアカウントはこの画面では常に閲覧のみ（既存仕様を維持）。
    canManage: false,
    dealerId: u.tenantId,
    dealerName: u.tenant.name,
  }));
}
