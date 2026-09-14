// 二次店ポータル：アポイントのデータローダー。
//
// 1 件 = Customer 1 行 + Appointment 1 行。二次店が登録した顧客は
// Customer.registeredByRelationshipId に自社の relationshipId が入るので、
// これを取得条件にする（URL の id 書き換えでは他社の行に届かない）。

import "server-only";

import { fromFaceToFaceBoolean } from "@solar/contracts";

import { requirePartnerContext } from "@/lib/partner/context";
import {
  CUSTOMER_VENUE_SELECT,
  EVENT_VENUE_SELECT,
  resolveVenueInfo,
} from "@/lib/partner/venue-info";
import { withTenant } from "@/lib/tenancy/with-tenant";

export interface PartnerAppointmentListItem {
  id: string;
  customerName: string;
  firstVisitAt: string | null;
  venuePlace: string | null;
  createdAt: string;
}

export interface PartnerAppointmentDetail {
  id: string;
  tossDept: string | null;
  tossUpSalespersonId: string | null;
  tossUpSalespersonName: string | null;
  closingSalespersonId: string | null;
  closingSalespersonName: string | null;
  salesChannel: string | null;
  sourceEventId: string | null;
  /**
   * 催事情報。イベントを選んでいればイベント側、選んでいなければ顧客の
   * source* 列から解決する（lib/partner/venue-info.ts の 1 関数に集約）。
   */
  eventDate: string | null;
  venuePlace: string | null;
  venueChain: string | null;
  boothArea: string | null;
  boothAreaNote: string | null;
  /** 催事情報が登録済みイベント由来か。 */
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

export async function listPartnerAppointments(): Promise<PartnerAppointmentListItem[]> {
  const partner = await requirePartnerContext("partner_appointment.read");
  return withTenant(partner.ctx, async (tx) => {
    const rows = await tx.customer.findMany({
      where: { registeredByRelationshipId: partner.relationshipId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        createdAt: true,
        // 一覧の催事場所。イベント選択時はイベント側、未選択時は source 列。
        sourceVenuePlace: true,
        sourceEvent: { select: { eventCandidate: { select: { storeName: true } } } },
        appointments: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { scheduledAt: true },
        },
      },
    });
    return rows.map((r) => {
      const appt = r.appointments[0];
      return {
        id: r.id,
        customerName: r.name,
        firstVisitAt: appt?.scheduledAt ? appt.scheduledAt.toISOString() : null,
        venuePlace: r.sourceEvent?.eventCandidate.storeName ?? r.sourceVenuePlace ?? null,
        createdAt: r.createdAt.toISOString(),
      };
    });
  });
}

export async function getPartnerAppointment(id: string): Promise<PartnerAppointmentDetail | null> {
  const partner = await requirePartnerContext("partner_appointment.read");
  return withTenant(partner.ctx, async (tx) => {
    const c = await tx.customer.findFirst({
      where: { id, registeredByRelationshipId: partner.relationshipId },
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
        tossDept: true,
        salesChannel: true,
        faceToFace: true,
        maekakuPreferredAt: true,
        maekakuOperator: true,
        tossUpSalespersonId: true,
        closingSalespersonId: true,
        ...CUSTOMER_VENUE_SELECT,
        createdAt: true,
        appointments: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { scheduledAt: true, location: true },
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
          where: { id: { in: salespersonIds }, relationshipId: partner.relationshipId },
          select: { id: true, name: true },
        })
      : [];
    const nameOf = (id: string | null) =>
      id ? (salespeople.find((s) => s.id === id)?.name ?? null) : null;

    // 催事情報。イベントを選んでいればそこから、無ければ Appointment.location のみ。
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
      tossDept: c.tossDept,
      tossUpSalespersonId: c.tossUpSalespersonId,
      tossUpSalespersonName: nameOf(c.tossUpSalespersonId),
      closingSalespersonId: c.closingSalespersonId,
      closingSalespersonName: nameOf(c.closingSalespersonId),
      salesChannel: c.salesChannel,
      sourceEventId: c.sourceEventId,
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

/** 催事セレクトの選択肢（自社が担当に割り当てられたイベントのみ）。 */
export async function listPartnerEventOptions(): Promise<{ id: string; label: string }[]> {
  const partner = await requirePartnerContext("partner_appointment.read");
  return withTenant(partner.ctx, async (tx) => {
    const rows = await tx.eventDealer.findMany({
      where: { relationshipId: partner.relationshipId },
      select: {
        event: {
          select: {
            id: true,
            eventCandidate: { select: { scheduledDate: true, storeName: true } },
          },
        },
      },
      take: 100,
    });
    return rows
      .map((r) => ({
        id: r.event.id,
        date: r.event.eventCandidate.scheduledDate,
        store: r.event.eventCandidate.storeName,
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map((r) => ({
        id: r.id,
        label: `${r.date.toISOString().slice(0, 10).replace(/-/g, "/")} ${r.store}`,
      }));
  });
}
