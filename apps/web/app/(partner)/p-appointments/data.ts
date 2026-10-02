// 二次店ポータル：アポイントのデータローダー。
//
// 保存先が 2 つあるので、読み出しも 2 系統に分ける。
//   初訪アポ … Customer 1 行 + Appointment 1 行（既存モデル）
//   訪問アポ … DealerVisitAppointment 1 行（専用テーブル）
//
// 一覧はこの 2 つを取得してから 1 本にまとめる。DB 構造は共通化しない。
// いずれも自社の relationshipId を取得条件にするので、URL の id 書き換えでは
// 他社の行に届かない（RLS と併せて二重に塞ぐ）。

import "server-only";

import { fromFaceToFaceBoolean, type PartnerAppointmentKind } from "@solar/contracts";

import {
  listDealerUserOptions,
  registeredByWhere,
  resolveUserNames,
  submittedByWhere,
  type DealerUserOption,
} from "@/lib/partner/admin";
import { requirePartnerContext, wholesalerNameMap } from "@/lib/partner/context";
import { resolvePartnerEvent } from "@/lib/partner/events";
import {
  comparator,
  dateTimeBounds,
  hasBounds,
  paginate,
  type SortValue,
} from "@/lib/partner/list-query";
import {
  customerScope,
  relationshipScope,
  salespersonScope,
  shiftScope,
} from "@/lib/partner/scope";
import {
  CUSTOMER_VENUE_SELECT,
  EVENT_VENUE_SELECT,
  resolveVenueInfo,
} from "@/lib/partner/venue-info";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { AppointmentListQuery } from "./query";
import type { Prisma } from "@solar/db";

// 担当者セレクトの選択肢は販売員画面のローダーに一本化する（実装を二重に持たない）。
export { listPartnerSalespersonOptions } from "../p-salespeople/data";

export interface PartnerAppointmentListItem {
  id: string;
  kind: PartnerAppointmentKind;
  /** お客様名（初訪アポのみ。訪問アポには顧客名が無い）。 */
  customerName: string | null;
  /** クローズ部署（訪問アポのみ）。 */
  closeDept: string | null;
  firstVisitAt: string | null;
  venuePlace: string | null;
  /** 提出したスタッフ。管理者向けの列にだけ使う。 */
  submitterName: string | null;
  createdAt: string;
}

export interface PartnerFirstVisitDetail {
  id: string;
  tossUpSalespersonId: string | null;
  tossUpSalespersonName: string | null;
  closingRelationshipId: string | null;
  closingRelationshipName: string | null;
  closingSalespersonId: string | null;
  closingSalespersonName: string | null;
  salesChannel: string | null;
  eventDate: string | null;
  venuePlace: string | null;
  venueChain: string | null;
  boothArea: string | null;
  boothAreaNote: string | null;
  /** 催事情報が登録済みイベント由来か（過去データ向け）。 */
  venueFromEvent: boolean;
  faceToFace: string | undefined;
  name: string;
  kana: string | null;
  landlinePhone: string | null;
  mobilePhone: string | null;
  postalCode: string | null;
  prefecture: string | null;
  cityAddress: string | null;
  note: string | null;
  maekakuPreferredAt: string | null;
  maekakuOperator: string | null;
  firstVisitAt: string | null;
  createdAt: string;
}

export interface PartnerVisitDetail {
  id: string;
  /** 対象の顧客。選ばれていなければ null。 */
  customerId: string | null;
  customerName: string | null;
  tossDept: string;
  maekakuOperator: string;
  closeDept: string;
  salespersonId: string;
  salespersonName: string | null;
  salesChannel: string;
  createdAt: string;
}

export interface PartnerAppointmentListResult {
  rows: PartnerAppointmentListItem[];
  total: number;
  page: number;
  pageCount: number;
  isAdmin: boolean;
  staffOptions: DealerUserOption[];
}

