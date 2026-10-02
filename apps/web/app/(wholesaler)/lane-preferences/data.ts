// Server-side loader + action for 二次店レーン希望 (F-060 / ボトムアップ構造 / docs/05 §3.4.5).
//
// listLanePreferences: 卸業者の一覧確認 (S-089)。三段イディオム auth →
// assertCan('lane_preference.read') → withTenant。RLS (SET LOCAL) が cross-tenant 行を
// 不可視化し、assertCan が dealer ロールを ForbiddenError で弾く。
// 任意リンク (venueProviderId / storeId / lineEventId) の name は同一 withTenant tx 内の
// bulk findMany → Map で解決（別テナント id をリンクしても name は null＝漏えいなし）。
// LineEvent は name のみ select し fixedFee / performanceRate / scheduledDates は select しない
// （卸非公開・不要 / CLAUDE.md #5）。
//
// saveLanePreference: 二次店提出 (F-021 連動)。assertCan('lane_preference.write')。
// relationshipId は ctx 由来（送信値不信用）、対象月 × relationship 一意で upsert、
// priority はサーバ再採番。

import "server-only";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { LanePreferenceDto, LanePreferenceItemDto } from "@solar/contracts";

// 二次店プルダウンは line-events と同じ ACTIVE relationship 一覧を再利用する。
export { listActiveDealers as listActiveRelationships } from "../event-detail/data";
export type { DealerOption } from "../event-detail/data";

// data.ts では DTO の重複定義をやめ contracts の型を re-export する（§3.4.4）。
export type {
  LanePreferenceDto,
  LanePreferenceItemDto,
  DesiredDates,
  SaveLanePreferenceInput,
} from "@solar/contracts";

async function buildActor() {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError({
      code: "INVALID_CREDENTIALS",
      message: "Session missing — sign in is required",
    });
  }
  const ctx = await getTenantContext();
  return {
    ctx,
    user: {
      userId: ctx.actorUserId,
      roles: session.user.roles,
      isSaasAdmin: ctx.isSaasAdmin,
      tenantId: ctx.tenantId,
      wholesalerId: ctx.wholesalerId,
      dealerId: ctx.dealerId,
      relationshipIds: ctx.relationshipIds,
    },
  };
}

async function requireWholesalerCtx() {
  const { ctx, user } = await buildActor();
  assertCan({
    user,
    action: "lane_preference.read",
    resource: ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined,
  });
  return ctx;
}

export interface LanePreferenceFilter {
  targetMonth?: string;
  relationshipId?: string;
}

