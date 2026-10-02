// 代理店側：出店希望 1 件の詳細（回答するための読み出し）と、場所確保の相談。
//
// 一覧（listLanePreferences）は月まとめのアコーディオン向けなので、回答画面では
// 1 件ぶんをレーン単位に組み直して読む。

import "server-only";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { TenantContext, TxClient } from "@solar/db";

export interface AgencyThreadEntry {
  id: string;
  side: "DEALER" | "WHOLESALER";
  kind: "MESSAGE" | "SUBMISSION" | "ANSWER";
  body: string;
  authorName: string | null;
  createdAt: string;
}

/** 採用して確定したイベント。1 明細が複数イベントになりうる。 */
export interface AgencyAdoptionView {
  eventId: string;
  eventCandidateId: string;
  storeNameAtEvent: string;
  /** 採用した催事の店舗。希望店舗と違えば代理店からの代替提案。 */
  eventStoreId: string | null;
  scheduledDate: string;
  decidedAt: string;
}

export interface AgencyLaneItemView {
  /** 明細 id。採用操作の対象になる。 */
  id: string;
  priority: number;
  venueLabel: string;
  conditionNote: string | null;
  memo: string | null;
  /** 店舗マスタ紐付き。紐付いていなければ提供元も出さない。 */
  storeId: string | null;
  storeName: string | null;
  venueProviderName: string | null;
  adoptions: AgencyAdoptionView[];
}

export interface AgencyLaneView {
  laneNo: number;
  desiredDates: string[];
  items: AgencyLaneItemView[];
}

export interface AgencyLanePreferenceDetail {
  id: string;
  targetMonth: string;
  dealerName: string;
  laneCount: number | null;
  status: "DRAFT" | "SUBMITTED" | "ANSWERED" | "CONFIRMED";
  note: string | null;
  submittedAt: string;
  lanes: AgencyLaneView[];
  thread: AgencyThreadEntry[];
}

async function requireReadContext(): Promise<TenantContext> {
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
    action: "lane_preference.read",
  });
  return ctx;
}

function toDates(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

async function resolveNames(tx: TxClient, ids: readonly string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const rows = await tx.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r) => [r.id, r.name]));
}

