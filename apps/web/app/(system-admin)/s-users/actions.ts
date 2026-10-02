"use server";

// 利用者管理の更新（運営者のみ）。
//
// 入口は必ず requireSystemAdmin()。既存の仕組み（招待・セッション失効・
// パスワード再設定）をそのまま使い、運営管理サイト用の別経路は作らない。
//
// パスワードそのものは扱わない（表示も保存もしない）。所属会社の異動は用意しない。
// 重要な更新は監査記録を残す。トークンは記録しない（発行した事実だけ残す）。

import { issueUserInvitation, requestPasswordResetAction } from "@solar/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordAudit } from "@/lib/audit/audit-service";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { labels } from "@/lib/i18n/labels";
import { siteBaseUrl } from "@/lib/site-urls";
import { requestMeta, requireSystemAdmin } from "@/lib/system-admin/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { AppRole } from "@solar/db";

const t = labels.systemAdmin.user;
const BASE = "/s-users";

/** 招待・利用区分変更で選べるロール。旧ロールは選択肢にしない。 */
const ASSIGNABLE_ROLES = [
  "OWNER",
  "SYSTEM_ADMIN",
  "GENERAL_USER",
  "DEALER_ADMIN",
  "DEALER_STAFF",
] as const;

const InviteSchema = z.object({
  companyId: z.string().min(1),
  email: z.string().trim().min(1, t.errors.emailRequired).email(t.errors.emailRequired),
  name: z.string().trim().max(255).optional(),
  role: z.enum(ASSIGNABLE_ROLES, { required_error: t.errors.roleRequired }),
});

const UserIdSchema = z.object({ id: z.string().min(1) });

const StatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

const RoleSchema = z.object({
  id: z.string().min(1),
  role: z.enum(ASSIGNABLE_ROLES, { required_error: t.errors.roleRequired }),
});

/**
 * 利用者の招待。
 *
 * 既存の issueUserInvitation を使う。トークンは監査に残さず、画面にだけ 1 度出す。
 */
export async function inviteUserAction(
  input: z.input<typeof InviteSchema>,
): Promise<{ invitationId: string; inviteUrl: string; expiresAt: string }> {
  const op = await requireSystemAdmin("system_admin.user.write");
  const parsed = InviteSchema.parse(input);
  const meta = await requestMeta();

  const email = parsed.email.trim().toLowerCase();

  await withTenant(op.ctx, async (tx) => {
    const company = await tx.tenant.findUnique({
      where: { id: parsed.companyId },
      select: { id: true },
    });
    if (!company) throw new NotFoundError(labels.systemAdmin.company.errors.notFound);
    const exists = await tx.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) throw new ConflictError(t.errors.emailTaken);
  });

  const issued = await issueUserInvitation({
    tenantId: parsed.companyId,
    email,
    role: parsed.role as AppRole,
    invitedBy: op.actorUserId,
  });

  await withTenant(op.ctx, async (tx) => {
    await recordAudit(tx, {
      actorUserId: op.actorUserId,
      tenantId: parsed.companyId,
      targetType: "UserInvitation",
      targetId: issued.invitationId,
      action: "CREATE",
      // トークンは記録しない。誰をどの区分で招待したかだけ残す。
      after: { email, role: parsed.role },
      ...meta,
    });
  });

  revalidatePath(BASE);
  return {
    invitationId: issued.invitationId,
    // 受け取り手が使うサイトの /invite/<token> を指す。
    inviteUrl: `${siteBaseUrl(inviteSiteFor(parsed.role))}/invite/${issued.token}`,
    expiresAt: issued.expiresAt.toISOString(),
  };
}

/** 招待した利用区分に対応するサイト。リンクをそのサイトへ向ける。 */
function inviteSiteFor(role: (typeof ASSIGNABLE_ROLES)[number]) {
  if (role === "DEALER_ADMIN") return "partner-admin" as const;
  if (role === "DEALER_STAFF") return "partner" as const;
  return "agency" as const;
}

/** 利用停止・再開。停止時は既存セッションも失効させる。 */
export async function setUserStatusAction(
  input: z.input<typeof StatusSchema>,
): Promise<{ id: string; status: string }> {
  const op = await requireSystemAdmin("system_admin.user.write");
  const parsed = StatusSchema.parse(input);
  const meta = await requestMeta();

  const result = await withTenant(op.ctx, async (tx) => {
    const before = await tx.user.findUnique({
      where: { id: parsed.id },
      select: { id: true, tenantId: true, status: true, sessionVersion: true },
    });
    if (!before) throw new NotFoundError(t.errors.notFound);
    if (before.status === parsed.status) return { id: before.id, status: before.status };

    const after = await tx.user.update({
      where: { id: before.id },
      data: {
        status: parsed.status,
        // 停止したらサインイン中のセッションも切る。
        ...(parsed.status === "SUSPENDED" ? { sessionVersion: before.sessionVersion + 1 } : {}),
      },
      select: { id: true, status: true },
    });

    await recordAudit(tx, {
      actorUserId: op.actorUserId,
      tenantId: before.tenantId,
      targetType: "User",
      targetId: before.id,
      action: "STATUS_CHANGE",
      before: { status: before.status },
      after: { status: after.status },
      ...meta,
    });
    return { id: after.id, status: after.status };
  });

  revalidatePath(BASE);
  revalidatePath(`${BASE}/${parsed.id}`);
  return result;
}

