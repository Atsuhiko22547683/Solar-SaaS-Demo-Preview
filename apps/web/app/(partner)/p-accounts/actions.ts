"use server";

// 二次店ポータル：利用者アカウントの招待・更新（二次店管理者のみ）。
//
// 変えられるのは 3 つだけ。
//   - 利用状況（ACTIVE / SUSPENDED）＝ ログイン利用の開始・停止
//   - 利用区分（DEALER_ADMIN / DEALER_STAFF）
//   - 販売員との紐付け（Salesperson.userId）
// 氏名・メールアドレス・所属テナントは変更できない（招待時に決まる）。
//
// 守る条件（どれもサーバー側で確認する。画面の disabled は案内でしかない）:
//   1. 対象は同じテナントの利用者で、二次店ロールしか持たないこと。
//      代理店・SaaS 運営者のロールを持つ User は対象外（値域が違う）。
//   2. 自分自身の利用区分・利用状況は変えられない（自分で自分を締め出さない）。
//      招待済み（未ログイン）の利用状況も変えられない（招待の受け入れで ACTIVE になる）。
//   3. 利用中の管理者が 0 人になる操作はできない。
//   4. 紐付ける販売員は自社のもので、他の利用者に紐付いていないこと。
//
// 所属二次店は User.tenantId で決まり、この画面からは変更できない。
// 別の二次店へ移す操作は現行モデルでは（テナントをまたぐため）扱わない。

import { issueUserInvitation } from "@solar/auth";
import {
  PartnerAccountInviteSchema,
  PartnerAccountUpdateSchema,
  type PartnerAccountInviteInput,
  type PartnerAccountUpdateInput,
} from "@solar/contracts";
import { revalidatePath } from "next/cache";

import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext } from "@/lib/partner/context";
import { inviteUrlFor } from "@/lib/site-urls";
import { withTenant } from "@/lib/tenancy/with-tenant";

import { countOtherActiveAdmins } from "./data";

import type { AppRole } from "@solar/db";

const LIST_PATH = "/p-accounts";
const g = labels.partner.account.guards;

const DEALER_ROLES: AppRole[] = ["DEALER_ADMIN", "DEALER_STAFF"];

export interface InvitePartnerAccountResult {
  invitationId: string;
  /**
   * 招待リンク。招待する利用区分のサイトを指す
   * （スタッフ招待 → スタッフサイト、管理者招待 → 管理者サイト）。
   * 操作した管理者サイトの URL をそのまま使い回さない。
   */
  inviteUrl: string;
}

export async function invitePartnerAccountAction(
  input: PartnerAccountInviteInput,
): Promise<InvitePartnerAccountResult> {
  const partner = await requirePartnerContext("partner_user.write");
  const parsed = PartnerAccountInviteSchema.parse(input);

  // 所属テナントはサーバー側で決める。招待メールの宛先だけがフォーム由来。
  const { invitationId, token } = await issueUserInvitation({
    tenantId: partner.tenantId,
    email: parsed.email,
    role: parsed.role,
    invitedBy: partner.userId,
  });

  // メール送信は行わない（外部送信なし）。リンクは画面に出して管理者に渡させる。
  const inviteUrl = inviteUrlFor(parsed.role, token);

  revalidatePath(LIST_PATH);
  return { invitationId, inviteUrl };
}

export async function updatePartnerAccountAction(
  input: PartnerAccountUpdateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_user.write");
  const parsed = PartnerAccountUpdateSchema.parse(input);

  return withTenant(partner.ctx, async (tx) => {
    const target = await tx.user.findFirst({
      where: { id: parsed.id, tenantId: partner.tenantId },
      select: {
        id: true,
        status: true,
        roles: { select: { role: true } },
        salesperson: { select: { id: true } },
      },
    });
    if (!target) throw new NotFoundError(labels.partner.errors.notFound);

    // 二次店ロール以外を持つ利用者は、この画面からは触れない。
    const hasForeignRole = target.roles.some((r) => !DEALER_ROLES.includes(r.role));
    if (hasForeignRole || target.roles.length === 0) {
      throw new ForbiddenError(g.notDealerUser, { userId: target.id });
    }

    const wasAdmin = target.roles.some((r) => r.role === "DEALER_ADMIN");
    const changesRole =
      parsed.role !== undefined && parsed.role !== (wasAdmin ? "DEALER_ADMIN" : "DEALER_STAFF");
    const changesStatus = parsed.status !== undefined && parsed.status !== target.status;

    // 招待済み（未ログイン）の利用状況は、本人が招待を受け入れるまで変えられない。
    // ここで ACTIVE にしてもパスワード未設定でサインインできず、状態だけがずれる。
    if (target.status === "INVITED" && parsed.status !== undefined) {
      throw new ValidationError(g.invited);
    }

    // 自分自身の利用区分・利用状況は変えられない（紐付けの変更だけは許す）。
    if (target.id === partner.userId && (changesRole || changesStatus)) {
      throw new ForbiddenError(g.self, { userId: target.id });
    }

    // 利用中の管理者が 0 人になる操作を止める。
    const losesAdmin =
      wasAdmin && (changesRole || (changesStatus && parsed.status === "SUSPENDED"));
    if (losesAdmin) {
      const others = await countOtherActiveAdmins(tx, partner.tenantId, target.id);
      if (others === 0) throw new ValidationError(g.lastAdmin);
    }

    // 利用区分・利用状況を変えたら、発行済みのセッションを無効にする。
    //
    // 停止（SUSPENDED）は auth の jwt コールバックが status を見て弾くが、
    // 利用区分の変更は「明示的な update トリガ」でしか JWT に反映されない。
    // sessionVersion を進めると次のリクエストで JWT が破棄され、ログインし直した
    // 時点の権限で動く（packages/auth/src/config.ts の再検証パス）。
    const forcesReauth = changesStatus || changesRole;
    if (forcesReauth) {
      await tx.user.update({
        where: { id: target.id },
        data: {
          ...(changesStatus ? { status: parsed.status } : {}),
          sessionVersion: { increment: 1 },
        },
      });
    }

    // 1 人 1 ロール運用なので、貼り替えで表現する（代理店側 members と同じ）。
    if (changesRole) {
      await tx.userRole.deleteMany({ where: { userId: target.id } });
      await tx.userRole.create({ data: { userId: target.id, role: parsed.role! } });
    }

    // 販売員との紐付け。undefined は「変更しない」、null は「解除」。
    if (parsed.salespersonId !== undefined) {
      if (parsed.salespersonId === null) {
        if (target.salesperson) {
          await tx.salesperson.update({
            where: { id: target.salesperson.id },
            data: { userId: null },
          });
        }
      } else {
        const sp = await tx.salesperson.findFirst({
          where: { id: parsed.salespersonId, relationshipId: { in: partner.relationshipIds } },
          select: { id: true, userId: true },
        });
        if (!sp) throw new NotFoundError(labels.partner.errors.notFound);
        if (sp.userId && sp.userId !== target.id) {
          throw new ValidationError(g.salespersonTaken);
        }
        // 既存の紐付けを外してから張り直す（userId は @unique）。
        if (target.salesperson && target.salesperson.id !== sp.id) {
          await tx.salesperson.update({
            where: { id: target.salesperson.id },
            data: { userId: null },
          });
        }
        await tx.salesperson.update({ where: { id: sp.id }, data: { userId: target.id } });
      }
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${target.id}`);
    return { id: target.id };
  });
}
