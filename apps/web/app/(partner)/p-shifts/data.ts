// 催事シフトの読み出し。
//
// 見せ方:
//   月単位で「開催日 → 催事（開催場所・開催時間）→ 配置スタッフ（役割・予定/実績）」を組む。
//   一覧ビューとカレンダービューは同じこのデータから描く（取り方を二重に持たない）。
//
// 閲覧範囲:
//   自社が担当会社として割り当てられている催事（lib/partner/scope.ts の eventScope）。
//   別の依頼元代理店の催事も自社担当なら入る。無関係な他社の催事は入らない。
//
// 配置の可否判定に必要な「他社案件で埋まっているか」は、自社スタッフ（userId）の
// 既存シフトを時間帯で見れば足りる。他社案件の詳細（顧客・金額など）は読まない。

import "server-only";

import { requirePartnerContext, wholesalerNameMap } from "@/lib/partner/context";
import { eventScope, shiftScope } from "@/lib/partner/scope";
import { withTenant } from "@/lib/tenancy/with-tenant";

import { monthRange, shiftMonth } from "./query";

import type { ShiftMonthQuery } from "./query";
import type { PartnerContext } from "@/lib/partner/context";
import type { Prisma, TxClient } from "@solar/db";

export interface ShiftStaffView {
  shiftId: string;
  userId: string;
  userName: string | null;
  role: string;
  startPlanned: string;
  endPlanned: string;
  startActual: string | null;
  endActual: string | null;
  status: string;
  note: string | null;
}

export interface ShiftEventDayView {
  eventId: string;
  eventDayId: string | null;
  /** 'YYYY-MM-DD'（ローカル暦日）。 */
  date: string;
  venuePlace: string;
  /** 依頼元代理店。複数代理店から依頼を受けている場合の区別に使う。 */
  originName: string;
  /** その日の開催時間。未登録なら null（架空の時間で埋めない）。 */
  startAt: string | null;
  endAt: string | null;
  staff: ShiftStaffView[];
}

export interface ShiftMonthResult {
  month: string;
  prevMonth: string;
  nextMonth: string;
  /** 開催日 → 開催開始 → 場所 の順。 */
  days: ShiftEventDayView[];
  /** 絞り込み用のスタッフ候補（自社の利用者）。 */
  memberOptions: { id: string; name: string }[];
  isAdmin: boolean;
}

/**
 * 日時（シフトの予定・実績）のローカル暦日 'YYYY-MM-DD'。
 * toISOString は使わない（UTC へずれるため）。
 */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * 暦日そのものを表す列（EventDay.eventDate / EventCandidate.scheduledDate）の 'YYYY-MM-DD'。
 * これらは既存方針どおり UTC 0 時で保持しているので、UTC の値で読む。
 * ローカル getter で読むと JST では前日にずれる。
 */
