"use server";

// 代理店側：パートナー会社の出店希望への回答と、場所確保の相談への返信。
//
// 回答は提出（LanePreference）に紐づくスレッドへ積む。提出明細は再提出で入れ替わるが、
// この行は親側にぶら下がるので失われない。汎用のチャットは作らない。
//
// 書き込み対象は必ず「自社（代理店）の取引関係に属する提出 / 相談」であることを
// DB 側で引き直して確認する。RLS 越しに引けない行はそもそも見えない。

import { PartnerThreadPostSchema, type PartnerThreadPostInput } from "@solar/contracts";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

const BASE = "/lane-preferences";

async function requireAnswerContext() {
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
    action: "lane_preference.answer",
  });
  return ctx;
}

/** 出店希望への回答。状態を ANSWERED にし、回答としてスレッドへ残す。 */
export async function answerLanePreferenceAction(
  input: PartnerThreadPostInput,
): Promise<{ ok: true }> {
  const ctx = await requireAnswerContext();
  const parsed = PartnerThreadPostSchema.parse(input);

  await withTenant(ctx, async (tx) => {
    const pref = await tx.lanePreference.findFirst({
      where: { id: parsed.targetId },
      select: { id: true, status: true },
    });
    if (!pref) throw new NotFoundError("対象の提出が見つかりません");

    await tx.lanePreferenceMessage.create({
      data: {
        lanePreferenceId: pref.id,
        side: "WHOLESALER",
        kind: "ANSWER",
        body: parsed.body,
        authorUserId: ctx.actorUserId,
      },
    });

    // 既に確定済みの提出は状態を戻さない（回答の追記だけ）。
    if (pref.status !== "CONFIRMED") {
      await tx.lanePreference.update({ where: { id: pref.id }, data: { status: "ANSWERED" } });
    }
  });

  revalidatePath(BASE);
  revalidatePath(`${BASE}/${parsed.targetId}`);
  return { ok: true };
}

/** 確定の記録。開催場所・日程・担当会社の決定そのものは催事側の操作で行う。 */
export async function markLanePreferenceConfirmedAction(
  input: PartnerThreadPostInput,
): Promise<{ ok: true }> {
  const ctx = await requireAnswerContext();
  const parsed = PartnerThreadPostSchema.parse(input);

  await withTenant(ctx, async (tx) => {
    const pref = await tx.lanePreference.findFirst({
      where: { id: parsed.targetId },
      select: { id: true },
    });
    if (!pref) throw new NotFoundError("対象の提出が見つかりません");

    await tx.lanePreferenceMessage.create({
      data: {
        lanePreferenceId: pref.id,
        side: "WHOLESALER",
        kind: "ANSWER",
        body: parsed.body,
        authorUserId: ctx.actorUserId,
      },
    });
    await tx.lanePreference.update({ where: { id: pref.id }, data: { status: "CONFIRMED" } });
  });

  revalidatePath(BASE);
  revalidatePath(`${BASE}/${parsed.targetId}`);
  return { ok: true };
}

/** 場所確保の相談への返信。 */
export async function replyVenueConsultationAction(
  input: PartnerThreadPostInput,
): Promise<{ ok: true }> {
  const ctx = await requireAnswerContext();
  const parsed = PartnerThreadPostSchema.parse(input);

  await withTenant(ctx, async (tx) => {
    const consultation = await tx.venueConsultation.findFirst({
      where: { id: parsed.targetId },
      select: { id: true, status: true },
    });
    if (!consultation) throw new NotFoundError("対象の相談が見つかりません");

    await tx.venueConsultationMessage.create({
      data: {
        venueConsultationId: consultation.id,
        side: "WHOLESALER",
        kind: "ANSWER",
        body: parsed.body,
        authorUserId: ctx.actorUserId,
      },
    });
    if (consultation.status === "OPEN") {
      await tx.venueConsultation.update({
        where: { id: consultation.id },
        data: { status: "ANSWERED" },
      });
    }
  });

  revalidatePath("/lane-preferences/consultations");
  revalidatePath(`/lane-preferences/consultations/${parsed.targetId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 採用 — 出店希望の明細と、確定したイベントの対応付け
// ---------------------------------------------------------------------------
//
// 「希望を採用した」という代理店の決定を、明細 × イベントの行として残す。
// 提出しただけでは作られない（この操作を通ったときだけ）。開催確定やスタッフ割当を
// ここで自動生成することもしない — イベント側の決定操作はそのまま別に行う。
//
// 1 レーンが複数イベント・複数日程になる場合は、同じ明細に複数行ぶら下がる。

export interface AdoptLanePreferenceItemInput {
  /** 出店希望の明細 id。 */
  itemId: string;
  /** 対応付ける確定イベント id。 */
  eventId: string;
  note?: string;
}

/** 希望明細を確定イベントへ採用として紐付ける。再実行しても重複しない。 */
export async function adoptLanePreferenceItemAction(
  input: AdoptLanePreferenceItemInput,
): Promise<{ ok: true }> {
  const ctx = await requireAnswerContext();
  if (!ctx.wholesalerId) throw new NotFoundError("代理店の文脈が必要です");

  await withTenant(ctx, async (tx) => {
    // 自社から見える明細・イベントであることを引き直して確かめる
    // （ブラウザから来た id をそのまま使わない）。
    const item = await tx.lanePreferenceItem.findFirst({
      where: { id: input.itemId },
      select: { id: true, lanePreferenceId: true },
    });
    if (!item) throw new NotFoundError("対象の希望明細が見つかりません");

    const event = await tx.event.findFirst({
      where: { id: input.eventId },
      select: { id: true },
    });
    if (!event) throw new NotFoundError("対象のイベントが見つかりません");

    await tx.lanePreferenceAdoption.upsert({
      where: {
        lanePreferenceItemId_eventId: { lanePreferenceItemId: item.id, eventId: event.id },
      },
      create: {
        wholesalerId: ctx.wholesalerId!,
        lanePreferenceItemId: item.id,
        eventId: event.id,
        decidedBy: ctx.actorUserId,
        note: input.note ?? null,
      },
      update: { note: input.note ?? null },
    });

    revalidatePath(`${BASE}/${item.lanePreferenceId}`);
    revalidatePath(BASE);
  });

  return { ok: true };
}

/** 採用の取り消し。イベント自体は消さない（開催の決定は別の操作）。 */
export async function withdrawLanePreferenceAdoptionAction(
  input: AdoptLanePreferenceItemInput,
): Promise<{ ok: true }> {
  const ctx = await requireAnswerContext();

  await withTenant(ctx, async (tx) => {
    const item = await tx.lanePreferenceItem.findFirst({
      where: { id: input.itemId },
      select: { id: true, lanePreferenceId: true },
    });
    if (!item) throw new NotFoundError("対象の希望明細が見つかりません");

    await tx.lanePreferenceAdoption.deleteMany({
      where: { lanePreferenceItemId: item.id, eventId: input.eventId },
    });

    revalidatePath(`${BASE}/${item.lanePreferenceId}`);
    revalidatePath(BASE);
  });

  return { ok: true };
}