export async function listLanePreferences(
  filter: LanePreferenceFilter = {},
): Promise<LanePreferenceDto[]> {
  const ctx = await requireWholesalerCtx();
  return withTenant(ctx, async (tx) => {
    const prefs = await tx.lanePreference.findMany({
      where: {
        ...(filter.targetMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(filter.targetMonth)
          ? { targetMonth: filter.targetMonth }
          : {}),
        ...(filter.relationshipId ? { relationshipId: filter.relationshipId } : {}),
      },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        relationshipId: true,
        targetMonth: true,
        note: true,
        submittedAt: true,
        status: true,
        laneCount: true,
        items: {
          // レーン番号 → 順位の順で並べる。priority だけで並べると別レーンの
          // 第一希望どうしが混ざり、レーンの区別が画面から消える。
          orderBy: [{ laneNo: "asc" }, { priority: "asc" }],
          select: {
            id: true,
            laneNo: true,
            priority: true,
            venueLabel: true,
            venueProviderId: true,
            storeId: true,
            lineEventId: true,
            desiredDates: true,
            memo: true,
            conditionNote: true,
            adoptions: {
              select: {
                eventId: true,
                decidedAt: true,
                event: {
                  select: {
                    eventCandidate: {
                      select: { id: true, storeName: true, scheduledDate: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (prefs.length === 0) return [];

    // 任意リンクの name 解決（同一 withTenant tx 内 bulk findMany → Map。各マスタの
    // 自テナント RLS が二重に効くため、別テナント id をリンクしても name は null）。
    const relationshipIds = Array.from(new Set(prefs.map((p) => p.relationshipId)));
    const venueProviderIds = Array.from(
      new Set(
        prefs.flatMap((p) =>
          p.items
            .map((i) => i.venueProviderId)
            .filter((v): v is string => v !== null && v !== undefined),
        ),
      ),
    );
    const storeIds = Array.from(
      new Set(
        prefs.flatMap((p) =>
          p.items.map((i) => i.storeId).filter((v): v is string => v !== null && v !== undefined),
        ),
      ),
    );
    const lineEventIds = Array.from(
      new Set(
        prefs.flatMap((p) =>
          p.items
            .map((i) => i.lineEventId)
            .filter((v): v is string => v !== null && v !== undefined),
        ),
      ),
    );

    // 店舗マスタは「店舗 → 親チェーン」も一緒に取る。場所提供元の表示は必ず
    // 店舗マスタ経由に限定して、ラベルと提供元がちぐはぐな組合せを画面に出さない。
    const [rels, venueProviders, stores, lineEvents] = await Promise.all([
      tx.relationship.findMany({
        where: { id: { in: relationshipIds } },
        select: { id: true, dealer: { select: { name: true } } },
      }),
      venueProviderIds.length > 0
        ? tx.venueProvider.findMany({
            where: { id: { in: venueProviderIds } },
            select: { id: true, name: true },
          })
        : [],
      storeIds.length > 0
        ? tx.store.findMany({
            where: { id: { in: storeIds } },
            select: { id: true, name: true, venueProvider: { select: { id: true, name: true } } },
          })
        : [],
      // LineEvent は name のみ — fixedFee / performanceRate / scheduledDates は select しない。
      lineEventIds.length > 0
        ? tx.lineEvent.findMany({
            where: { id: { in: lineEventIds } },
            select: { id: true, name: true },
          })
        : [],
    ]);

    const dealerNameByRel = new Map(rels.map((r) => [r.id, r.dealer.name]));
    const providerNameById = new Map(venueProviders.map((p) => [p.id, p.name]));
    const storeNameById = new Map(stores.map((s) => [s.id, s.name]));
    // 店舗から辿れる場所提供元だけを「確かめられた提供元」として扱う。
    const providerByStoreId = new Map(
      stores.map((s) => [
        s.id,
        s.venueProvider ? { id: s.venueProvider.id, name: s.venueProvider.name } : null,
      ]),
    );
    const lineNameById = new Map(lineEvents.map((le) => [le.id, le.name]));

    return prefs.map((p) => {
      const items: LanePreferenceItemDto[] = p.items.map((i) => {
        // 店舗マスタに紐付いていれば、その親チェーンを場所提供元として出す。
        // 紐付いていない明細では、単独でぶら下がっている venueProviderId は
        // 店舗との整合を確かめられないので名前を出さない（null のまま）。
        const viaStore = i.storeId ? (providerByStoreId.get(i.storeId) ?? null) : null;
        const providerId = viaStore?.id ?? i.venueProviderId ?? null;
        const providerName = viaStore
          ? viaStore.name
          : i.storeId
            ? null
            : i.venueProviderId
              ? (providerNameById.get(i.venueProviderId) ?? null)
              : null;
        return {
          laneNo: i.laneNo,
          priority: i.priority,
          venueLabel: i.venueLabel,
          venueProviderId: providerId,
          venueProviderName: providerName,
          storeId: i.storeId ?? null,
          storeName: i.storeId ? (storeNameById.get(i.storeId) ?? null) : null,
          lineEventId: i.lineEventId ?? null,
          lineName: i.lineEventId ? (lineNameById.get(i.lineEventId) ?? null) : null,
          desiredDates: Array.isArray(i.desiredDates) ? (i.desiredDates as string[]) : [],
          memo: i.memo ?? null,
          conditionNote: i.conditionNote ?? null,
          adoptions: i.adoptions.map((ad) => ({
            eventId: ad.eventId,
            eventCandidateId: ad.event.eventCandidate.id,
            storeNameAtEvent: ad.event.eventCandidate.storeName,
            scheduledDate: ad.event.eventCandidate.scheduledDate.toISOString(),
            decidedAt: ad.decidedAt.toISOString(),
          })),
        };
      });
      return {
        id: p.id,
        relationshipId: p.relationshipId,
        dealerName: dealerNameByRel.get(p.relationshipId) ?? "—",
        targetMonth: p.targetMonth,
        note: p.note,
        // 申告されたレーン数。明細数から導出しない（別の意味なので）。
        laneCount: p.laneCount,
        laneCountFromItems: new Set(items.map((i) => i.laneNo)).size,
        itemCount: items.length,
        status: p.status,
        submittedAt: p.submittedAt.toISOString(),
        items,
      };
    });
  });
}

// 出店希望の保存（提出）は、業務の持ち主であるパートナー側へ移した:
//   apps/web/app/(partner)/p-lane-preferences/actions.ts
// 旧 saveLanePreference は「取引先代理店 1 社固定」を前提にしていて、複数代理店から
// 依頼を受ける構成では成立しない（relationshipIds が 2 件以上で必ず失敗した）。
// また明細の全件入れ替えで代理店からの回答も失われていたため、同じ表に対する
// 書き込み口を 2 つ残さず、レーン番号・個別条件・回答スレッドに対応した新しい
// 実装 1 本に寄せている。この画面は閲覧と回答だけを担う。