export function calendarDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** 自社の利用者（シフトの配置先候補）。 */
async function loadMembers(
  tx: TxClient,
  partner: PartnerContext,
): Promise<{ id: string; name: string }[]> {
  const rows = await tx.user.findMany({
    where: { tenantId: partner.tenantId, status: { in: ["ACTIVE", "INVITED"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return rows;
}

export async function listPartnerShiftMonth(q: ShiftMonthQuery): Promise<ShiftMonthResult> {
  const partner = await requirePartnerContext("partner_shift.read");
  const { start, end } = monthRange(q.month);
  const originNames = wholesalerNameMap(partner);

  return withTenant(partner.ctx, async (tx) => {
    const members = await loadMembers(tx, partner);
    const memberNames = new Map(members.map((m) => [m.id, m.name]));

    const venueFilter: Prisma.EventWhereInput = q.venue
      ? { eventCandidate: { storeName: { contains: q.venue, mode: "insensitive" } } }
      : {};

    // 対象は「開催日がこの月にある催事」。開催日が未登録の催事は候補の予定日で見る。
    const events = await tx.event.findMany({
      where: {
        ...eventScope(partner),
        ...venueFilter,
        OR: [
          { days: { some: { eventDate: { gte: start, lt: end } } } },
          {
            days: { none: {} },
            eventCandidate: { scheduledDate: { gte: start, lt: end } },
          },
        ],
      },
      select: {
        id: true,
        eventCandidate: { select: { storeName: true, scheduledDate: true } },
        dealers: {
          where: { relationshipId: { in: partner.relationshipIds } },
          select: { relationshipId: true },
        },
        days: {
          where: { eventDate: { gte: start, lt: end } },
          orderBy: { eventDate: "asc" },
          select: { id: true, eventDate: true, startAt: true, endAt: true },
        },
        shifts: {
          orderBy: { startPlanned: "asc" },
          select: {
            id: true,
            eventDayId: true,
            userId: true,
            role: true,
            startPlanned: true,
            endPlanned: true,
            startActual: true,
            endActual: true,
            status: true,
            note: true,
          },
        },
      },
    });

    const days: ShiftEventDayView[] = [];

    for (const ev of events) {
      const originName = originNames.get(ev.dealers[0]?.relationshipId ?? "") ?? "—";
      // 開催日レコードが無い催事は、候補の予定日を 1 日として扱う。
      const dayRows =
        ev.days.length > 0
          ? ev.days.map((d) => ({
              id: d.id as string | null,
              date: d.eventDate,
              startAt: d.startAt,
              endAt: d.endAt,
            }))
          : [
              {
                id: null,
                date: ev.eventCandidate.scheduledDate,
                startAt: null as Date | null,
                endAt: null as Date | null,
              },
            ];

      for (const day of dayRows) {
        const dateKey = calendarDateKey(day.date);
        // その日のシフト。eventDayId が付いていない旧データは開始日で突き合わせる。
        const staffRows = ev.shifts.filter((s) =>
          day.id
            ? s.eventDayId === day.id ||
              (s.eventDayId === null && localDateKey(s.startPlanned) === dateKey)
            : localDateKey(s.startPlanned) === dateKey,
        );
        const filtered = q.member ? staffRows.filter((s) => s.userId === q.member) : staffRows;

        // スタッフで絞っているときは、その人の配置が無い日は出さない。
        if (q.member && filtered.length === 0) continue;

        days.push({
          eventId: ev.id,
          eventDayId: day.id,
          date: dateKey,
          venuePlace: ev.eventCandidate.storeName,
          originName,
          startAt: day.startAt?.toISOString() ?? null,
          endAt: day.endAt?.toISOString() ?? null,
          staff: filtered.map((s) => ({
            shiftId: s.id,
            userId: s.userId,
            userName: memberNames.get(s.userId) ?? null,
            role: s.role,
            startPlanned: s.startPlanned.toISOString(),
            endPlanned: s.endPlanned.toISOString(),
            startActual: s.startActual?.toISOString() ?? null,
            endActual: s.endActual?.toISOString() ?? null,
            status: s.status,
            note: s.note,
          })),
        });
      }
    }

    // 開催日 → 開催開始時刻 → 開催場所 の順（並べ替え UI は持たない固定順）。
    days.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      const at = a.startAt ?? "";
      const bt = b.startAt ?? "";
      if (at !== bt) return at < bt ? -1 : 1;
      return a.venuePlace.localeCompare(b.venuePlace, "ja");
    });

    return {
      month: q.month,
      prevMonth: shiftMonth(q.month, -1),
      nextMonth: shiftMonth(q.month, 1),
      days,
      memberOptions: members,
      isAdmin: partner.role === "ADMIN",
    };
  });
}

// ---------------------------------------------------------------------------
// 配置画面（管理者のみ）
// ---------------------------------------------------------------------------

export interface AssignTargetOption {
  eventId: string;
  eventDayId: string | null;
  date: string;
  venuePlace: string;
  originName: string;
  /** 予定時間の初期値（開催時間）。未登録なら null で、画面側で入力させる。 */
  startAt: string | null;
  endAt: string | null;
  /** 既に配置されている人数。 */
  assignedCount: number;
}

export interface AssignStaffOption {
  userId: string;
  name: string;
  /** 販売員マスタとの紐付け（あれば）。 */
  salespersonId: string | null;
  isGuest: boolean;
  /** 自宅住所（移動条件の参考。未登録なら null）。 */
  homeAddress: string | null;
  /** 既存の予定シフト（重複判定に使う）。 */
  busy: { shiftId: string; start: string; end: string }[];
}

export interface AssignFormData {
  month: string;
  targets: AssignTargetOption[];
  staff: AssignStaffOption[];
}

/**
 * 配置フォーム用のデータ。
 *
 * スタッフの「埋まっている時間」は自社スタッフの予定シフト全件（月の前後を含む）から作る。
 * 別の依頼元代理店の催事ぶんも自社担当の催事なので範囲に入り、重複判定に使える。
 * 他社案件の中身は読まない（時間帯だけ）。
 */
export async function getAssignFormData(month: string): Promise<AssignFormData> {
  const partner = await requirePartnerContext("partner_shift.write");
  const { start, end } = monthRange(month);
  const originNames = wholesalerNameMap(partner);

  return withTenant(partner.ctx, async (tx) => {
    const [events, members, salespeople, busyRows] = await Promise.all([
      tx.event.findMany({
        where: {
          ...eventScope(partner),
          status: { in: ["PLANNED", "ONGOING"] },
          OR: [
            { days: { some: { eventDate: { gte: start, lt: end } } } },
            { days: { none: {} }, eventCandidate: { scheduledDate: { gte: start, lt: end } } },
          ],
        },
        select: {
          id: true,
          eventCandidate: { select: { storeName: true, scheduledDate: true } },
          dealers: {
            where: { relationshipId: { in: partner.relationshipIds } },
            select: { relationshipId: true },
          },
          days: {
            where: { eventDate: { gte: start, lt: end } },
            orderBy: { eventDate: "asc" },
            select: {
              id: true,
              eventDate: true,
              startAt: true,
              endAt: true,
              _count: { select: { shifts: true } },
            },
          },
          _count: { select: { shifts: true } },
        },
      }),
      loadMembers(tx, partner),
      tx.salesperson.findMany({
        where: { relationshipId: { in: partner.relationshipIds } },
        select: { id: true, userId: true, isGuest: true, address: true },
      }),
      // 重複判定の材料。月の前後 1 か月ぶんを含めて引く（月境界の跨ぎに備える）。
      tx.eventShift.findMany({
        where: {
          ...shiftScope(partner),
          startPlanned: { gte: monthRange(shiftMonth(month, -1)).start },
          endPlanned: { lt: monthRange(shiftMonth(month, 2)).start },
        },
        select: { id: true, userId: true, startPlanned: true, endPlanned: true },
      }),
    ]);

    const spByUser = new Map(salespeople.filter((s) => s.userId).map((s) => [s.userId!, s]));
    const busyByUser = new Map<string, { shiftId: string; start: string; end: string }[]>();
    for (const row of busyRows) {
      const list = busyByUser.get(row.userId) ?? [];
      list.push({
        shiftId: row.id,
        start: row.startPlanned.toISOString(),
        end: row.endPlanned.toISOString(),
      });
      busyByUser.set(row.userId, list);
    }

    const targets: AssignTargetOption[] = [];
    for (const ev of events) {
      const originName = originNames.get(ev.dealers[0]?.relationshipId ?? "") ?? "—";
      if (ev.days.length > 0) {
        for (const d of ev.days) {
          targets.push({
            eventId: ev.id,
            eventDayId: d.id,
            date: calendarDateKey(d.eventDate),
            venuePlace: ev.eventCandidate.storeName,
            originName,
            startAt: d.startAt?.toISOString() ?? null,
            endAt: d.endAt?.toISOString() ?? null,
            assignedCount: d._count.shifts,
          });
        }
      } else {
        targets.push({
          eventId: ev.id,
          eventDayId: null,
          date: calendarDateKey(ev.eventCandidate.scheduledDate),
          venuePlace: ev.eventCandidate.storeName,
          originName,
          startAt: null,
          endAt: null,
          assignedCount: ev._count.shifts,
        });
      }
    }
    targets.sort((a, b) =>
      a.date !== b.date
        ? a.date < b.date
          ? -1
          : 1
        : a.venuePlace.localeCompare(b.venuePlace, "ja"),
    );

    return {
      month,
      targets,
      staff: members.map((m) => {
        const sp = spByUser.get(m.id);
        return {
          userId: m.id,
          name: m.name,
          salespersonId: sp?.id ?? null,
          isGuest: sp?.isGuest ?? false,
          homeAddress: sp?.address ?? null,
          busy: busyByUser.get(m.id) ?? [],
        };
      }),
    };
  });
}

export interface ShiftDetailView extends ShiftStaffView {
  eventId: string;
  /** どの開催日か。旧データで開催日レコードが無ければ null。 */
  eventDayId: string | null;
  venuePlace: string;
  originName: string;
  date: string;
  eventStartAt: string | null;
  eventEndAt: string | null;
  isAdmin: boolean;
}

export async function getPartnerShiftDetail(shiftId: string): Promise<ShiftDetailView | null> {
  const partner = await requirePartnerContext("partner_shift.read");
  const originNames = wholesalerNameMap(partner);

  return withTenant(partner.ctx, async (tx) => {
    const s = await tx.eventShift.findFirst({
      where: { id: shiftId, ...shiftScope(partner) },
      select: {
        id: true,
        userId: true,
        role: true,
        startPlanned: true,
        endPlanned: true,
        startActual: true,
        endActual: true,
        status: true,
        note: true,
        eventDay: { select: { id: true, eventDate: true, startAt: true, endAt: true } },
        event: {
          select: {
            id: true,
            eventCandidate: { select: { storeName: true, scheduledDate: true } },
            dealers: {
              where: { relationshipId: { in: partner.relationshipIds } },
              select: { relationshipId: true },
            },
          },
        },
      },
    });
    if (!s) return null;

    const user = await tx.user.findFirst({
      where: { id: s.userId, tenantId: partner.tenantId },
      select: { name: true },
    });

    return {
      shiftId: s.id,
      userId: s.userId,
      userName: user?.name ?? null,
      role: s.role,
      startPlanned: s.startPlanned.toISOString(),
      endPlanned: s.endPlanned.toISOString(),
      startActual: s.startActual?.toISOString() ?? null,
      endActual: s.endActual?.toISOString() ?? null,
      status: s.status,
      note: s.note,
      eventId: s.event.id,
      eventDayId: s.eventDay?.id ?? null,
      venuePlace: s.event.eventCandidate.storeName,
      originName: originNames.get(s.event.dealers[0]?.relationshipId ?? "") ?? "—",
      // 開催日レコードがあれば暦日、無ければシフトの予定開始から日を取る。
      date: s.eventDay ? calendarDateKey(s.eventDay.eventDate) : localDateKey(s.startPlanned),
      eventStartAt: s.eventDay?.startAt?.toISOString() ?? null,
      eventEndAt: s.eventDay?.endAt?.toISOString() ?? null,
      isAdmin: partner.role === "ADMIN",
    };
  });
}
