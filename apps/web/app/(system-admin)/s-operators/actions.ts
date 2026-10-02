"use server";

// 運営者管理の更新（運営者のみ）。
//
// 運営権限（SAAS_ADMIN ロール）の付与・解除はこの画面だけで行う。
// 利用者管理の「利用区分変更」は SAAS_ADMIN を触らないようにしてある。
//
// 最後の有効な運営管理者を失う操作は拒否する。判定と更新は同じトランザクションの
// 中で行い、同時に 2 人を解除して 0 人になる事故を防ぐ。

import { issueUserInvitation } from "@solar/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordAudit } from "@/lib/audit/audit-service";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { labels } from "@/lib/i18n/labels";
import { siteBaseUrl } from "@/lib/site-urls";
import { requestMeta, requireSystemAdmin } from "@/lib/system-admin/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { TxClient } from "@solar/db";

const t = labels.systemAdmin.operators;
const BASE = "/s-operators";

const UserIdSchema = z.object({ id: z.string().min(1) });
const StatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});
const InviteSchema = z.object({
  tenantId: z.string().min(1),
  email: z.string().trim().min(1).email(labels.systemAdmin.user.errors.emailRequired),
});

/**
 * 「この利用者を無効化したら、有効な運営管理者が 0 人になるか」を確かめる。
 *
 * 有効＝利用中の利用者 かつ 所属会社も利用中 かつ 運営権限あり。
 */
async function assertNotLastOperator(tx: TxClient, userId: string): Promise<void> {
  const operators = await tx.user.findMany({
    where: { roles: { some: { role: "SAAS_ADMIN" } }, status: "ACTIVE" },
    select: { id: true, tenant: { select: { status: true } } },
  });
  const effective = operators.filter((u) => u.tenant.status === "ACTIVE");
  const remaining = effective.filter((u) => u.id !== userId);
  if (effective.some((u) => u.id === userId) && remaining.length === 0) {
    throw new ConflictError(t.errors.lastOperator);
  }
}

/** 運営権限の付与。 */
export async function grantOperatorAction(
  input: z.input<typeof UserIdSchema>,
): Promise<{ id: string }> {
  const op = await requireSystemAdmin("system_admin.operator.write");
  const parsed = UserIdSchema.parse(input);
  const meta = await requestMeta();

  await withTenant(op.ctx, async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: parsed.id },
      select: { id: true, tenantId: true, sessionVersion: true, roles: { select: { role: true } } },
    });
    if (!user) throw new NotFoundError(labels.systemAdmin.user.errors.notFound);
    if (user.roles.some((r) => r.role === "SAAS_ADMIN")) return;

    await tx.userRole.create({ data: { userId: user.id, role: "SAAS_ADMIN" } });
    // 権限が変わったら、古い権限のままのセッションを残さない。
    await tx.user.update({
      where: { id: user.id },
      data: { sessionVersion: user.sessionVersion + 1 },
    });

    await recordAudit(tx, {
      actorUserId: op.actorUserId,
      tenantId: user.tenantId,
      targetType: "UserRole",
      targetId: user.id,
      action: "ROLE_CHANGE",
      before: { operator: false },
      after: { operator: true },
      ...meta,
    });
  });

  revalidatePath(BASE);
  return { id: parsed.id };
}

