"use server";

// 会社管理の更新（運営者のみ）。
//
// 入口は必ず requireSystemAdmin()。ページに出していない操作でも、Server Action へ
// 直接送られたらここで止まる。
//
// 停止はデータ削除と分ける。Tenant.status を SUSPENDED にするだけで、
// 利用者・取引関係・業務データは消さない。停止の効き目（サインインを止める）は
// 認証側で Tenant.status を見て判定する。
//
// 重要な更新は必ず監査記録を残す（recordAudit）。パスワード・トークンは記録しない。

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { recordAudit } from "@/lib/audit/audit-service";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { labels } from "@/lib/i18n/labels";
import { requestMeta, requireSystemAdmin } from "@/lib/system-admin/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

const t = labels.systemAdmin.company;
const BASE = "/s-companies";

const CreatePartnerSchema = z.object({
  name: z.string().trim().min(1, t.errors.nameRequired).max(255),
  /** 取引先の代理店。前提は代理店 1 社なので通常は 1 つだけ。 */
  wholesalerId: z.string().trim().min(1),
});

const UpdateCompanySchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, t.errors.nameRequired).max(255),
});

const StatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

/** パートナー会社の追加。代理店との取引関係も同時に作る。 */
export async function createPartnerCompanyAction(
  input: z.input<typeof CreatePartnerSchema>,
): Promise<{ id: string }> {
  const op = await requireSystemAdmin("system_admin.company.write");
  const parsed = CreatePartnerSchema.parse(input);
  const meta = await requestMeta();

  const created = await withTenant(op.ctx, async (tx) => {
    const wholesaler = await tx.tenant.findFirst({
      where: { id: parsed.wholesalerId, type: "WHOLESALER" },
      select: { id: true },
    });
    if (!wholesaler) throw new NotFoundError(t.errors.notFound);

    const tenant = await tx.tenant.create({
      data: { type: "DEALER", name: parsed.name, status: "ACTIVE" },
      select: { id: true, name: true, type: true, status: true },
    });
    await tx.relationship.create({
      data: {
        wholesalerId: wholesaler.id,
        dealerId: tenant.id,
        status: "ACTIVE",
        defaultScope: "APPOINTMENT_ONLY",
      },
    });

    await recordAudit(tx, {
      actorUserId: op.actorUserId,
      tenantId: tenant.id,
      targetType: "Tenant",
      targetId: tenant.id,
      action: "CREATE",
      // "name" は redactPii が伏せるキー。会社名は個人情報ではないので別キーで残す。
      after: { companyName: tenant.name, type: tenant.type, status: tenant.status },
      ...meta,
    });
    return tenant;
  });

  revalidatePath(BASE);
  return { id: created.id };
}

/** 基本情報の編集。区分・取引関係は変えない。 */
export async function updateCompanyAction(
  input: z.input<typeof UpdateCompanySchema>,
): Promise<{ id: string }> {
  const op = await requireSystemAdmin("system_admin.company.write");
  const parsed = UpdateCompanySchema.parse(input);
  const meta = await requestMeta();

  await withTenant(op.ctx, async (tx) => {
    const before = await tx.tenant.findUnique({
      where: { id: parsed.id },
      select: { id: true, name: true, type: true, status: true },
    });
    if (!before) throw new NotFoundError(t.errors.notFound);

    const after = await tx.tenant.update({
      where: { id: before.id },
      data: { name: parsed.name },
      select: { id: true, name: true, type: true, status: true },
    });

    await recordAudit(tx, {
      actorUserId: op.actorUserId,
      tenantId: before.id,
      targetType: "Tenant",
      targetId: before.id,
      action: "UPDATE",
      before: { companyName: before.name },
      after: { companyName: after.name },
      ...meta,
    });
  });

  revalidatePath(BASE);
  revalidatePath(`${BASE}/${parsed.id}`);
  return { id: parsed.id };
}

/**
 * 利用停止・再開。
 *
 * データは削除しない。停止するのはその会社だけで、取引関係や他社のテナントには
 * 触らない（他社へ波及させない）。
 */
export async function setCompanyStatusAction(
  input: z.input<typeof StatusSchema>,
): Promise<{ id: string; status: string }> {
  const op = await requireSystemAdmin("system_admin.company.write");
  const parsed = StatusSchema.parse(input);
  const meta = await requestMeta();

  const result = await withTenant(op.ctx, async (tx) => {
    const before = await tx.tenant.findUnique({
      where: { id: parsed.id },
      select: { id: true, name: true, type: true, status: true },
    });
    if (!before) throw new NotFoundError(t.errors.notFound);

    // 代理店本体の停止は影響が大きく、この初期版では扱わない。
    if (before.type === "WHOLESALER" && parsed.status === "SUSPENDED") {
      throw new ValidationError(t.errors.cannotSuspendWholesaler, { field: "id" });
    }
    if (before.status === parsed.status) return { id: before.id, status: before.status };

    const after = await tx.tenant.update({
      where: { id: before.id },
      data: { status: parsed.status },
      select: { id: true, status: true },
    });

    // 停止はサインインを止めるだけでなく、既にサインイン中のセッションも切る。
    // sessionVersion を上げると、既存の JWT は次のリクエストで無効になる。
    // 対象はこの会社の利用者だけで、他社の利用者には触らない。
    let revokedSessions = 0;
    if (parsed.status === "SUSPENDED") {
      const bumped = await tx.$executeRaw`
        UPDATE "User" SET "sessionVersion" = "sessionVersion" + 1 WHERE "tenantId" = ${before.id}
      `;
      revokedSessions = Number(bumped);
    }

    await recordAudit(tx, {
      actorUserId: op.actorUserId,
      tenantId: before.id,
      targetType: "Tenant",
      targetId: before.id,
      action: "STATUS_CHANGE",
      before: { status: before.status },
      after: { status: after.status, revokedSessions },
      ...meta,
    });
    return { id: after.id, status: after.status };
  });

  revalidatePath(BASE);
  revalidatePath(`${BASE}/${parsed.id}`);
  return result;
}
