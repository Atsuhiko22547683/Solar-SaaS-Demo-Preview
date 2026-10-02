// 出店希望（LanePreference）の読み出し。パートナー管理者の業務。
//
// 閲覧範囲は lib/partner/scope.ts の relationshipScope（自社が当事者の取引関係すべて）。
// 複数の代理店から依頼を受けている場合は、代理店ごとに別の提出として並ぶ。
//
// 構造:
//   LanePreference            … 対象月 × 依頼先代理店 で 1 件
//   LanePreferenceItem        … laneNo × priority で 1 店舗
//   LanePreferenceMessage     … 提出の記録と代理店の回答（明細を入れ替えても残る）
//
// 希望場所の候補は「代理店が自社に公開しているイベント候補」から作る。
// マスタ（VenueProvider / Store / LineEvent）への任意リンクはパートナー側からは
// 設定しない — 突合は代理店側の作業で、パートナー側は場所のラベルを出すのが役割のため。

import "server-only";

import { labels } from "@/lib/i18n/labels";
import { resolveUserNames } from "@/lib/partner/admin";
import { requirePartnerContext, wholesalerNameMap } from "@/lib/partner/context";
import { DEFAULT_PAGE_SIZE } from "@/lib/partner/list-query";
import { relationshipFilter, relationshipScope } from "@/lib/partner/scope";
import { withTenant } from "@/lib/tenancy/with-tenant";

import { resolveTargetMonth } from "./query";

import type { LanePreferenceListQuery } from "./query";
import type { Prisma } from "@solar/db";

/** 入力補助に出す候補の上限。絞り込んだあとに掛ける（先に打ち切らない）。 */
const CANDIDATE_LIMIT = 200;

/** 代理店が採用して結び付けた催事。希望と違う店舗なら代替提案として区別する。 */
export interface PartnerAdoptionView {
  eventId: string;
  /** 採用された催事の店舗名（開催当時の記録）。 */
  venuePlace: string;
  scheduledDate: string;
  decidedAt: string;
  /** 希望した店舗と違う店舗で採用された（＝代理店からの代替提案）。 */
  isAlternative: boolean;
}

export interface PartnerLaneItemView {
  priority: number;
  /** 店舗マスタの行。古い提出（自由記述のみ）は null。 */
  storeId: string | null;
  venueLabel: string;
  conditionNote: string | null;
  memo: string | null;
  /** この希望に対する代理店の採用結果。 */
  adoptions: PartnerAdoptionView[];
}

export interface PartnerLaneView {
  laneNo: number;
  /** レーン単位の希望日程（明細に同じ配列が入っている。先頭の明細から読む）。 */
  desiredDates: string[];
  items: PartnerLaneItemView[];
}

export interface PartnerThreadEntry {
  id: string;
  side: "DEALER" | "WHOLESALER";
  kind: "MESSAGE" | "SUBMISSION" | "ANSWER";
  body: string;
  authorName: string | null;
  createdAt: string;
}

export interface PartnerLanePreferenceRow {
  id: string;
  targetMonth: string;
  relationshipId: string;
  originName: string;
  laneCount: number | null;
  status: "DRAFT" | "SUBMITTED" | "ANSWERED" | "CONFIRMED";
  submittedAt: string;
  submittedByName: string | null;
  /** 代理店からの回答が付いているか（一覧で分かるように）。 */
  hasAnswer: boolean;
}

export interface ConfirmedEventView {
  eventId: string;
  venuePlace: string;
  days: { date: string; startAt: string | null; endAt: string | null }[];
  mode: string;
  dealerNames: string[];
}

export interface PartnerLanePreferenceDetail extends PartnerLanePreferenceRow {
  note: string | null;
  lanes: PartnerLaneView[];
  thread: PartnerThreadEntry[];
  /** 同じ対象月・同じ代理店で確定した開催。希望との対応は月と代理店で見る。 */
  confirmed: ConfirmedEventView[];
}