/**
 * 一覧（初訪アポ + 訪問アポ）。
 *
 * 処理順は「権限による対象限定 → 絞り込み（各テーブルで）→ 統合 → 並べ替え → ページ分割」。
 * 2 テーブルを統合してから並べるため、並べ替えとページ分割はメモリ上で行う
 * （対象は本人 / 自社の行に限られ、件数は小さい）。
 */
export async function listPartnerAppointments(
  q: AppointmentListQuery,
): Promise<PartnerAppointmentListResult> {
  const partner = await requirePartnerContext("partner_appointment.read");
  const isAdmin = partner.role === "ADMIN";
  return withTenant(partner.ctx, async (tx) => {
    const createdAtBounds = dateTimeBounds(q.createdAt);
    const firstVisitBounds = dateTimeBounds(q.firstVisitAt);

    const includeFirstVisit = q.kind !== "visit";
    // 区分「すべて」で初訪専用の条件が入っているときは、訪問アポには適用できない
    // 条件なので訪問アポを除外する（query.ts が注記を出す）。
    const includeVisit =
      q.kind !== "first-visit" && !(q.kind === undefined && q.firstVisitOnlyActive);

    const customerWhere: Prisma.CustomerWhereInput = {
      // 閲覧範囲は OR を含むので AND で包む。下の venuePlace 条件も OR を使うため、
      // そのままスプレッドすると後勝ちで範囲指定が消えてしまう。
      AND: [customerScope(partner)],
      ...registeredByWhere(partner, q.submittedBy),
      ...(q.customerName ? { name: { contains: q.customerName, mode: "insensitive" } } : {}),
      ...(q.venuePlace
        ? {
            OR: [
              { sourceVenuePlace: { contains: q.venuePlace, mode: "insensitive" } },
              {
                sourceEvent: {
                  eventCandidate: { storeName: { contains: q.venuePlace, mode: "insensitive" } },
                },
              },
            ],
          }
        : {}),
      ...(hasBounds(firstVisitBounds)
        ? { appointments: { some: { scheduledAt: firstVisitBounds } } }
        : {}),
      ...(hasBounds(createdAtBounds) ? { createdAt: createdAtBounds } : {}),
    };

    const visitWhere: Prisma.DealerVisitAppointmentWhereInput = {
      ...relationshipScope(partner),
      ...submittedByWhere(partner, q.submittedBy),
      ...(hasBounds(createdAtBounds) ? { createdAt: createdAtBounds } : {}),
      ...(q.tossDept ? { tossDept: { contains: q.tossDept, mode: "insensitive" } } : {}),
      ...(q.closeDept ? { closeDept: { contains: q.closeDept, mode: "insensitive" } } : {}),
      ...(q.salespersonId ? { salespersonId: q.salespersonId } : {}),
      ...(q.salesChannel ? { salesChannel: q.salesChannel } : {}),
    };

    const [customers, visits] = await Promise.all([
      includeFirstVisit
        ? tx.customer.findMany({
            where: customerWhere,
            select: {
              id: true,
              name: true,
              registeredByUserId: true,
              createdAt: true,
              sourceVenuePlace: true,
              sourceEvent: { select: { eventCandidate: { select: { storeName: true } } } },
              appointments: {
                orderBy: { createdAt: "asc" },
                take: 1,
                select: { scheduledAt: true },
              },
            },
          })
        : Promise.resolve([]),
      includeVisit
        ? tx.dealerVisitAppointment.findMany({
            where: visitWhere,
            select: { id: true, closeDept: true, createdByUserId: true, createdAt: true },
          })
        : Promise.resolve([]),
    ]);

    // 提出者の氏名は User へのリレーションが無いので、同じ tx 内でまとめて引く。
    const [names, staffOptions] = await Promise.all([
      isAdmin
        ? resolveUserNames(tx, [
            ...customers.map((r) => r.registeredByUserId),
            ...visits.map((r) => r.createdByUserId),
          ])
        : Promise.resolve(null),
      isAdmin ? listDealerUserOptions(tx, partner) : Promise.resolve([]),
    ]);

    const firstVisitRows: PartnerAppointmentListItem[] = customers.map((r) => ({
      id: r.id,
      kind: "FIRST_VISIT" as const,
      customerName: r.name,
      closeDept: null,
      firstVisitAt: r.appointments[0]?.scheduledAt
        ? r.appointments[0]!.scheduledAt.toISOString()
        : null,
      venuePlace: r.sourceEvent?.eventCandidate.storeName ?? r.sourceVenuePlace ?? null,
      submitterName: names?.get(r.registeredByUserId) ?? null,
      createdAt: r.createdAt.toISOString(),
    }));

    const visitRows: PartnerAppointmentListItem[] = visits.map((r) => ({
      id: r.id,
      kind: "VISIT" as const,
      customerName: null,
      closeDept: r.closeDept,
      firstVisitAt: null,
      venuePlace: null,
      submitterName: names?.get(r.createdByUserId) ?? null,
      createdAt: r.createdAt.toISOString(),
    }));

    const pick = (r: PartnerAppointmentListItem): SortValue => {
      switch (q.sort.field) {
        case "kind":
          return r.kind;
        case "customerName":
          return r.customerName;
        case "firstVisitAt":
          return r.firstVisitAt;
        case "venuePlace":
          return r.venuePlace;
        case "createdAt":
        default:
          return r.createdAt;
      }
    };
    const sorted = [...firstVisitRows, ...visitRows].sort(comparator(pick, q.sort.direction));
    return { ...paginate(sorted, q.page), isAdmin, staffOptions };
  });
}

