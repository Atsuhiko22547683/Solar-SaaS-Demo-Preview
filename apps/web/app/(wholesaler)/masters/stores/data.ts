// Server-side data loaders for the store master pages (店舗マスタ).
//
// RSC ローダー: Server Action と同じ三段ガード (auth → assertCan(store.read)
// → withTenant) を踏み、許可外ロールは assertCan で 403 落ち、他テナント行は
// RLS により findUnique で null になる。area の data.ts と同じ構造。

import "server-only";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

export interface StoreListItem {
  id: string;
  name: string;
  isActive: boolean;
  venueProviderId: string | null;
  venueProviderName: string | null;
  postalCode: string | null;
  address: string | null;
  /** 所在地の都道府県。住所の先頭から取る（管理エリアとは別物）。 */
  prefecture: string | null;
  areaId: string | null;
  /** 業務上の管理エリア（催事の分類・検索に使う区分）。所在地の都道府県とは別。 */
  areaName: string | null;
  /** この店舗で予定・実施した催事の件数（マスタ紐付き分）。 */
  eventCount: number;
  /** この店舗を希望している出店希望明細の件数（マスタ紐付き分）。 */
  lanePreferenceCount: number;
  updatedAt: string;
}

/** 住所の先頭から都道府県を取り出す。取れなければ null（推測で埋めない）。 */
const PREFECTURE_RE =
  /^(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/;

export function prefectureOf(address: string | null): string | null {
  if (!address) return null;
  const m = PREFECTURE_RE.exec(address.trim());
  return m ? m[1]! : null;
}

/** 店舗詳細。関連する催事と出店希望も一緒に返す（店舗からの逆引き導線）。 */
export interface StoreDetail extends StoreListItem {
  createdAt: string;
  relatedEvents: StoreRelatedEvent[];
  relatedPreferences: StoreRelatedPreference[];
}

/**
 * 店舗詳細に出す関連する出店希望。
 *
 * 紐付けは storeId だけを根拠にする。希望場所の名称が似ているだけの未登録の希望は
 * 混ぜない（「カインズ 大宮店」と「大宮店」は別の店舗でありうるため）。
 */
export interface StoreRelatedPreference {
  lanePreferenceId: string;
  targetMonth: string;
  dealerName: string;
  laneNo: number;
  priority: number;
  /** パートナーが書いた希望場所の名称（マスタ名と違うことがある）。 */
  venueLabel: string;
}

/** 店舗詳細に出す関連催事。名前一致の推測ではなく、マスタ紐付き分だけを出す。 */
export interface StoreRelatedEvent {
  eventCandidateId: string;
  /** 確定イベント。候補のままなら null。 */
  eventId: string | null;
  scheduledDate: string;
  targetMonth: string;
  status: string;
  /** 開催当時に記録された店舗名（改称後も過去の見え方を保つ）。 */
  storeNameAtEvent: string;
}

export interface VenueProviderOption {
  id: string;
  name: string;
}

/** 開催エリアの候補（AreaType.EVENT のみ）。顧客エリアは混ぜない。 */
export interface EventAreaOption {
  id: string;
  name: string;
}

async function requireWholesalerCtx() {
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
    action: "store.read",
    resource: ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined,
  });
  return ctx;
}

export interface ListFilter {
  /** 店舗名・住所のフリーテキスト（部分一致）。 */
  name?: string;
  /** 管理エリア（Area.id）。 */
  areaId?: string;
  /** 場所提供元（VenueProvider.id）。 */
  venueProviderId?: string;
  isActive?: boolean;
}

export async function listStores(filter: ListFilter = {}): Promise<StoreListItem[]> {
  const ctx = await requireWholesalerCtx();
  return withTenant(ctx, async (tx) => {
    const rows = await tx.store.findMany({
      where: {
        // フリーテキストは店名と住所の両方に効かせる（どちらで覚えていても探せる）。
        ...(filter.name && filter.name.length > 0
          ? {
              OR: [
                { name: { contains: filter.name, mode: "insensitive" } },
                { address: { contains: filter.name, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(filter.areaId ? { areaId: filter.areaId } : {}),
        ...(filter.venueProviderId ? { venueProviderId: filter.venueProviderId } : {}),
        ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}),
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        isActive: true,
        venueProviderId: true,
        postalCode: true,
        address: true,
        areaId: true,
        updatedAt: true,
        venueProvider: { select: { name: true } },
        area: { select: { name: true } },
        _count: { select: { eventCandidates: true } },
      },
    });

    // 出店希望は FK を張っていない柔リンク（LanePreferenceItem.storeId）なので、
    // 件数はまとめて 1 回で数える。名称一致では数えない。
    const ids = rows.map((r) => r.id);
    const prefCounts =
      ids.length > 0
        ? await tx.lanePreferenceItem.groupBy({
            by: ["storeId"],
            where: { storeId: { in: ids } },
            _count: { _all: true },
          })
        : [];
    const prefCountByStore = new Map(prefCounts.map((c) => [c.storeId as string, c._count._all]));

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      isActive: r.isActive,
      venueProviderId: r.venueProviderId,
      venueProviderName: r.venueProvider?.name ?? null,
      postalCode: r.postalCode,
      address: r.address,
      prefecture: prefectureOf(r.address),
      areaId: r.areaId,
      areaName: r.area?.name ?? null,
      eventCount: r._count.eventCandidates,
      lanePreferenceCount: prefCountByStore.get(r.id) ?? 0,
      updatedAt: r.updatedAt.toISOString(),
    }));
  });
}

