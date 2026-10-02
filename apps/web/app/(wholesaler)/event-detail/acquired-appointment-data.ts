// 催事で獲得したアポイント（イベント詳細の「アポイント情報」）。
//
// これまでこの一覧は表示のたびにデモ値を作っていた（buildDemoAppointments）。
// DB を整理しても画面だけ大量に並ぶ状態になるので、実際の Appointment を読む。
//
// 対象は「その催事を獲得元とするアポイント」だけ。日付が近いというだけの行は拾わない。
// 個人情報は既存と同じ MaskingService を通す（氏名・住所・電話）。

import "server-only";

import { maskAddress, maskName, maskPhone } from "@solar/contracts/services/masking";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { ViewerContext } from "@solar/contracts/services/masking";

export interface AcquiredAppointmentRow {
  appointmentId: string;
  customerId: string;
  /** 顧客名（マスキング後）。 */
  customerName: string;
  /** アポ日時の表示用文字列。 */
  dateTime: string;
  /** 住所（マスキング後）。 */
  address: string;
  /** 獲得したパートナー会社。自社獲得なら null。 */
  companyName: string | null;
  /** 状態と備考をまとめた 1 行。 */
  memo: string;
}

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

function formatDateTime(d: Date): string {
  // 予定日時は時刻を持つので、ローカル（JST）で読む。
  return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, "0")}（${DOW[d.getDay()]}）${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 1 催事ぶんの獲得アポイント。催事が未確定（Event なし）なら空。 */
export async function getAcquiredAppointmentsForEvent(
  eventId: string | null,
): Promise<AcquiredAppointmentRow[]> {
  if (!eventId) return [];

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
    action: "customer.read",
  });

  return withTenant(ctx, async (tx) => {
    const settings = ctx.wholesalerId
      ? await tx.wholesalerSettings.findUnique({
          where: { wholesalerId: ctx.wholesalerId },
          select: { piiMaskingMode: true },
        })
      : null;
    const viewer: ViewerContext = {
      role: (session.user.roles[0] ?? "WHOLESALER_ADMIN") as ViewerContext["role"],
      tenantType: "WHOLESALER",
      isSelfTenant: true,
      piiMaskingMode: (settings?.piiMaskingMode ?? "MASKED") as "FULL" | "PARTIAL" | "MASKED",
    };

    const rows = await tx.appointment.findMany({
      where: { eventId },
      orderBy: { scheduledAt: "asc" },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        note: true,
        customer: {
          select: { id: true, name: true, prefecture: true, addressLine: true, phone: true },
        },
        acquiredRelationship: { select: { dealer: { select: { name: true } } } },
      },
    });

    return rows.map((r) => ({
      appointmentId: r.id,
      customerId: r.customer.id,
      customerName: maskName(r.customer.name, viewer),
      dateTime: formatDateTime(r.scheduledAt),
      address: maskAddress(`${r.customer.prefecture ?? ""}${r.customer.addressLine ?? ""}`, viewer),
      companyName: r.acquiredRelationship?.dealer.name ?? null,
      memo: [r.note, maskPhone(r.customer.phone, viewer)].filter(Boolean).join(" / "),
    }));
  });
}

/**
 * レーン催事の開催日ごとの獲得アポイント。
 *
 * 日報と同じ辿り方（LanePreferenceItem.lineEventId → 採用 → Event）で、
 * このレーンの枠で確定した催事のアポイントだけを集める。
 */
export async function getAcquiredAppointmentsForLineEvent(
  lineEventId: string,
): Promise<Record<string, AcquiredAppointmentRow[]>> {
  const adoptions = await withTenantForLine(lineEventId);
  if (adoptions.length === 0) return {};

  const out: Record<string, AcquiredAppointmentRow[]> = {};
  for (const a of adoptions) {
    const rows = await getAcquiredAppointmentsForEvent(a.eventId);
    for (const day of a.days) {
      // 獲得アポイントは催事単位なので、開催日には催事ぶんをそのまま出す。
      out[day] = [...(out[day] ?? []), ...rows];
    }
  }
  return out;
}

/** レーン → 採用 → 催事・開催日 の対応を引く。 */
async function withTenantForLine(
  lineEventId: string,
): Promise<Array<{ eventId: string; days: string[] }>> {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError({
      code: "INVALID_CREDENTIALS",
      message: "Session missing — sign in is required",
    });
  }
  const ctx = await getTenantContext();
  return withTenant(ctx, async (tx) => {
    const adoptions = await tx.lanePreferenceAdoption.findMany({
      where: { item: { lineEventId } },
      select: { event: { select: { id: true, days: { select: { eventDate: true } } } } },
    });
    const byEvent = new Map<string, string[]>();
    for (const a of adoptions) {
      if (!a.event) continue;
      byEvent.set(
        a.event.id,
        a.event.days.map((d) => d.eventDate.toISOString().slice(0, 10)),
      );
    }
    return [...byEvent.entries()].map(([eventId, days]) => ({ eventId, days }));
  });
}
