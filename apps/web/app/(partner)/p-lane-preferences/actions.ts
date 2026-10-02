"use server";

// パートナーポータル：出店希望の提出と、代理店とのやり取り。
//
// 保存の方針:
//   - 対象月 × 依頼先代理店 で 1 件（LanePreference の UNIQUE）。再提出は明細の入れ替え。
//   - 入れ替えても失われてはいけないものは親側に持つ: 提出状態と、代理店とのやり取り
//     （LanePreferenceMessage）。回答は明細に紐づけないので、再提出で消えない。
//   - 再提出のたびに SUBMISSION の記録をスレッドへ残す。何をいつ出し直したかが後から追える。
//   - 依頼先代理店は resolveRelationship で自社の取引関係に属することを必ず検証する。
//
// 希望日程はレーン単位の入力だが、保存はレーンの各明細へ同じ日付配列を書く
// （既存の LanePreferenceItem.desiredDates を使い、レーン用のテーブルを増やさない）。
// 個別条件は店舗単位なので conditionNote に入れる。希望順位へ読み替えない。

import {
  PartnerLanePreferenceSubmitSchema,
  PartnerThreadPostSchema,
  type PartnerLanePreferenceSubmitInput,
  type PartnerThreadPostInput,
} from "@solar/contracts";
import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/lib/errors";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext, resolveRelationship } from "@/lib/partner/context";
import { relationshipScope } from "@/lib/partner/scope";
import { withTenant } from "@/lib/tenancy/with-tenant";

const BASE = "/p-lane-preferences";

/** 提出内容をスレッドに残すときの要約。何を出したかが 1 行で分かる程度に。 */
function submissionSummary(input: {
  laneCount: number;
  lanes: { laneNo: number; items: { venueLabel: string }[]; desiredDates: string[] }[];
}): string {
  const t = labels.partner.lanePreference;
  const lines = input.lanes.map((lane) => {
    const venues = lane.items.map(
      (i, idx) => `${t.priorityLabel.replace("{n}", String(idx + 1))} ${i.venueLabel}`,
    );
    const dates =
      lane.desiredDates.length > 0 ? lane.desiredDates.join(", ") : labels.partner.common.notSet;
    return `${t.laneTitle.replace("{n}", String(lane.laneNo))}: ${venues.join(" / ")}（${t.laneDesiredDates}: ${dates}）`;
  });
  return [`${t.laneCountLabel}: ${input.laneCount}`, ...lines].join("\n");
}

