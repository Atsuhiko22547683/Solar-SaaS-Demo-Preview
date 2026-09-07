"use server";

// スタッフ（販売員）マスタ Server Actions（設定配下「スタッフ一覧」）。
//
// installer / venue-providers と同じ三段ガード（auth → assertCan → withTenant）を
// `withServerActionContext` で適用。wholesalerId はテナント文脈から注入され、
// 入力で渡されることは無い（クロステナント操作を防ぐ）。
//
// 物理削除は行わない（過去のイベントアサインから参照されるため）。無効化は
// isActive=false のフリップで表現する — installer と同じ運用。

import {
  EventSalespeopleAssignSchema,
  SalespersonInputSchema,
  SalespersonUpdateSchema,
  type EventSalespeopleAssignInput,
  type SalespersonInput,
  type SalespersonUpdate,
} from "@solar/contracts";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { NotFoundError, ValidationError } from "@/lib/errors";
import { withServerActionContext } from "@/lib/tenancy/server-action";

import type { TxClient } from "@/lib/tenancy/with-tenant";

const LIST_PATH = "/salespeople";

/** "YYYY-MM-DD"（または ISO）→ Date。空文字・null は null（未設定へ戻す）。 */
function toDateOrNull(v: string | null | undefined): Date | null {
  return v ? new Date(v) : null;
}

/** 自由記述の trim。空文字は null（未設定）へ寄せる。 */
function trimOrNull(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * 所属二次店 ID を検証して返す。null はそのまま（= 自社スタッフ）。
 *
 * findUnique は withTenant スコープ内なので、他テナントの Relationship は
 * RLS で見えず null になる → NotFound として弾かれる。
 */
async function resolveRelationshipId(
  tx: TxClient,
  relationshipId: string | null,
): Promise<string | null> {
  if (!relationshipId) return null;
  const row = await tx.relationship.findUnique({
    where: { id: relationshipId },
    select: { id: true },
  });
  if (!row) throw new NotFoundError("二次店が見つかりません");
  return row.id;
}

/**
 * リンク先の自社ログイン User を検証して返す。
 *
 * - null はリンク解除。
 * - 二次店スタッフには User を紐付けない（卸業者は RLS で二次店の User を参照
 *   できず、自テナントの User を二次店スタッフに紐付けるのは誤リンクになる）。
 * - 1 User = 最大 1 スタッフ（DB の unique と揃えて、先に業務エラーで返す）。
 */
async function resolveUserId(
  tx: TxClient,
  userId: string | null,
  relationshipId: string | null,
  selfSalespersonId?: string,
): Promise<string | null> {
  if (!userId) return null;
  if (relationshipId) {
    throw new ValidationError("二次店スタッフにはログインユーザーを紐付けられません");
  }
  const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new NotFoundError("ユーザーが見つかりません");

  const taken = await tx.salesperson.findFirst({
    where: { userId, ...(selfSalespersonId ? { id: { not: selfSalespersonId } } : {}) },
    select: { id: true },
  });
  if (taken) throw new ValidationError("このユーザーは既に別のスタッフへ紐付いています");
  return user.id;
}

export interface SalespersonMutationResult {
  id: string;
}

export const createSalespersonAction = withServerActionContext<
  SalespersonInput,
  SalespersonMutationResult
>(
  {
    action: "salesperson.create",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ tx, ctx, input }) => {
    if (!ctx.wholesalerId) {
      throw new ValidationError("wholesalerId is required for salesperson master");
    }
    const parsed = SalespersonInputSchema.parse(input);

    // 所属二次店 / リンク先 User は自テナントのものだけ受け付ける。
    // 別テナントの ID は RLS で findUnique が null を返すため、ここで NotFound になる。
    const relationshipId = await resolveRelationshipId(tx, parsed.relationshipId ?? null);
    const userId = await resolveUserId(tx, parsed.userId ?? null, relationshipId);

    const created = await tx.salesperson.create({
      data: {
        wholesalerId: ctx.wholesalerId,
        relationshipId,
        userId,
        name: parsed.name.trim(),
        kana: trimOrNull(parsed.kana) ?? null,
        gender: parsed.gender ?? null,
        // 生年月日は任意。未入力は必ず null（空文字やダミー日付を保存しない）。
        birthDate: toDateOrNull(parsed.birthDate),
        phone: trimOrNull(parsed.phone) ?? null,
        email: trimOrNull(parsed.email) ?? null,
        address: trimOrNull(parsed.address) ?? null,
        employmentType: parsed.employmentType ?? null,
        note: trimOrNull(parsed.note) ?? null,
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
      },
      select: { id: true },
    });

    revalidatePath(LIST_PATH);
    return { id: created.id };
  },
);

export interface UpdateSalespersonInput extends SalespersonUpdate {
  id: string;
}

export const updateSalespersonAction = withServerActionContext<
  UpdateSalespersonInput,
  SalespersonMutationResult