export async function getPartnerFirstVisit(id: string): Promise<PartnerFirstVisitDetail | null> {
  const partner = await requirePartnerContext("partner_appointment.read");
  return withTenant(partner.ctx, async (tx) => {
    const c = await tx.customer.findFirst({
      where: { id, AND: [customerScope(partner)] },
      select: {
        id: true,
        name: true,
        kana: true,
        landlinePhone: true,
        mobilePhone: true,
        postalCode: true,
        prefecture: true,
        city: true,
        addressLine: true,
        note: true,
        salesChannel: true,
        faceToFace: true,
        maekakuPreferredAt: true,
        maekakuOperator: true,
        tossUpSalespersonId: true,
        closingSalespersonId: true,
        closingRelationshipId: true,
        ...CUSTOMER_VENUE_SELECT,
        createdAt: true,
        appointments: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { scheduledAt: true },
        },
      },
    });
    if (!c) return null;

    // 担当者名（自社販売員）。ID だけでは画面に出せないので名前を引く。
    const salespersonIds = [c.tossUpSalespersonId, c.closingSalespersonId].filter(
      (v): v is string => Boolean(v),
    );
    const salespeople = salespersonIds.length
      ? await tx.salesperson.findMany({
          where: { id: { in: salespersonIds }, ...salespersonScope(partner) },
          select: { id: true, name: true },
        })
      : [];
    const nameOf = (id: string | null) =>
      id ? (salespeople.find((s) => s.id === id)?.name ?? null) : null;

    // クローズ会社の表示名。RLS で読める範囲だけを引く。
    const closeCompany = c.closingRelationshipId
      ? await tx.relationship.findFirst({
          where: { id: c.closingRelationshipId },
          select: { dealer: { select: { name: true } } },
        })
      : null;

    // 催事情報。過去データでイベント紐付けがある行はイベント側を正とする。
    const event = c.sourceEventId
      ? await tx.event.findFirst({
          where: { id: c.sourceEventId },
          select: { eventCandidate: { select: EVENT_VENUE_SELECT } },
        })
      : null;
    const venue = resolveVenueInfo(event?.eventCandidate ?? null, c);
    const appt = c.appointments[0];

    return {
      id: c.id,
      tossUpSalespersonId: c.tossUpSalespersonId,
      tossUpSalespersonName: nameOf(c.tossUpSalespersonId),
      closingRelationshipId: c.closingRelationshipId,
      closingRelationshipName: closeCompany?.dealer.name ?? null,
      closingSalespersonId: c.closingSalespersonId,
      closingSalespersonName: nameOf(c.closingSalespersonId),
      salesChannel: c.salesChannel,
      eventDate: venue.eventDate,
      venuePlace: venue.venuePlace,
      venueChain: venue.venueChain,
      boothArea: venue.boothArea,
      boothAreaNote: venue.boothAreaNote,
      venueFromEvent: venue.fromEvent,
      faceToFace: fromFaceToFaceBoolean(c.faceToFace),
      name: c.name,
      kana: c.kana,
      landlinePhone: c.landlinePhone,
      mobilePhone: c.mobilePhone,
      postalCode: c.postalCode,
      prefecture: c.prefecture,
      cityAddress: [c.city, c.addressLine].filter(Boolean).join(" ") || null,
      note: c.note,
      maekakuPreferredAt: c.maekakuPreferredAt ? c.maekakuPreferredAt.toISOString() : null,
      maekakuOperator: c.maekakuOperator,
      firstVisitAt: appt?.scheduledAt ? appt.scheduledAt.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
    };
  });
}