export async function getAgencyLanePreference(
  id: string,
): Promise<AgencyLanePreferenceDetail | null> {
  const ctx = await requireReadContext();

  return withTenant(ctx, async (tx) => {
    const p = await tx.lanePreference.findFirst({
      where: { id },
      select: {
        id: true,
        targetMonth: true,
        relationshipId: true,
        laneCount: true,
        status: true,
        note: true,
        submittedAt: true,
        submittedBy: true,
        items: {
          orderBy: [{ laneNo: "asc" }, { priority: "asc" }],
          select: {
            id: true,
            laneNo: true,
            priority: true,
            venueLabel: true,
            desiredDates: true,
            conditionNote: true,
            memo: true,
            storeId: true,
            adoptions: {
              orderBy: { decidedAt: "asc" },
              select: {
                eventId: true,
                decidedAt: true,
                event: {
                  select: {
                    eventCandidate: {
                      select: { id: true, storeId: true, storeName: true, scheduledDate: true },
                    },
                  },
                },
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            side: true,
            kind: true,
            body: true,
            authorUserId: true,
            createdAt: true,
          },
        },
      },
    });
    if (!p) return null;

    const rel = await tx.relationship.findFirst({
      where: { id: p.relationshipId },
      select: { dealer: { select: { name: true } } },
    });
    const names = await resolveNames(tx, [p.submittedBy, ...p.messages.map((m) => m.authorUserId)]);

    // 店舗名・場所提供元は店舗マスタ経由でだけ解決する。明細に単独でぶら下がった
    // venueProviderId は店舗との整合を確かめられないので使わない。
    const storeIds = [...new Set(p.items.map((i) => i.storeId).filter((v): v is string => !!v))];
    const storeRows =
      storeIds.length > 0
        ? await tx.store.findMany({
            where: { id: { in: storeIds } },
            select: { id: true, name: true, venueProvider: { select: { name: true } } },
          })
        : [];
    const storeById = new Map(storeRows.map((st) => [st.id, st]));

    const byLane = new Map<number, AgencyLaneView>();
    for (const i of p.items) {
      let lane = byLane.get(i.laneNo);
      if (!lane) {
        lane = { laneNo: i.laneNo, desiredDates: toDates(i.desiredDates), items: [] };
        byLane.set(i.laneNo, lane);
      }
      const st = i.storeId ? (storeById.get(i.storeId) ?? null) : null;
      lane.items.push({
        id: i.id,
        priority: i.priority,
        venueLabel: i.venueLabel,
        conditionNote: i.conditionNote,
        memo: i.memo,
        storeId: i.storeId ?? null,
        storeName: st?.name ?? null,
        venueProviderName: st?.venueProvider?.name ?? null,
        adoptions: i.adoptions.map((ad) => ({
          eventId: ad.eventId,
          eventCandidateId: ad.event.eventCandidate.id,
          storeNameAtEvent: ad.event.eventCandidate.storeName,
          eventStoreId: ad.event.eventCandidate.storeId,
          scheduledDate: ad.event.eventCandidate.scheduledDate.toISOString(),
          decidedAt: ad.decidedAt.toISOString(),
        })),
      });
    }

    return {
      id: p.id,
      targetMonth: p.targetMonth,
      dealerName: rel?.dealer.name ?? "—",
      laneCount: p.laneCount,
      status: p.status,
      note: p.note,
      submittedAt: p.submittedAt.toISOString(),
      lanes: Array.from(byLane.values()).sort((a, b) => a.laneNo - b.laneNo),
      thread: p.messages.map((m) => ({
        id: m.id,
        side: m.side,
        kind: m.kind,
        body: m.body,
        authorName: names.get(m.authorUserId) ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  });
}

export interface AgencyConsultationRow {
  id: string;
  title: string;
  dealerName: string;
  area: string | null;
  targetMonth: string | null;
  status: "OPEN" | "ANSWERED" | "CLOSED";
  createdAt: string;
}

export async function listAgencyConsultations(filter: {
  status?: string;
  keyword?: string;
}): Promise<AgencyConsultationRow[]> {
  const ctx = await requireReadContext();

  return withTenant(ctx, async (tx) => {
    const rows = await tx.venueConsultation.findMany({
      where: {
        ...(filter.status ? { status: filter.status as "OPEN" | "ANSWERED" | "CLOSED" } : {}),
        ...(filter.keyword
          ? {
              OR: [
                { title: { contains: filter.keyword, mode: "insensitive" } },
                { body: { contains: filter.keyword, mode: "insensitive" } },
                { area: { contains: filter.keyword, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        area: true,
        targetMonth: true,
        status: true,
        createdAt: true,
        relationship: { select: { dealer: { select: { name: true } } } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      dealerName: r.relationship.dealer.name,
      area: r.area,
      targetMonth: r.targetMonth,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
  });
}

export interface AgencyConsultationDetail extends AgencyConsultationRow {
  body: string;
  thread: AgencyThreadEntry[];
}

export async function getAgencyConsultation(id: string): Promise<AgencyConsultationDetail | null> {
  const ctx = await requireReadContext();

  return withTenant(ctx, async (tx) => {
    const r = await tx.venueConsultation.findFirst({
      where: { id },
      select: {
        id: true,
        title: true,
        body: true,
        area: true,
        targetMonth: true,
        status: true,
        createdAt: true,
        relationship: { select: { dealer: { select: { name: true } } } },
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            side: true,
            kind: true,
            body: true,
            authorUserId: true,
            createdAt: true,
          },
        },
      },
    });
    if (!r) return null;
    const names = await resolveNames(
      tx,
      r.messages.map((m) => m.authorUserId),
    );
    return {
      id: r.id,
      title: r.title,
      body: r.body,
      dealerName: r.relationship.dealer.name,
      area: r.area,
      targetMonth: r.targetMonth,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      thread: r.messages.map((m) => ({
        id: m.id,
        side: m.side,
        kind: m.kind,
        body: m.body,
        authorName: names.get(m.authorUserId) ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  });
}

/**
 * 採用先に選べる確定イベント（対象月ぶん）。
 *
 * 候補（EventCandidate）ではなく、開催が決まった Event を持つものだけを出す。
 * 希望を採用するのは「開催が決まった催事に対して」なので、候補のままの行は出さない。
 */
export async function listAdoptableEvents(targetMonth: string): Promise<
  Array<{
    eventId: string;
    eventCandidateId: string;
    storeName: string;
    /** 催事の店舗マスタ参照。希望店舗と突き合わせて代替提案かどうかを見分ける。 */
    storeId: string | null;
    scheduledDate: string;
  }>
> {
  const ctx = await requireReadContext();
  return withTenant(ctx, async (tx) => {
    const rows = await tx.event.findMany({
      where: { eventCandidate: { targetMonth } },
      orderBy: { eventCandidate: { scheduledDate: "asc" } },
      take: 200,
      select: {
        id: true,
        eventCandidate: {
          select: { id: true, storeId: true, storeName: true, scheduledDate: true },
        },
      },
    });
    return rows.map((r) => ({
      eventId: r.id,
      eventCandidateId: r.eventCandidate.id,
      storeName: r.eventCandidate.storeName,
      storeId: r.eventCandidate.storeId,
      scheduledDate: r.eventCandidate.scheduledDate.toISOString(),
    }));
  });
}
