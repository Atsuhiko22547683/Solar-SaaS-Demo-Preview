"use server";

// Server Actions for the dealer-relationships master.
//
// 二次店一覧（Tenant.type=DEALER とリレーションシップを張った相手）の
// ステータス（ACTIVE / SUSPENDED）切替と既定スコープの更新。新規 dealer の
// 作成は招待コードフロー (F-009 / SP-03) の責務なのでここでは扱わない。

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { NotFoundError } from "@/lib/errors";
import { withServerActionContext } from "@/lib/tenancy/server-action";

const LIST_PATH = "/masters/relationships";

const StatusSchema = z.enum(["ACTIVE", "SUSPENDED"]);
const ScopeSchema = z.enum(["APPOINTMENT_ONLY", "FIRST_VISIT", "FULL_CLOSING"]);

const UpdateRelationshipInputSchema = z.object({
  id: z.string().min(1),
  franchiseNo: z.string().max(50).optional().nullable(),
  status: StatusSchema.optional(),
  defaultScope: ScopeSchema.optional(),
  note: z.string().max(2000).optional().nullable(),
});

export type UpdateRelationshipInput = z.infer<typeof UpdateRelationshipInputSchema>;

export interface UpdateRelationshipResult {
  id: string;
}

export const updateRelationshipAction = withServerActionContext<
  UpdateRelationshipInput,
  UpdateRelationshipResult
>(
  {
    action: "masters.update",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ tx, input }) => {
    const parsed = UpdateRelationshipInputSchema.parse(input);

    const existing = await tx.relationship.findUnique({
      where: { id: parsed.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundError("取引先との関係が見つかりません");
    }

    const updated = await tx.relationship.update({
      where: { id: parsed.id },
      data: {
        ...("franchiseNo" in parsed
          ? { franchiseNo: parsed.franchiseNo?.trim() ? parsed.franchiseNo.trim() : null }
          : {}),
        ...(parsed.status !== undefined ? { status: parsed.status } : {}),
        ...(parsed.defaultScope !== undefined ? { defaultScope: parsed.defaultScope } : {}),
        ...("note" in parsed ? { note: parsed.note } : {}),
      },
      select: { id: true },
    });

    revalidatePath(LIST_PATH);
    revalidatePath("/masters");
    return { id: updated.id };
  },
);

// ---------------------------------------------------------------------------
// 取引先の追加
// ---------------------------------------------------------------------------
//
// 取引先テナント（Tenant.type = DEALER）と Relationship を 1 トランザクションで
// 作る。Tenant の RLS は WITH CHECK が「自テナントの id」に限定されているため、
// withTenant 経由では他テナント行を作れない。ここは seed / 招待フローと同じ
// 運用例外として rawPrisma を使い、代わりに以下をアプリ側で必ず守る:
//
//   - 権限は masters.update（WHOLESALER_ADMIN のみ）
//   - wholesalerId はセッション由来のものだけを使い、クライアントから受け取らない
//
// 招待コードによる取引先のセルフサインアップ（F-009）とは別に、卸業者側から
// 取引先を登録できるようにするための最小の入口。

const CreateRelationshipInputSchema = z.object({
  dealerName: z.string().trim().min(1).max(120),
  franchiseNo: z.string().max(50).optional().nullable(),
  defaultScope: ScopeSchema.optional(),
  note: z.string().max(2000).optional().nullable(),
});

export type CreateRelationshipInput = z.infer<typeof CreateRelationshipInputSchema>;

export const createRelationshipAction = withServerActionContext<
  CreateRelationshipInput,
  UpdateRelationshipResult
>(
  {
    action: "masters.update",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ ctx, input }) => {
    const parsed = CreateRelationshipInputSchema.parse(input);
    const wholesalerId = ctx.wholesalerId;
    if (!wholesalerId) {
      throw new NotFoundError("卸業者コンテキストが必要です");
    }

    const { rawPrisma } = await import("@solar/db");
    const created = await rawPrisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: parsed.dealerName, type: "DEALER" },
        select: { id: true },
      });
      return tx.relationship.create({
        data: {
          wholesalerId,
          dealerId: tenant.id,
          status: "ACTIVE",
          ...(parsed.defaultScope ? { defaultScope: parsed.defaultScope } : {}),
          franchiseNo: parsed.franchiseNo?.trim() ? parsed.franchiseNo.trim() : null,
          note: parsed.note?.trim() ? parsed.note.trim() : null,
        },
        select: { id: true },
      });
    });

    revalidatePath(LIST_PATH);
    revalidatePath("/masters");
    return { id: created.id };
  },
);

// ---------------------------------------------------------------------------
// 取引先の削除（論理削除）
// ---------------------------------------------------------------------------
//
// 物理 DELETE はしない。Relationship は Customer / Salesperson / Incentive /
// MonthlyReport 等から参照されており、行を消すと過去データの参照先名称が
// 失われるため。status を TERMINATED にして通常の一覧から外すだけにする。

const DeleteRelationshipInputSchema = z.object({ id: z.string().min(1) });

export type DeleteRelationshipInput = z.infer<typeof DeleteRelationshipInputSchema>;

export const deleteRelationshipAction = withServerActionContext<
  DeleteRelationshipInput,
  UpdateRelationshipResult
>(
  {
    action: "masters.update",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ tx, input }) => {
    const parsed = DeleteRelationshipInputSchema.parse(input);

    // withTenant 経由なので、他卸業者の Relationship はそもそも見えない。
    const existing = await tx.relationship.findUnique({
      where: { id: parsed.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundError("取引先との関係が見つかりません");
    }

    const updated = await tx.relationship.update({
      where: { id: parsed.id },
      data: { status: "TERMINATED" },
      select: { id: true },
    });

    revalidatePath(LIST_PATH);
    revalidatePath("/masters");
    return { id: updated.id };
  },
);