>({ action: "salesperson.update" }, async ({ tx, input }) => {
  const { id, ...rest } = input;
  if (!id) throw new ValidationError("id is required");
  const parsed = SalespersonUpdateSchema.parse(rest);

  // withTenant スコープ内で存在確認する（別テナントの行は RLS で見えない）。
  const existing = await tx.salesperson.findUnique({
    where: { id },
    select: { id: true, relationshipId: true },
  });
  if (!existing) throw new NotFoundError("スタッフが見つかりません");

  const nextRelationshipId =
    parsed.relationshipId !== undefined
      ? await resolveRelationshipId(tx, parsed.relationshipId)
      : existing.relationshipId;
  const nextUserId =
    parsed.userId !== undefined
      ? await resolveUserId(tx, parsed.userId, nextRelationshipId, id)
      : undefined;

  await tx.salesperson.update({
    where: { id },
    data: {
      ...(parsed.name !== undefined ? { name: parsed.name.trim() } : {}),
      ...(parsed.kana !== undefined ? { kana: trimOrNull(parsed.kana) } : {}),
      ...(parsed.relationshipId !== undefined ? { relationshipId: nextRelationshipId } : {}),
      ...(nextUserId !== undefined ? { userId: nextUserId } : {}),
      ...(parsed.gender !== undefined ? { gender: parsed.gender } : {}),
      ...(parsed.birthDate !== undefined ? { birthDate: toDateOrNull(parsed.birthDate) } : {}),
      ...(parsed.phone !== undefined ? { phone: trimOrNull(parsed.phone) } : {}),
      ...(parsed.email !== undefined ? { email: trimOrNull(parsed.email) } : {}),
      ...(parsed.address !== undefined ? { address: trimOrNull(parsed.address) } : {}),
      ...(parsed.employmentType !== undefined ? { employmentType: parsed.employmentType } : {}),
      ...(parsed.note !== undefined ? { note: trimOrNull(parsed.note) } : {}),
      ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
    },
    select: { id: true },
  });

  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
  return { id };
});

/**
 * イベントへの販売員アサイン（差し替え方式）。
 * 渡された salespersonIds が最終状態になる（含まれないものは外れる）。
 * EventShift（認証 User の勤務シフト）には一切触れない。
 */
export const assignEventSalespeopleAction = withServerActionContext<
  EventSalespeopleAssignInput,
  { eventId: string; assigned: number }
>({ action: "salesperson.update" }, async ({ tx, input }) => {
  const parsed = EventSalespeopleAssignSchema.parse(input);

  // withTenant スコープ内で対象イベントの存在を確認（別テナントは RLS で見えない）。
  const event = await tx.event.findUnique({ where: { id: parsed.eventId }, select: { id: true } });
  if (!event) throw new NotFoundError("イベントが見つかりません");

  const ids = [...new Set(parsed.salespersonIds)];
  if (ids.length > 0) {
    // 同テナントの販売員だけを受け付ける（RLS 下の findMany で絞り込む）。
    const valid = await tx.salesperson.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (valid.length !== ids.length) {
      throw new ValidationError("指定された販売員の一部が見つかりません");
    }
  }

  await tx.eventSalesperson.deleteMany({
    where: {
      eventId: parsed.eventId,
      ...(ids.length > 0 ? { salespersonId: { notIn: ids } } : {}),
    },
  });
  for (const salespersonId of ids) {
    await tx.eventSalesperson.upsert({
      where: { eventId_salespersonId: { eventId: parsed.eventId, salespersonId } },
      create: { eventId: parsed.eventId, salespersonId },
      update: {},
    });
  }

  revalidatePath(`/events/${parsed.eventId}`);
  return { eventId: parsed.eventId, assigned: ids.length };
});

// ---------------------------------------------------------------------------
// スタッフの削除（論理削除）
// ---------------------------------------------------------------------------
//
// 物理 DELETE はしない。Salesperson は Customer の担当（tossUpSalespersonId /
// closingSalespersonId）や EventSalesperson から参照されており、行を消すと
// 過去の担当実績が壊れるため。isActive = false にして通常一覧から外すだけにする。
//
// システムユーザー（User）には一切影響しない。スタッフとユーザーは別物として
// 扱うので、ここから User を消したり status を変えたりはしない。

const DeleteSalespersonInputSchema = z.object({ id: z.string().min(1) });

export type DeleteSalespersonInput = z.infer<typeof DeleteSalespersonInputSchema>;

export const deleteSalespersonAction = withServerActionContext<
  DeleteSalespersonInput,
  { id: string }
>(
  {
    action: "salesperson.update",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ tx, input }) => {
    const parsed = DeleteSalespersonInputSchema.parse(input);

    // withTenant 経由なので、他卸業者のスタッフはそもそも見えない。
    const existing = await tx.salesperson.findUnique({
      where: { id: parsed.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundError("スタッフが見つかりません");
    }

    const updated = await tx.salesperson.update({
      where: { id: parsed.id },
      data: { isActive: false },
      select: { id: true },
    });

    revalidatePath("/salespeople");
    return { id: updated.id };
  },
);