/** 運営権限の解除。最後の有効な運営管理者は解除できない。 */
export async function revokeOperatorAction(
  input: z.input<typeof UserIdSchema>,
): Promise<{ id: string }> {
  const op = await requireSystemAdmin("system_admin.operator.write");
  const parsed = UserIdSchema.parse(input);
  const meta = await requestMeta();

  await withTenant(op.ctx, async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: parsed.id },
      select: { id: true, tenantId: true, sessionVersion: true, roles: { select: { role: true } } },
    });
    if (!user) throw new NotFoundError(t.errors.notFound);
    if (!user.roles.some((r) => r.role === "SAAS_ADMIN")) {
      throw new ValidationError(t.errors.notOperator, { field: "id" });
    }

    await assertNotLastOperator(tx, user.id);

    await tx.userRole.deleteMany({ where: { userId: user.id, role: "SAAS_ADMIN" } });
    await tx.user.update({
      where: { id: user.id },
      data: { sessionVersion: user.sessionVersion + 1 },
    });

    await recordAudit(tx, {
      actorUserId: op.actorUserId,
      tenantId: user.tenantId,
      targetType: "UserRole",
      targetId: user.id,
      action: "ROLE_CHANGE",
      before: { operator: true },
      after: { operator: false },
      ...meta,
    });
  });

  revalidatePath(BASE);
  return { id: parsed.id };
}

/** 運営者の利用停止・再開。停止で最後の運営管理者を失う場合は拒否する。 */
export async function setOperatorStatusAction(
  input: z.input<typeof StatusSchema>,
): Promise<{ id: string; status: string }> {
  const op = await requireSystemAdmin("system_admin.operator.write");
  const parsed = StatusSchema.parse(input);
  const meta = await requestMeta();

  const result = await withTenant(op.ctx, async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: parsed.id },
      select: {
        id: true,
        tenantId: true,
        status: true,
        sessionVersion: true,
        roles: { select: { role: true } },
      },
    });
    if (!user) throw new NotFoundError(t.errors.notFound);
    if (!user.roles.some((r) => r.role === "SAAS_ADMIN")) {
      throw new ValidationError(t.errors.notOperator, { field: "id" });
    }
    if (user.status === parsed.status) return { id: user.id, status: user.status };

    if (parsed.status === "SUSPENDED") await assertNotLastOperator(tx, user.id);

    const after = await tx.user.update({
      where: { id: user.id },
      data: {
        status: parsed.status,
        ...(parsed.status === "SUSPENDED" ? { sessionVersion: user.sessionVersion + 1 } : {}),
      },
      select: { id: true, status: true },
    });

    await recordAudit(tx, {
      actorUserId: op.actorUserId,
      tenantId: user.tenantId,
      targetType: "User",
      targetId: user.id,
      action: "STATUS_CHANGE",
      before: { status: user.status, operator: true },
      after: { status: after.status, operator: true },
      ...meta,
    });
    return { id: after.id, status: after.status };
  });

  revalidatePath(BASE);
  return result;
}

/** 運営者の招待。受諾後に運営権限が付く。 */
export async function inviteOperatorAction(
  input: z.input<typeof InviteSchema>,
): Promise<{ invitationId: string; inviteUrl: string; expiresAt: string }> {
  const op = await requireSystemAdmin("system_admin.operator.write");
  const parsed = InviteSchema.parse(input);
  const meta = await requestMeta();
  const email = parsed.email.trim().toLowerCase();

  await withTenant(op.ctx, async (tx) => {
    const exists = await tx.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) throw new ConflictError(labels.systemAdmin.user.errors.emailTaken);
  });

  const issued = await issueUserInvitation({
    tenantId: parsed.tenantId,
    email,
    role: "SAAS_ADMIN",
    invitedBy: op.actorUserId,
  });

  await withTenant(op.ctx, async (tx) => {
    await recordAudit(tx, {
      actorUserId: op.actorUserId,
      tenantId: parsed.tenantId,
      targetType: "UserInvitation",
      targetId: issued.invitationId,
      action: "CREATE",
      // トークンは記録しない。
      after: { email, role: "SAAS_ADMIN" },
      ...meta,
    });
  });

  revalidatePath(BASE);
  return {
    invitationId: issued.invitationId,
    // 運営者は運営管理サイトで受諾する。
    inviteUrl: `${siteBaseUrl("system-admin")}/invite/${issued.token}`,
    expiresAt: issued.expiresAt.toISOString(),
  };
}
