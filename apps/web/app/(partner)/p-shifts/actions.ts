"use server";

// 催事シフトの配置・変更（パートナー管理者）。
//
// 重複の防ぎ方は三重にする:
//   1. 候補表示  … 配置画面で、選んだ時間帯に既に入っているスタッフを選べなくする
//   2. 保存時    … ここで既存シフトと、同じ操作の中で作る区間同士の重複を検証する
//   3. DB 制約   … EventShift_user_no_overlap（EXCLUDE / tsrange 半開区間）
//
// 3 があるので、複数の管理者が同時に同じスタッフを別の催事へ入れようとしても、
// 片方は必ず失敗する（1 と 2 は読み取りと書き込みの間に隙があるため単独では足りない）。
//
// 重複判定は予定時間（startPlanned / endPlanned）だけを見る。実績時間を直しても
// 将来の配置や重複判定は変わらない。
//
// 別の依頼元代理店の催事に入っているスタッフも「その時間は動けない」ので重複相手になる。
// 自社が担当会社の催事は閲覧範囲に入るので、他社案件の中身を読まずに判定できる。

import {
  PartnerShiftActualSchema,
  PartnerShiftAssignSchema,
  PartnerShiftUnassignSchema,
  PartnerShiftUpdateSchema,
  findBulkShiftConflicts,
  findShiftConflicts,
  type PartnerShiftActualInput,
  type PartnerShiftAssignInput,
  type PartnerShiftUnassignInput,
  type PartnerShiftUpdateInput,
} from "@solar/contracts";
import { revalidatePath } from "next/cache";

import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext } from "@/lib/partner/context";
import { resolvePartnerEvent } from "@/lib/partner/events";
import { shiftScope } from "@/lib/partner/scope";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { TxClient } from "@solar/db";

const BASE = "/p-shifts";
const t = labels.partner.shift;

/** Postgres の EXCLUDE 制約違反を、業務の言葉のエラーに直す。 */
function isOverlapConstraintError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("EventShift_user_no_overlap");
}

/** 自社スタッフであることを確認する（他社の userId を配置に使わせない）。 */
async function assertOwnUsers(
  tx: TxClient,
  tenantId: string,
  userIds: readonly string[],
): Promise<void> {
  const unique = Array.from(new Set(userIds));
  const found = await tx.user.findMany({
    where: { id: { in: unique }, tenantId },
    select: { id: true },
  });
  if (found.length !== unique.length) {
    throw new ValidationError("自社に登録されていない利用者が指定されています");
  }
}

export async function assignPartnerShiftsAction(
  input: PartnerShiftAssignInput,
): Promise<{ created: number }> {
  const partner = await requirePartnerContext("partner_shift.write");
  const parsed = PartnerShiftAssignSchema.parse(input);

  return withTenant(partner.ctx, async (tx) => {
    await assertOwnUsers(tx, partner.tenantId, parsed.userIds);

    // 対象の催事・開催日が自社担当であることを 1 件ずつ確認する。
    // 送信された eventId / eventDayId をそのまま書き込みには使わない。
    const targets = [];
    for (const target of parsed.targets) {
      const ref = await resolvePartnerEvent(tx, partner, target.eventId, target.eventDayId ?? null);
      targets.push({ ...target, resolvedDayId: ref.eventDayId });
    }

    // 候補 = 対象 × スタッフ。
    const candidates = targets.flatMap((target) =>
      parsed.userIds.map((userId) => ({
        userId,
        start: target.startPlanned,
        end: target.endPlanned,
        eventId: target.eventId,
        eventDayId: target.resolvedDayId,
      })),
    );

    // 既存の予定シフト（自社担当催事の全件。依頼元代理店をまたいで見る）。
    const existing = await tx.eventShift.findMany({
      where: { ...shiftScope(partner), userId: { in: parsed.userIds } },
      select: { id: true, userId: true, startPlanned: true, endPlanned: true },
    });
    const existingIntervals = existing.map((e) => ({
      id: e.id,
      userId: e.userId,
      start: e.startPlanned,
      end: e.endPlanned,
    }));

    // 既存との重複と、今回作る区間同士の重複の両方を見る。
    const conflicts = findBulkShiftConflicts(
      candidates.map((c) => ({ userId: c.userId, start: c.start, end: c.end })),
      existingIntervals,
    );
    if (conflicts.length > 0) {
      throw new ConflictError(t.errors.overlap);
    }

    let created = 0;
    for (const c of candidates) {
      try {
        await tx.eventShift.create({
          data: {
            eventId: c.eventId,
            eventDayId: c.eventDayId,
            userId: c.userId,
            role: parsed.role,
            startPlanned: c.start,
            endPlanned: c.end,
            note: parsed.note ?? null,
          },
        });
        created += 1;
      } catch (err) {
        // 同時操作で他の管理者が先に入れていた場合はここへ来る（DB 制約が最終ガード）。
        if (isOverlapConstraintError(err)) throw new ConflictError(t.errors.overlap);
        throw err;
      }
    }

    revalidatePath(BASE);
    return { created };
  });
}

