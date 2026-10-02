"use server";

// Store master Server Actions (店舗マスタ).
//
// area と同じ三段ガード (auth → assertCan → withTenant) を
// `withServerActionContext` で適用。wholesalerId はテナント文脈から注入され、
// 入力で渡されることは無い（クロステナント操作を防ぐ）。
//
// 論理停止のみ: `disable` は `isActive=false` をフリップする。店舗は過去の
// EventCandidate から（文字列として）参照されるため、物理削除は行わない。

import {
  StoreInputSchema,
  StoreUpdateSchema,
  type StoreInput,
  type StoreUpdate,
} from "@solar/contracts";
import { revalidatePath } from "next/cache";

import { NotFoundError, ValidationError } from "@/lib/errors";
import { withServerActionContext } from "@/lib/tenancy/server-action";

import type { TxClient } from "@solar/db";

const LIST_PATH = "/masters/stores";

/**
 * 開催エリアに顧客エリアを入れさせない。
 *
 * Area は EVENT / CUSTOMER を type 列で分けた 1 テーブルなので、id だけ渡されると
 * 用途違いのエリアも紐付けられてしまう。画面側では EVENT だけを候補に出すが、
 * サーバーでも type を確かめる。
 */
async function assertEventArea(tx: TxClient, areaId: string | null | undefined): Promise<void> {
  if (!areaId) return;
  const area = await tx.area.findUnique({ where: { id: areaId }, select: { type: true } });
  if (!area) throw new NotFoundError("エリアが見つかりません");
  if (area.type !== "EVENT") {
    throw new ValidationError("開催エリアには、イベント用のエリアを選んでください", {
      field: "areaId",
    });
  }
}

export interface CreateStoreResult {
  id: string;
}

export const createStoreAction = withServerActionContext<StoreInput, CreateStoreResult>(
  {
    action: "store.create",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ tx, ctx, input }) => {
    if (!ctx.wholesalerId) {
      throw new ValidationError("wholesalerId is required for store master");
    }
    const parsed = StoreInputSchema.parse(input);
    await assertEventArea(tx, parsed.areaId);

    const created = await tx.store.create({
      data: {
        wholesalerId: ctx.wholesalerId,
        name: parsed.name,
        ...(parsed.venueProviderId !== undefined
          ? { venueProviderId: parsed.venueProviderId }
          : {}),
        ...(parsed.postalCode !== undefined ? { postalCode: parsed.postalCode } : {}),
        ...(parsed.address !== undefined ? { address: parsed.address } : {}),
        ...(parsed.areaId !== undefined ? { areaId: parsed.areaId } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
      },
      select: { id: true },
    });

    revalidatePath(LIST_PATH);
    return { id: created.id };
  },
);

export interface UpdateStoreInput {
  id: string;
  patch: StoreUpdate;
}

export interface UpdateStoreResult {
  id: string;
}

export const updateStoreAction = withServerActionContext<UpdateStoreInput, UpdateStoreResult>(
  {
    action: "store.update",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ tx, input }) => {
    const parsed = StoreUpdateSchema.parse(input.patch);

    // RLS via withTenant() restricts visibility — a missing row is
    // indistinguishable from a cross-tenant access and surfaces as NotFound.
    const existing = await tx.store.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundError("店舗が見つかりません");
    }
    await assertEventArea(tx, parsed.areaId);

    const updated = await tx.store.update({
      where: { id: input.id },
      data: {
        ...(parsed.name !== undefined ? { name: parsed.name } : {}),
        ...("venueProviderId" in parsed ? { venueProviderId: parsed.venueProviderId } : {}),
        ...("postalCode" in parsed ? { postalCode: parsed.postalCode } : {}),
        ...("address" in parsed ? { address: parsed.address } : {}),
        ...("areaId" in parsed ? { areaId: parsed.areaId } : {}),
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
      },
      select: { id: true },
    });

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${input.id}`);
    return { id: updated.id };
  },
);

export interface DisableStoreInput {
  id: string;
}

export interface DisableStoreResult {
  id: string;
}

export const disableStoreAction = withServerActionContext<DisableStoreInput, DisableStoreResult>(
  {
    action: "store.update",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ tx, input }) => {
    const existing = await tx.store.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundError("店舗が見つかりません");
    }

    const updated = await tx.store.update({
      where: { id: input.id },
      data: { isActive: false },
      select: { id: true },
    });

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${input.id}`);
    return { id: updated.id };
  },
);