/** Json 列（'YYYY-MM-DD' の配列）を安全に配列へ戻す。 */
function toDates(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

/** 明細を laneNo でまとめ、レーン単位のビューにする。 */
function groupLanes(
  items: {
    laneNo: number;
    priority: number;
    storeId?: string | null;
    venueLabel: string;
    desiredDates: unknown;
    conditionNote: string | null;
    memo: string | null;
    adoptions?: PartnerAdoptionView[];
  }[],
): PartnerLaneView[] {
  const byLane = new Map<number, PartnerLaneView>();
  for (const i of items) {
    let lane = byLane.get(i.laneNo);
    if (!lane) {
      lane = { laneNo: i.laneNo, desiredDates: toDates(i.desiredDates), items: [] };
      byLane.set(i.laneNo, lane);
    }
    lane.items.push({
      priority: i.priority,
      storeId: i.storeId ?? null,
      venueLabel: i.venueLabel,
      conditionNote: i.conditionNote,
      memo: i.memo,
      adoptions: i.adoptions ?? [],
    });
  }
  return Array.from(byLane.values())
    .sort((a, b) => a.laneNo - b.laneNo)
    .map((l) => ({ ...l, items: l.items.sort((a, b) => a.priority - b.priority) }));
}

export interface PartnerLanePreferenceListResult {
  rows: PartnerLanePreferenceRow[];
  total: number;
  page: number;
  pageCount: number;
  /** 依頼先代理店の選択肢（自社の取引関係）。 */
  originOptions: { id: string; name: string }[];
}

export async function listPartnerLanePreferences(
  q: LanePreferenceListQuery,
): Promise<PartnerLanePreferenceListResult> {
  const partner = await requirePartnerContext("partner_lane_preference.read");
  const names = wholesalerNameMap(partner);

  return withTenant(partner.ctx, async (tx) => {
    const where: Prisma.LanePreferenceWhereInput = {
      ...relationshipScope(partner),
      ...relationshipFilter(partner, q.origin),
      ...(q.month ? { targetMonth: q.month } : {}),
      ...(q.status ? { status: q.status } : {}),
      // 店舗名・住所のフリーテキストは提出明細の希望店舗に効かせる。
      ...(q.venue
        ? { items: { some: { venueLabel: { contains: q.venue, mode: "insensitive" } } } }
        : {}),
    };

    const orderBy: Prisma.LanePreferenceOrderByWithRelationInput[] = [
      { [q.sort.field]: q.sort.direction },
      { id: "asc" },
    ];

    const [total, rows] = await Promise.all([
      tx.lanePreference.count({ where }),
      tx.lanePreference.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * DEFAULT_PAGE_SIZE,
        take: DEFAULT_PAGE_SIZE,
        select: {
          id: true,
          targetMonth: true,
          relationshipId: true,
          laneCount: true,
          status: true,
          submittedAt: true,
          submittedBy: true,
          _count: { select: { items: true, messages: { where: { kind: "ANSWER" } } } },
        },
      }),
    ]);

    const submitterNames = await resolveUserNames(
      tx,
      rows.map((r) => r.submittedBy),
    );

    return {
      rows: rows.map((r) => ({
        id: r.id,
        targetMonth: r.targetMonth,
        relationshipId: r.relationshipId,
        originName: names.get(r.relationshipId) ?? "—",
        laneCount: r.laneCount,
        status: r.status,
        submittedAt: r.submittedAt.toISOString(),
        submittedByName: submitterNames.get(r.submittedBy) ?? null,
        hasAnswer: r._count.messages > 0,
      })),
      total,
      page: q.page,
      pageCount: Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE)),
      originOptions: partner.relationships.map((r) => ({ id: r.id, name: r.wholesalerName })),
    };
  });
}

