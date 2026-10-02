"use server";

// 催事の開催日（EventDay）の登録・更新・削除。代理店の操作。
//
// 1 催事 = 1 日とは限らないので、開催日を行として持つ。開催時間は日ごとに違いうるので
// 日単位で持ち、パートナー側のシフト配置で「予定時間の初期値」に使う。
//
// 時間が決まっていない日は開始・終了を空のまま登録する（架空の時間で埋めない）。
// 画面では「開催時間未設定」と出て、配置時に管理者が入力する。

import {
  EventDayDeleteSchema,
  EventDayUpsertSchema,
  type EventDayDeleteInput,
  type EventDayUpsertInput,
} from "@solar/contracts";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { NotFoundError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { TenantContext } from "@solar/db";

async function requireShiftManageContext(): Promise<TenantContext> {
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
    action: "event.manage_shift",
  });
  return ctx;
}

/**
 * ローカル暦日 + 'HH:MM' を Date にする。
 * 開催日そのものは暦日として 00:00 で保持する（既存 scheduledDate と同じ方式）。
 */
function atTime(dateStr: string, time: string | undefined): Date | null {
  if (!time) return null;
  return new Date(`${dateStr}T${time}:00`);
}

export async function upsertEventDayAction(input: EventDayUpsertInput): Promise<{ id: string }> {
  const ctx = await requireShiftManageContext();
  const parsed = EventDayUpsertSchema.parse(input);

  return withTenant(ctx, async (tx) => {
    // 自社の催事であることを確認する（送信された eventId をそのまま使わない）。
    const event = await tx.event.findFirst({
      where: { id: parsed.eventId, wholesalerId: ctx.wholesalerId },
      select: { id: true },
    });
    if (!event) throw new NotFoundError("対象の催事が見つかりません");

    // 暦日は UTC 0 時で持つ（EventCandidate.scheduledDate と同じ方針）。
    const eventDate = new Date(`${parsed.eventDate}T00:00:00.000Z`);
    if (Number.isNaN(eventDate.getTime())) {
      throw new ValidationError("開催日の形式が正しくありません");
    }

    const row = await tx.eventDay.upsert({
      where: { eventId_eventDate: { eventId: event.id, eventDate } },
      create: {
        eventId: event.id,
        eventDate,
        startAt: atTime(parsed.eventDate, parsed.startTime),
        endAt: atTime(parsed.eventDate, parsed.endTime),
        note: parsed.note ?? null,
      },
      update: {
        startAt: atTime(parsed.eventDate, parsed.startTime),
        endAt: atTime(parsed.eventDate, parsed.endTime),
        note: parsed.note ?? null,
      },
      select: { id: true },
    });

    revalidatePath(`/events/${event.id}/days`);
    revalidatePath(`/events/${event.id}/shifts`);
    return row;
  });
}

export async function deleteEventDayAction(input: EventDayDeleteInput): Promise<{ ok: true }> {
  const ctx = await requireShiftManageContext();
  const parsed = EventDayDeleteSchema.parse(input);

  await withTenant(ctx, async (tx) => {
    const day = await tx.eventDay.findFirst({
      where: { id: parsed.eventDayId, event: { wholesalerId: ctx.wholesalerId } },
      select: { id: true, eventId: true, _count: { select: { shifts: true } } },
    });
    if (!day) throw new NotFoundError("対象の開催日が見つかりません");
    // 配置済みのシフトがある日は消させない（配置ごと消えてしまうため）。
    if (day._count.shifts > 0) {
      throw new ValidationError(
        "この開催日にはシフトが配置されています。先に配置を取り消してください",
      );
    }
    await tx.eventDay.delete({ where: { id: day.id } });
    revalidatePath(`/events/${day.eventId}/days`);
  });

  return { ok: true };
}
