"use server";

// Server Action: invite a user to the wholesaler tenant (F-006).
// Creates a UserInvitation row via `issueUserInvitation` from @solar/auth,
// then enqueues an invite email. Guard: withServerActionContext(member.read
// is not sufficient — we need the invite action key).

import { issueUserInvitation } from "@solar/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ValidationError } from "@/lib/errors";
import { withServerActionContext } from "@/lib/tenancy/server-action";

const LIST_PATH = "/members";

// 新規付与できるのは正式仕様の 3 ロールだけ。旧ロールは既存行のために
// enum には残っているが、ここからは指定できない。
const InviteWholesalerMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["OWNER", "SYSTEM_ADMIN", "GENERAL_USER"]),
});

export type InviteWholesalerMemberInput = z.infer<typeof InviteWholesalerMemberSchema>;

export interface InviteWholesalerMemberResult {
  invitationId: string;
}

export const inviteWholesalerMemberAction = withServerActionContext<
  InviteWholesalerMemberInput,
  InviteWholesalerMemberResult
>(
  {
    action: "user.invite_wholesaler_member",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ ctx, input }) => {
    if (!ctx.tenantId) {
      throw new ValidationError("tenantId is required for member invitation");
    }
    const parsed = InviteWholesalerMemberSchema.parse(input);

    const { invitationId } = await issueUserInvitation({
      tenantId: ctx.tenantId,
      email: parsed.email,
      role: parsed.role,
      invitedBy: ctx.actorUserId,
    });

    revalidatePath(LIST_PATH);
    return { invitationId };
  },
);

// ---------------------------------------------------------------------------
// システムユーザーの更新 / 削除（論理削除）
// ---------------------------------------------------------------------------
//
// ここで扱うのは User（ログインアカウント）だけ。スタッフ（Salesperson）には
// 一切触れない — 両者は別物として管理し、片方の操作でもう片方を作ったり
// 消したりしない。

const WHOLESALER_ROLES = ["OWNER", "SYSTEM_ADMIN", "GENERAL_USER"] as const;

const UpdateMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(WHOLESALER_ROLES).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
});

export type UpdateMemberInput = z.infer<typeof UpdateMemberSchema>;

export const updateWholesalerMemberAction = withServerActionContext<
  UpdateMemberInput,
  { id: string }
>(
  {
    action: "user.update",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ tx, input }) => {
    const parsed = UpdateMemberSchema.parse(input);

    // withTenant 経由なので、他テナントの User はそもそも見えない。
    const existing = await tx.user.findUnique({ where: { id: parsed.id }, select: { id: true } });
    if (!existing) throw new ValidationError("ユーザーが見つかりません");

    if (parsed.name !== undefined || parsed.status !== undefined) {
      await tx.user.update({
        where: { id: parsed.id },
        data: {
          ...(parsed.name !== undefined ? { name: parsed.name } : {}),
          ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        },
      });
    }

    // ロールは 1 人 1 ロール運用なので、貼り替えで表現する。
    if (parsed.role !== undefined) {
      await tx.userRole.deleteMany({ where: { userId: parsed.id } });
      await tx.userRole.create({ data: { userId: parsed.id, role: parsed.role } });
    }

    revalidatePath(LIST_PATH);
    return { id: parsed.id };
  },
);

/**
 * システムユーザーの削除（論理削除）。
 *
 * 物理 DELETE はしない。User は AuditLog.actorUserId や顧客の担当履歴から
 * 参照されており、行を消すと履歴が壊れるため。status = DELETED にして
 * 通常一覧から外し、ログインもできない状態にする。
 * Salesperson には影響しない。
 */
const DeleteMemberSchema = z.object({ id: z.string().min(1) });

export type DeleteMemberInput = z.infer<typeof DeleteMemberSchema>;

export const deleteWholesalerMemberAction = withServerActionContext<
  DeleteMemberInput,
  { id: string }
>(
  {
    action: "user.update",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ ctx, tx, input }) => {
    const parsed = DeleteMemberSchema.parse(input);

    if (parsed.id === ctx.actorUserId) {
      throw new ValidationError("自分自身は削除できません");
    }

    const existing = await tx.user.findUnique({ where: { id: parsed.id }, select: { id: true } });
    if (!existing) throw new ValidationError("ユーザーが見つかりません");

    await tx.user.update({ where: { id: parsed.id }, data: { status: "DELETED" } });

    revalidatePath(LIST_PATH);
    return { id: parsed.id };
  },
);