export async function getStore(id: string): Promise<StoreDetail | null> {
  const ctx = await requireWholesalerCtx();
  return withTenant(ctx, async (tx) => {
    const r = await tx.store.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        isActive: true,
        venueProviderId: true,
        postalCode: true,
        address: true,
        areaId: true,
        createdAt: true,
        updatedAt: true,
        venueProvider: { select: { name: true } },
        area: { select: { name: true } },
      },
    });
    if (!r) return null;
    // 店舗 → 催事の逆引き。マスタに紐付いた候補だけを出す（名前一致の推測はしない）。
    const cands = await tx.eventCandidate.findMany({
      where: { storeId: id },
      orderBy: { scheduledDate: "desc" },
      take: 50,
      select: {
        id: true,
        scheduledDate: true,
        targetMonth: true,
        status: true,
        storeName: true,
        event: { select: { id: true } },
      },
    });
    // 店舗 → 出店希望の逆引き。柔リンク（storeId）だけを根拠にする。
    const prefItems = await tx.lanePreferenceItem.findMany({
      where: { storeId: id },
      orderBy: [{ laneNo: "asc" }, { priority: "asc" }],
      take: 50,
      select: {
        laneNo: true,
        priority: true,
        venueLabel: true,
        lanePreferenceId: true,
      },
    });

    // 提出（LanePreference）と取引先名は別引き。LanePreference には relationship の
    // リレーションが無く relationshipId だけを持つので、同じ tx 内でまとめて解決する。
    const prefIds = [...new Set(prefItems.map((it) => it.lanePreferenceId))];
    const prefs =
      prefIds.length > 0
        ? await tx.lanePreference.findMany({
            where: { id: { in: prefIds } },
            select: { id: true, targetMonth: true, relationshipId: true },
          })
        : [];
    const relIds = [...new Set(prefs.map((x) => x.relationshipId))];
    const rels =
      relIds.length > 0
        ? await tx.relationship.findMany({
            where: { id: { in: relIds } },
            select: { id: true, dealer: { select: { name: true } } },
          })
        : [];
    const dealerByRel = new Map(rels.map((x) => [x.id, x.dealer.name]));
    const prefById = new Map(prefs.map((x) => [x.id, x]));

    return {
      id: r.id,
      name: r.name,
      isActive: r.isActive,
      venueProviderId: r.venueProviderId,
      venueProviderName: r.venueProvider?.name ?? null,
      postalCode: r.postalCode,
      address: r.address,
      prefecture: prefectureOf(r.address),
      areaId: r.areaId,
      areaName: r.area?.name ?? null,
      eventCount: cands.length,
      lanePreferenceCount: prefItems.length,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      relatedPreferences: prefItems.map((it) => {
        const pref = prefById.get(it.lanePreferenceId);
        return {
          lanePreferenceId: it.lanePreferenceId,
          targetMonth: pref?.targetMonth ?? "—",
          dealerName: pref ? (dealerByRel.get(pref.relationshipId) ?? "—") : "—",
          laneNo: it.laneNo,
          priority: it.priority,
          venueLabel: it.venueLabel,
        };
      }),
      relatedEvents: cands.map((cnd) => ({
        eventCandidateId: cnd.id,
        eventId: cnd.event?.id ?? null,
        scheduledDate: cnd.scheduledDate.toISOString(),
        targetMonth: cnd.targetMonth,
        status: cnd.status,
        storeNameAtEvent: cnd.storeName,
      })),
    };
  });
}

export async function listVenueProviderOptions(): Promise<VenueProviderOption[]> {
  const ctx = await requireWholesalerCtx();
  return withTenant(ctx, async (tx) => {
    const rows = await tx.venueProvider.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return rows.map((r) => ({ id: r.id, name: r.name }));
  });
}

/** 開催エリア候補（AreaType.EVENT）。顧客エリアは値域が別なので混ぜない。 */
export async function listEventAreaOptions(): Promise<EventAreaOption[]> {
  const ctx = await requireWholesalerCtx();
  return withTenant(ctx, async (tx) => {
    const rows = await tx.area.findMany({
      where: { isActive: true, type: "EVENT" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return rows.map((r) => ({ id: r.id, name: r.name }));
  });
}

/** 一覧の絞り込み候補（管理エリア / 場所提供元）。 */
export async function listStoreFilterOptions(): Promise<{
  areas: EventAreaOption[];
  venueProviders: VenueProviderOption[];
}> {
  const ctx = await requireWholesalerCtx();
  return withTenant(ctx, async (tx) => {
    const [areas, providers] = await Promise.all([
      tx.area.findMany({
        where: { isActive: true, type: "EVENT" },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      tx.venueProvider.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);
    return { areas, venueProviders: providers };
  });
}