export async function getPartnerLanePreferenceDetail(
  id: string,
): Promise<PartnerLanePreferenceDetail | null> {
  const partner = await requirePartnerContext("partner_lane_preference.read");
  const names = wholesalerNameMap(partner);

  return withTenant(partner.ctx, async (tx) => {
    // 閲覧範囲を where に含める（id だけで引かない）。
    const p = await tx.lanePreference.findFirst({
      where: { id, ...relationshipScope(partner) },
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
            laneNo: true,
            priority: true,
            storeId: true,
            adoptions: {
              orderBy: { decidedAt: "asc" },
              select: {
                eventId: true,
                decidedAt: true,
                event: {
                  select: {
                    eventCandidate: {
                      select: { storeId: true, storeName: true, scheduledDate: true },
                    },
                  },
                },
              },
            },
            venueLabel: true,
            desiredDates: true,
            conditionNote: true,
            memo: true,
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

    // 確定した開催。同じ対象月・同じ依頼先代理店で、自社が担当会社になっている催事。
    // 希望明細との一対一の対応は持たない（代理店の確定作業の結果なので、月と代理店で見る）。
    const events = await tx.event.findMany({
      where: {
        eventCandidate: { targetMonth: p.targetMonth },
        dealers: { some: { relationshipId: p.relationshipId } },
      },
      orderBy: { eventCandidate: { scheduledDate: "asc" } },
      select: {
        id: true,
        mode: true,
        eventCandidate: { select: { storeName: true, scheduledDate: true } },
        days: {
          orderBy: { eventDate: "asc" },
          select: { eventDate: true, startAt: true, endAt: true },
        },
        dealers: { select: { relationshipId: true } },
      },
    });

    const userIds = [p.submittedBy, ...p.messages.map((m) => m.authorUserId)];
    const userNames = await resolveUserNames(tx, userIds);

    // 担当会社の表示。自社の取引関係は名前が引けるので出し、他社ぶんは件数だけに留める
    // （共同開催の相手先まで開示しない）。
    const dealerNamesFor = (rels: { relationshipId: string }[]): string[] => {
      const own = rels.filter((r) => partner.relationshipIds.includes(r.relationshipId));
      const others = rels.length - own.length;
      const out: string[] = own.map(() => labels.partner.common.selfCompany);
      if (others > 0) out.push(`他 ${others} 社`);
      return out;
    };

    return {
      id: p.id,
      targetMonth: p.targetMonth,
      relationshipId: p.relationshipId,
      originName: names.get(p.relationshipId) ?? "—",
      laneCount: p.laneCount,
      status: p.status,
      note: p.note,
      submittedAt: p.submittedAt.toISOString(),
      submittedByName: userNames.get(p.submittedBy) ?? null,
      hasAnswer: p.messages.some((m) => m.kind === "ANSWER"),
      // 採用結果を明細へ載せる。希望した店舗と違う催事なら代替提案として区別する。
      lanes: groupLanes(
        p.items.map((i) => ({
          ...i,
          adoptions: i.adoptions.map((ad) => ({
            eventId: ad.eventId,
            venuePlace: ad.event.eventCandidate.storeName,
            scheduledDate: ad.event.eventCandidate.scheduledDate.toISOString(),
            decidedAt: ad.decidedAt.toISOString(),
            isAlternative: i.storeId !== null && ad.event.eventCandidate.storeId !== i.storeId,
          })),
        })),
      ),
      thread: p.messages.map((m) => ({
        id: m.id,
        side: m.side,
        kind: m.kind,
        body: m.body,
        authorName: userNames.get(m.authorUserId) ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
      confirmed: events.map((e) => ({
        eventId: e.id,
        venuePlace: e.eventCandidate.storeName,
        days:
          e.days.length > 0
            ? e.days.map((d) => ({
                date: d.eventDate.toISOString(),
                startAt: d.startAt?.toISOString() ?? null,
                endAt: d.endAt?.toISOString() ?? null,
              }))
            : // 開催日が未登録の催事は候補の予定日に倒す（架空の日付は作らない）。
              [
                {
                  date: e.eventCandidate.scheduledDate.toISOString(),
                  startAt: null,
                  endAt: null,
                },
              ],
        mode: e.mode,
        dealerNames: dealerNamesFor(e.dealers),
      })),
    };
  });
}

export interface LanePreferenceFormData {
  /** 編集対象。新規なら null。 */
  existing: PartnerLanePreferenceDetail | null;
  targetMonth: string;
  originOptions: { id: string; name: string }[];
  /** 取引先が 1 社なら選択させない。 */
  soleOriginId: string | null;
  /**
   * 希望場所の候補（代理店の店舗マスタ）。
   *
   * 以前は公開中のイベント候補の店舗名を入力補助に出すだけで、提出は自由記述だった。
   * そのため「カインズ 大宮店」と書いた希望が、店舗マスタのどの行を指すのか決まらなかった。
   * いまは店舗マスタの行そのものを選ばせ、保存値は店舗 ID にする。
   * 同名の店舗があっても所在地・場所提供元で見分けられるよう、両方を候補に持たせる。
   */
  candidates: {
    storeId: string;
    name: string;
    venueProviderName: string | null;
    address: string | null;
    areaName: string | null;
  }[];
  candidateTotal: number;
}

/**
 * 提出フォーム用のデータ。候補はエリア・店舗名/住所・対象月で絞り込める。
 * 絞り込みは DB 側で行い、上限は絞り込んだあとに掛ける。
 */
export async function getLanePreferenceFormData(
  id: string | null,
  q: LanePreferenceListQuery,
): Promise<LanePreferenceFormData> {
  const partner = await requirePartnerContext("partner_lane_preference.read");
  const existing = id ? await getPartnerLanePreferenceDetail(id) : null;
  const targetMonth = existing?.targetMonth ?? resolveTargetMonth(q.month);

  return withTenant(partner.ctx, async (tx) => {
    // 候補は取引のある代理店の店舗マスタ。カタログと同じく、アプリ層でも代理店を
    // 明示して絞る（RLS と二重）。停止中の店舗は候補に出さない。
    //
    // 月では絞らない。対象月は希望日程の軸であって、店舗の属性ではないため。
    const storeWhere: Prisma.StoreWhereInput = {
      wholesalerId: { in: partner.relationships.map((r) => r.wholesalerId) },
      isActive: true,
      ...(q.venue
        ? {
            OR: [
              { name: { contains: q.venue, mode: "insensitive" } },
              { address: { contains: q.venue, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(q.area ? { area: { name: { contains: q.area, mode: "insensitive" } } } : {}),
    };

    const [storeRows, candidateTotal] = await Promise.all([
      tx.store.findMany({
        where: storeWhere,
        orderBy: [{ venueProvider: { name: "asc" } }, { name: "asc" }],
        take: CANDIDATE_LIMIT,
        select: {
          id: true,
          name: true,
          address: true,
          venueProvider: { select: { name: true } },
          area: { select: { name: true } },
        },
      }),
      tx.store.count({ where: storeWhere }),
    ]);

    const candidates: LanePreferenceFormData["candidates"] = storeRows.map((st) => ({
      storeId: st.id,
      name: st.name,
      venueProviderName: st.venueProvider?.name ?? null,
      address: st.address,
      areaName: st.area?.name ?? null,
    }));

    return {
      existing,
      targetMonth,
      originOptions: partner.relationships.map((r) => ({ id: r.id, name: r.wholesalerName })),
      soleOriginId: partner.soleRelationshipId,
      candidates,
      candidateTotal,
    };
  });
}
