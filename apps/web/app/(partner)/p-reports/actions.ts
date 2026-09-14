"use server";

// 二次店ポータル：催事日報の登録・編集。
//
// 保存先は DealerEventReport（Google フォーム「ES_日報」置き換え用の専用テーブル）。
// 既存 EventReport は Event 紐付け前提なので触らない。
//
// wholesalerId / relationshipId / createdByUserId は requirePartnerContext が
// 認証情報から決める。フォームからは受け取らない。
// 合計値は保存しない（両面 + 片面から表示時に算出する）。

import {
  DealerEventReportCreateSchema,
  DealerEventReportUpdateSchema,
  type DealerEventReportCreateInput,
  type DealerEventReportUpdateInput,
} from "@solar/contracts";
import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/lib/errors";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext } from "@/lib/partner/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

const LIST_PATH = "/p-reports";

export async function createPartnerReportAction(
  input: DealerEventReportCreateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_event_report.write");
  const parsed = DealerEventReportCreateSchema.parse(input);

  const created = await withTenant(partner.ctx, (tx) =>
    tx.dealerEventReport.create({
      data: {
        wholesalerId: partner.wholesalerId,
        relationshipId: partner.relationshipId,
        createdByUserId: partner.userId,
        eventDate: parsed.eventDate,
        venuePlace: parsed.venuePlace,
        category: parsed.category,
        venueChain: parsed.venueChain,
        areaInFacility: parsed.areaInFacility,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        lotteryBoth: parsed.lotteryBoth,
        lotterySingle: parsed.lotterySingle,
        seatedBoth: parsed.seatedBoth,
        seatedSingle: parsed.seatedSingle,
        apptBoth: parsed.apptBoth,
        apptSingle: parsed.apptSingle,
        cainzPayCount: parsed.cainzPayCount ?? null,
        impression: parsed.impression ?? null,
      },
      select: { id: true },
    }),
  );

  revalidatePath(LIST_PATH);
  return created;
}

export async function updatePartnerReportAction(
  input: DealerEventReportUpdateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_event_report.write");
  const parsed = DealerEventReportUpdateSchema.parse(input);

  return withTenant(partner.ctx, async (tx) => {
    // 自社の日報かを先に確認する。
    const existing = await tx.dealerEventReport.findFirst({
      where: { id: parsed.id, relationshipId: partner.relationshipId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError(labels.partner.errors.notFound);

    await tx.dealerEventReport.update({
      where: { id: existing.id },
      data: {
        eventDate: parsed.eventDate,
        venuePlace: parsed.venuePlace,
        category: parsed.category,
        venueChain: parsed.venueChain,
        areaInFacility: parsed.areaInFacility,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        lotteryBoth: parsed.lotteryBoth,
        lotterySingle: parsed.lotterySingle,
        seatedBoth: parsed.seatedBoth,
        seatedSingle: parsed.seatedSingle,
        apptBoth: parsed.apptBoth,
        apptSingle: parsed.apptSingle,
        cainzPayCount: parsed.cainzPayCount ?? null,
        impression: parsed.impression ?? null,
      },
    });

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${existing.id}`);
    return { id: existing.id };
  });
}