export async function getPartnerVisit(id: string): Promise<PartnerVisitDetail | null> {
  const partner = await requirePartnerContext("partner_visit_appointment.read");
  return withTenant(partner.ctx, async (tx) => {
    const row = await tx.dealerVisitAppointment.findFirst({
      where: { id, ...relationshipScope(partner) },
      select: {
        id: true,
        tossDept: true,
        maekakuOperator: true,
        closeDept: true,
        salespersonId: true,
        salesChannel: true,
        createdAt: true,
        customerId: true,
        salesperson: { select: { name: true } },
        customer: { select: { name: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      customerId: row.customerId,
      customerName: row.customer?.name ?? null,
      tossDept: row.tossDept,
      maekakuOperator: row.maekakuOperator,
      closeDept: row.closeDept,
      salespersonId: row.salespersonId,
      salespersonName: row.salesperson?.name ?? null,
      salesChannel: row.salesChannel,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

/**
 * クローズ会社セレクトの選択肢。
 *
 * ログイン中の二次店が参照を許された Relationship だけを返す。範囲は RLS が
 * 決めるので、ここで追加の絞り込みはしない（= 自社を含む、読める会社のみ）。
 * 保存時は Server Action 側で「この一覧に含まれるか」を必ず再確認する。
 */
export async function listPartnerCloseCompanyOptions(): Promise<{ id: string; name: string }[]> {
  const partner = await requirePartnerContext("partner_appointment.read");
  return withTenant(partner.ctx, async (tx) => {
    const rows = await tx.relationship.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, dealer: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({ id: r.id, name: r.dealer.name }));
  });
}

// ---------------------------------------------------------------------------
// 催事からのアポ登録（トップの「この催事からアポ登録」）
// ---------------------------------------------------------------------------

/**
 * 催事から登録するときの初期入力と、担当者・アポ獲得者の候補。
 *
 * 候補は「その催事・その開催日に配置されているスタッフ」に限る。管理者が追加した
 * ゲストスタッフも配置されていれば含まれる。別の催事の無関係なスタッフは混ぜない。
 *
 * 催事は id で解決する（店舗名の一致では結ばない）。範囲外の催事は NotFound。
 */
export interface AppointmentEventContext {
  eventId: string;
  eventDayId: string | null;
  /** 催事場所。 */
  venuePlace: string;
  /** 催事実施日（'YYYY-MM-DD'）。 */
  eventDate: string;
  /** 依頼元代理店。 */
  originName: string;
  /** 所属会社（ログイン利用者のパートナー会社）。 */
  companyName: string;
  venueChain: string | null;
  boothArea: string | null;
  boothAreaNote: string | null;
  /** 担当者・アポ獲得者の候補（当該催事・当日の参加スタッフ）。 */
  attendees: { id: string; name: string; isGuest: boolean }[];
  /** ログイン利用者に紐づく販売員。担当者・アポ獲得者の初期値。 */
  mySalespersonId: string | null;
}

export async function getAppointmentEventContext(
  eventId: string,
  eventDayId: string | null,
): Promise<AppointmentEventContext | null> {
  const partner = await requirePartnerContext("partner_appointment.write");

  return withTenant(partner.ctx, async (tx) => {
    let ref;
    try {
      ref = await resolvePartnerEvent(tx, partner, eventId, eventDayId);
    } catch {
      // 範囲外・存在しない催事は「催事なし」の通常登録として扱う（存在を教えない）。
      return null;
    }

    // その催事（指定があればその開催日）に配置されている利用者。
    const shifts = await tx.eventShift.findMany({
      where: {
        eventId: ref.eventId,
        ...(ref.eventDayId ? { eventDayId: ref.eventDayId } : {}),
      },
      select: { userId: true },
    });
    const userIds = Array.from(new Set(shifts.map((s) => s.userId)));

    // 配置された利用者に紐づく自社の販売員だけを候補にする。
    const attendees =
      userIds.length > 0
        ? await tx.salesperson.findMany({
            where: { userId: { in: userIds }, ...salespersonScope(partner) },
            orderBy: [{ isGuest: "asc" }, { kana: "asc" }, { name: "asc" }],
            select: { id: true, name: true, isGuest: true },
          })
        : [];

    const company = await tx.tenant.findFirst({
      where: { id: partner.tenantId },
      select: { name: true },
    });

    // 開催日は暦日（UTC 0 時保持）なので UTC で読む。ローカルで読むと JST では前日になる。
    const d = ref.eventDate;
    const eventDate = d
      ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
      : "";

    return {
      eventId: ref.eventId,
      eventDayId: ref.eventDayId,
      venuePlace: ref.venuePlace,
      eventDate,
      originName: ref.wholesalerName,
      companyName: company?.name ?? "—",
      venueChain: ref.venueChain,
      boothArea: ref.boothArea,
      boothAreaNote: ref.boothAreaNote,
      attendees,
      mySalespersonId: partner.salespersonId,
    };
  });
}

/**
 * 「どの催事からの登録か」を選ぶための候補。
 *
 * ログイン利用者が直近に配置されている催事を出す。対象をログイン利用者だけを根拠に
 * 推測して確定はしない — 候補が複数あるときは画面で選ばせる。
 */
export interface MyEventChoice {
  eventId: string;
  eventDayId: string | null;
  date: string;
  venuePlace: string;
  originName: string;
}

export async function listMyEventChoices(days = 7): Promise<MyEventChoice[]> {
  const partner = await requirePartnerContext("partner_appointment.write");
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days + 1);
  const originNames = wholesalerNameMap(partner);

  return withTenant(partner.ctx, async (tx) => {
    const rows = await tx.eventShift.findMany({
      where: {
        ...shiftScope(partner),
        userId: partner.userId,
        startPlanned: { gte: from, lt: to },
      },
      orderBy: { startPlanned: "desc" },
      select: {
        eventDayId: true,
        startPlanned: true,
        event: {
          select: {
            id: true,
            eventCandidate: { select: { storeName: true } },
            dealers: {
              where: { relationshipId: { in: partner.relationshipIds } },
              select: { relationshipId: true },
            },
          },
        },
      },
    });

    const seen = new Set<string>();
    const out: MyEventChoice[] = [];
    for (const r of rows) {
      const key = `${r.event.id}:${r.eventDayId ?? "none"}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const d = r.startPlanned;
      out.push({
        eventId: r.event.id,
        eventDayId: r.eventDayId,
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        venuePlace: r.event.eventCandidate.storeName,
        originName: originNames.get(r.event.dealers[0]?.relationshipId ?? "") ?? "—",
      });
    }
    return out;
  });
}