export async function submitPartnerLanePreferenceAction(
  input: PartnerLanePreferenceSubmitInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_lane_preference.write");
  const parsed = PartnerLanePreferenceSubmitSchema.parse(input);
  const origin = resolveRelationship(partner, parsed.relationshipId);

  // laneNo は申告どおりに保存する（詰め直さない）。同じ laneNo の重複だけ弾く。
  const laneNos = parsed.lanes.map((l) => l.laneNo);
  if (new Set(laneNos).size !== laneNos.length) {
    throw new NotFoundError(labels.partner.lanePreference.errors.failed);
  }

  const result = await withTenant(partner.ctx, async (tx) => {
    // 希望場所は店舗マスタから確定する。画面から送られた名称は採用しない。
    // 取引のある代理店の、有効な店舗だけを受け付ける（他代理店の id は弾く）。
    const storeIds = [...new Set(parsed.lanes.flatMap((lane) => lane.items.map((i) => i.storeId)))];
    const stores = await tx.store.findMany({
      where: {
        id: { in: storeIds },
        wholesalerId: { in: partner.relationships.map((r) => r.wholesalerId) },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        venueProviderId: true,
        venueProvider: { select: { name: true } },
      },
    });
    const storeById = new Map(stores.map((st) => [st.id, st]));
    const missing = storeIds.filter((id) => !storeById.has(id));
    if (missing.length > 0) {
      throw new NotFoundError(labels.partner.lanePreference.errors.storeNotAvailable);
    }

    // 明細は (laneNo, priority) で一意。priority はレーン内の行順で 1..N に採番する。
    const itemCreate = parsed.lanes.flatMap((lane) =>
      lane.items.map((item, index) => {
        const st = storeById.get(item.storeId)!;
        return {
          laneNo: lane.laneNo,
          priority: index + 1,
          storeId: st.id,
          // 場所提供元は店舗マスタの親から取る。別々に送らせない
          // （送らせると「カインズ 大宮店 / スーパービバホーム」のような組合せができる）。
          venueProviderId: st.venueProviderId,
          venueLabel: st.venueProvider ? `${st.venueProvider.name} ${st.name}` : st.name,
          // 希望日程はレーン単位の入力。レーンの各明細へ同じ配列を持たせる。
          desiredDates: lane.desiredDates,
          conditionNote: item.conditionNote ?? null,
          memo: item.memo ?? null,
        };
      }),
    );

    const summary = submissionSummary({
      laneCount: parsed.laneCount,
      lanes: parsed.lanes.map((l) => ({
        laneNo: l.laneNo,
        items: l.items.map((i) => {
          const st = storeById.get(i.storeId)!;
          return { venueLabel: st.venueProvider ? `${st.venueProvider.name} ${st.name}` : st.name };
        }),
        desiredDates: l.desiredDates,
      })),
    });

    // 再提出のとき、代理店が決めた採用（LanePreferenceAdoption）を失わせない。
    //
    // 明細は入れ替えるので、そのままだと採用行が Cascade で消える。採用は業務上
    // 「その月にこの店舗でやると決めた」という記録なので、希望の出し直しで
    // 消えてはいけないし、確定イベントを書き換えてもいけない。
    // 出し直した希望に同じ店舗が残っていれば、その明細へ付け替えて引き継ぐ。
    const existingPref = await tx.lanePreference.findUnique({
      where: {
        relationshipId_targetMonth: { relationshipId: origin.id, targetMonth: parsed.targetMonth },
      },
      select: { id: true },
    });
    const carriedAdoptions = existingPref
      ? await tx.lanePreferenceAdoption.findMany({
          where: { item: { lanePreferenceId: existingPref.id } },
          select: {
            wholesalerId: true,
            eventId: true,
            decidedBy: true,
            decidedAt: true,
            note: true,
            item: { select: { storeId: true } },
          },
        })
      : [];

    const pref = await tx.lanePreference.upsert({
      where: {
        relationshipId_targetMonth: { relationshipId: origin.id, targetMonth: parsed.targetMonth },
      },
      create: {
        wholesalerId: origin.wholesalerId,
        relationshipId: origin.id,
        targetMonth: parsed.targetMonth,
        laneCount: parsed.laneCount,
        note: parsed.note ?? null,
        submittedBy: partner.userId,
        status: "SUBMITTED",
        items: { create: itemCreate },
      },
      update: {
        laneCount: parsed.laneCount,
        note: parsed.note ?? null,
        submittedBy: partner.userId,
        submittedAt: new Date(),
        // 再提出は明細を入れ替える。やり取り（messages）は親側なので残る。
        // 状態も SUBMITTED へ戻す（回答済みの内容に対して出し直したことが分かるように）。
        status: "SUBMITTED",
        items: { deleteMany: {}, create: itemCreate },
      },
      select: { id: true },
    });

    // 採用の引き継ぎ。同じ店舗の希望が残っている場合だけ付け替える。
    // 店舗ごと取り下げられた希望の採用は引き継がない（採用の事実は Event 側に残る）。
    if (carriedAdoptions.length > 0) {
      const newItems = await tx.lanePreferenceItem.findMany({
        where: { lanePreferenceId: pref.id },
        orderBy: [{ laneNo: "asc" }, { priority: "asc" }],
        select: { id: true, storeId: true },
      });
      const itemByStore = new Map<string, string>();
      for (const it of newItems) {
        if (it.storeId && !itemByStore.has(it.storeId)) itemByStore.set(it.storeId, it.id);
      }
      for (const ad of carriedAdoptions) {
        const storeId = ad.item.storeId;
        if (!storeId) continue;
        const itemId = itemByStore.get(storeId);
        if (!itemId) continue;
        await tx.lanePreferenceAdoption.upsert({
          where: {
            lanePreferenceItemId_eventId: { lanePreferenceItemId: itemId, eventId: ad.eventId },
          },
          create: {
            wholesalerId: ad.wholesalerId,
            lanePreferenceItemId: itemId,
            eventId: ad.eventId,
            decidedBy: ad.decidedBy,
            decidedAt: ad.decidedAt,
            note: ad.note,
          },
          update: {},
        });
      }
    }

    // 何をいつ提出したかをスレッドに残す。明細の入れ替えで消えない履歴になる。
    await tx.lanePreferenceMessage.create({
      data: {
        lanePreferenceId: pref.id,
        side: "DEALER",
        kind: "SUBMISSION",
        body: summary,
        authorUserId: partner.userId,
      },
    });

    return pref;
  });

  revalidatePath(BASE);
  revalidatePath(`${BASE}/${result.id}`);
  return { id: result.id };
}

/** 提出についての連絡をスレッドへ投稿する（パートナー側）。 */
export async function postLanePreferenceMessageAction(
  input: PartnerThreadPostInput,
): Promise<{ ok: true }> {
  const partner = await requirePartnerContext("partner_lane_preference.write");
  const parsed = PartnerThreadPostSchema.parse(input);

  await withTenant(partner.ctx, async (tx) => {
    // 自社の提出であることを確認する（id だけで書き込まない）。
    const pref = await tx.lanePreference.findFirst({
      where: { id: parsed.targetId, ...relationshipScope(partner) },
      select: { id: true },
    });
    if (!pref) throw new NotFoundError(labels.partner.errors.notFound);

    await tx.lanePreferenceMessage.create({
      data: {
        lanePreferenceId: pref.id,
        side: "DEALER",
        kind: "MESSAGE",
        body: parsed.body,
        authorUserId: partner.userId,
      },
    });
  });

  revalidatePath(`${BASE}/${parsed.targetId}`);
  return { ok: true };
}