/** 予定時間・役割の変更。編集中の行自身は重複相手にしない。 */
export async function updatePartnerShiftPlanAction(
  input: PartnerShiftUpdateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_shift.write");
  const parsed = PartnerShiftUpdateSchema.parse(input);

  return withTenant(partner.ctx, async (tx) => {
    const existing = await tx.eventShift.findFirst({
      where: { id: parsed.shiftId, ...shiftScope(partner) },
      select: { id: true, userId: true },
    });
    if (!existing) throw new NotFoundError(labels.partner.errors.notFound);

    const others = await tx.eventShift.findMany({
      where: { ...shiftScope(partner), userId: existing.userId },
      select: { id: true, userId: true, startPlanned: true, endPlanned: true },
    });

    const conflicts = findShiftConflicts({
      candidate: {
        id: existing.id,
        userId: existing.userId,
        start: parsed.startPlanned,
        end: parsed.endPlanned,
      },
      existing: others.map((o) => ({
        id: o.id,
        userId: o.userId,
        start: o.startPlanned,
        end: o.endPlanned,
      })),
      // 自分自身の行は相手にしない。
      ignoreShiftId: existing.id,
    });
    if (conflicts.length > 0) throw new ConflictError(t.errors.overlap);

    try {
      await tx.eventShift.update({
        where: { id: existing.id },
        data: {
          ...(parsed.role ? { role: parsed.role } : {}),
          startPlanned: parsed.startPlanned,
          endPlanned: parsed.endPlanned,
          note: parsed.note ?? null,
        },
      });
    } catch (err) {
      if (isOverlapConstraintError(err)) throw new ConflictError(t.errors.overlap);
      throw err;
    }

    revalidatePath(BASE);
    revalidatePath(`${BASE}/${existing.id}`);
    return { id: existing.id };
  });
}

/**
 * 実績時間の記録。予定時間は変更しない。
 *
 * 実績は重複判定に使わないので、ここでは重複検証をしない
 * （実績を直しただけで将来の配置が変わらないようにするため）。
 */
export async function updatePartnerShiftActualAction(
  input: PartnerShiftActualInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_shift.write");
  const parsed = PartnerShiftActualSchema.parse(input);

  return withTenant(partner.ctx, async (tx) => {
    const existing = await tx.eventShift.findFirst({
      where: { id: parsed.shiftId, ...shiftScope(partner) },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError(labels.partner.errors.notFound);

    await tx.eventShift.update({
      where: { id: existing.id },
      data: {
        startActual: parsed.startActual ?? null,
        endActual: parsed.endActual ?? null,
        ...(parsed.note !== undefined ? { note: parsed.note } : {}),
      },
    });

    revalidatePath(BASE);
    revalidatePath(`${BASE}/${existing.id}`);
    return { id: existing.id };
  });
}

export async function unassignPartnerShiftAction(
  input: PartnerShiftUnassignInput,
): Promise<{ ok: true }> {
  const partner = await requirePartnerContext("partner_shift.write");
  const parsed = PartnerShiftUnassignSchema.parse(input);

  await withTenant(partner.ctx, async (tx) => {
    const existing = await tx.eventShift.findFirst({
      where: { id: parsed.shiftId, ...shiftScope(partner) },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError(labels.partner.errors.notFound);
    await tx.eventShift.delete({ where: { id: existing.id } });
  });

  revalidatePath(BASE);
  return { ok: true };
}