/** 利用区分（ロール）の変更。 */
export async function setUserRoleAction(
  input: z.input<typeof RoleSchema>,
): Promise<{ id: string }> {
  const op = await requireSystemAdmin("system_admin.user.write");
  const parsed = RoleSchema.parse(input);
  const meta = await requestMeta();

  await withTenant(op.ctx, async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: parsed.id },
      select: { id: true, tenantId: true, sessionVersion: true, roles: { select: { role: true } } },
    });
    if (!user) throw new NotFoundError(t.errors.notFound);

    const before = user.roles.map((r) => r.role as string);
    // 運営権限（SAAS_ADMIN）はこの画面では触らない。付与・解除は運営者管理に集約する。
    const keepSaasAdmin = before.includes("SAAS_ADMIN");

    await tx.userRole.deleteMany({ where: { userId: user.id, role: { not: "SAAS_ADMIN" } } });
    await tx.userRole.create({ data: { userId: user.id, role: parsed.role as AppRole } });
    // 区分が変わったら、古い区分のままのセッションを残さない。
    await tx.user.update({
      where: { id: user.id },
      data: { sessionVersion: user.sessionVersion + 1 },
    });

    await recordAudit(tx, {
      actorUserId: op.actorUserId,
      tenantId: user.tenantId,
      targetType: "User",
      targetId: user.id,
      action: "ROLE_CHANGE",
      before: { roles: before },
      after: { roles: keepSaasAdmin ? ["SAAS_ADMIN", parsed.role] : [parsed.role] },
      ...meta,
    });
  });

  revalidatePath(BASE);
  revalidatePath(`${BASE}/${parsed.id}`);
  return { id: parsed.id };
}

/** サインイン中のセッションを失効させる。 */
export async function revokeUserSessionsAction(
  input: z.input<typeof UserIdSchema>,
): Promise<{ id: string }> {
  const op = await requireSystemAdmin("system_admin.user.write");
  const parsed = UserIdSchema.parse(input);
  const meta = await requestMeta();

  await withTenant(op.ctx, async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: parsed.id },
      select: { id: true, tenantId: true, sessionVersion: true },
    });
    if (!user) throw new NotFoundError(t.errors.notFound);

    await tx.user.update({
      where: { id: user.id },
      data: { sessionVersion: user.sessionVersion + 1 },
    });
    await tx.session.deleteMany({ where: { userId: user.id } });

    await recordAudit(tx, {
      actorUserId: op.actorUserId,
      tenantId: user.tenantId,
      targetType: "User",
      targetId: user.id,
      action: "UPDATE",
      before: { sessionVersion: user.sessionVersion },
      after: { sessionVersion: user.sessionVersion + 1 },
      ...meta,
    });
  });

  revalidatePath(`${BASE}/${parsed.id}`);
  return { id: parsed.id };
}

/**
 * パスワード再設定の案内。
 *
 * パスワードそのものは扱わない（表示も保存もしない）。トークンの発行・ハッシュ化・
 * 通知は既存の requestPasswordResetAction にそのまま任せる
 *（運営管理サイト用に別経路を作ると、検証方式が食い違って動かなくなる）。
 * 宛先が存在しない場合も同じ結果を返す既存の作り（列挙対策）をそのまま使う。
 */
export async function issuePasswordResetAction(
  input: z.input<typeof UserIdSchema>,
): Promise<{ ok: true }> {
  const op = await requireSystemAdmin("system_admin.user.write");
  const parsed = UserIdSchema.parse(input);
  const meta = await requestMeta();

  const target = await withTenant(op.ctx, async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: parsed.id },
      select: { id: true, email: true, tenantId: true },
    });
    if (!user) throw new NotFoundError(t.errors.notFound);
    return user;
  });

  await requestPasswordResetAction({ email: target.email, ip: meta.ip ?? "0.0.0.0" });

  await withTenant(op.ctx, async (tx) => {
    await recordAudit(tx, {
      actorUserId: op.actorUserId,
      tenantId: target.tenantId,
      targetType: "User",
      targetId: target.id,
      action: "UPDATE",
      // トークンは記録しない。運営者が案内を出した事実だけ残す。
      after: { passwordResetRequestedByOperator: true },
      ...meta,
    });
  });

  revalidatePath(`${BASE}/${parsed.id}`);
  return { ok: true };
}
