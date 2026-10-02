"use server";

// 催事シフトの出退勤（本人の打刻）。
//
// 保存先は既存の EventShift（startActual / endActual / status）。新しい勤怠テーブルは
// 作らない。時刻はサーバー側で決めるので、フォームからは対象のシフトだけを受け取る。
//
// 条件の判定は lib/partner/attendance.ts に置き、ここは入口（権限・トランザクション・
// 画面の再取得）だけを担う。URL 直打ちでも Server Action への直接送信でも同じ関数を通る。

import { PartnerAttendancePunchSchema, type PartnerAttendancePunchInput } from "@solar/contracts";
import { revalidatePath } from "next/cache";

import { clockIn, clockOut } from "@/lib/partner/attendance";
import { requirePartnerContext } from "@/lib/partner/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

/** 打刻のあと作り直す画面。トップと催事シフトの両方から押せる。 */
function revalidateAll(shiftId: string): void {
  revalidatePath("/p-home");
  revalidatePath("/p-shifts");
  revalidatePath(`/p-shifts/${shiftId}`);
}

export async function clockInAction(
  input: PartnerAttendancePunchInput,
): Promise<{ shiftId: string; startActual: string; alreadyDone: boolean }> {
  const partner = await requirePartnerContext("partner_shift.clock");
  const parsed = PartnerAttendancePunchSchema.parse(input);

  const result = await withTenant(partner.ctx, (tx) => clockIn(tx, partner, parsed.shiftId));
  revalidateAll(result.shiftId);
  return {
    shiftId: result.shiftId,
    startActual: result.startActual.toISOString(),
    alreadyDone: result.alreadyDone,
  };
}

export async function clockOutAction(
  input: PartnerAttendancePunchInput,
): Promise<{ shiftId: string; endActual: string; alreadyDone: boolean }> {
  const partner = await requirePartnerContext("partner_shift.clock");
  const parsed = PartnerAttendancePunchSchema.parse(input);

  const result = await withTenant(partner.ctx, (tx) => clockOut(tx, partner, parsed.shiftId));
  revalidateAll(result.shiftId);
  return {
    shiftId: result.shiftId,
    endActual: result.endActual.toISOString(),
    alreadyDone: result.alreadyDone,
  };
}
