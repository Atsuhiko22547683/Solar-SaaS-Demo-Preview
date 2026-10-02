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

import { NotFoundError, ValidationError } from "@/lib/errors";
import { labels } from "@/lib/i18n/labels";
import { assertCheckedInForEvent } from "@/lib/partner/attendance";
import { requirePartnerContext, resolveRelationship } from "@/lib/partner/context";
import { relationshipScope } from "@/lib/partner/scope";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { TxClient } from "@solar/db";

const LIST_PATH = "/p-reports";

/**
 * 催事・開催日が指定されているかを先に確かめる。
 *
 * 実施日と場所は催事の記録から埋めるので、催事が無いと他の必須項目の
 * エラーが先に出て、何を直せばよいか分からなくなる。
 */
function assertEventTargetGiven(input: {
  eventId?: string | null;
  eventDayId?: string | null;
}): void {
  if (!input.eventId) {
    throw new ValidationError(labels.partner.report.errors.eventRequired, { field: "eventId" });
  }
  if (!input.eventDayId) {
    throw new ValidationError(labels.partner.report.errors.eventDayRequired, {
      field: "eventDayId",
    });
  }
}

export async function createPartnerReportAction(
  input: DealerEventReportCreateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_event_report.write");
  assertEventTargetGiven(input);
  const parsed = DealerEventReportCreateSchema.parse(input);
  // 依頼元代理店は候補の中から確定させる（送信値をそのまま書き込み先にしない）。
  const origin = resolveRelationship(partner, parsed.relationshipId);

  const created = await withTenant(partner.ctx, async (tx) => {
    // 自社が担当している催事の、その催事に属する開催日であることを確かめる
    // （ブラウザから来た id をそのまま書き込まない）。
    const link = await resolveReportEventLink(tx, partner, parsed.eventId, parsed.eventDayId, true);

    return tx.dealerEventReport.create({
      data: {
        wholesalerId: origin.wholesalerId,
        relationshipId: origin.id,
        createdByUserId: partner.userId,
        eventId: link.eventId,
        eventDayId: link.eventDayId,
        reportScope: parsed.reportScope ?? "UNKNOWN",
        // 実施日と場所は催事側の記録から埋める。画面の値と催事がずれないようにする。
        eventDate: link.eventDate,
        venuePlace: link.venuePlace,
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
    });
  });

  revalidatePath(LIST_PATH);
  return created;
}

/**
 * 日報の対象催事・開催日を確定する。
 *
 * 日報は「どの催事のどの開催日か」が決まってはじめて意味を持つので、両方を必須にする。
 * 受け付けるのは自社が担当している催事の、その催事に属する開催日だけ。
 * 催事が未指定・他社の催事・別催事の開催日はここで弾く。
 * 通常の保存で催事を自動生成することはしない。
 *
 * 催事側の記録（開催日・店舗名）も一緒に返し、日報の日付・場所をそこから埋める。
 */
async function resolveReportEventLink(
  tx: TxClient,
  partner: Awaited<ReturnType<typeof requirePartnerContext>>,
  eventId: string | null | undefined,
  eventDayId: string | null | undefined,
  /**
   * 出勤済みを条件にするか。
   *
   * 新しく提出するとき（createPartnerReportAction）だけ true。
   * 既存の提出の訂正は、出勤の記録が無い過去分でも止めない
   *（打刻を後から補完しないので、古い日報が直せなくなるのを避ける）。
   */
  requireCheckedIn: boolean,
): Promise<{ eventId: string; eventDayId: string; eventDate: Date; venuePlace: string }> {
  if (!eventId) throw new NotFoundError(labels.partner.report.errors.eventRequired);

  const event = await tx.event.findFirst({
    where: { id: eventId, dealers: { some: { relationshipId: { in: partner.relationshipIds } } } },
    select: { id: true, eventCandidate: { select: { storeName: true } } },
  });
  if (!event) throw new NotFoundError(labels.partner.report.errors.eventNotAssigned);

  if (!eventDayId) throw new NotFoundError(labels.partner.report.errors.eventDayRequired);
  const day = await tx.eventDay.findFirst({
    where: { id: eventDayId, eventId: event.id },
    select: { id: true, eventDate: true },
  });
  if (!day) throw new NotFoundError(labels.partner.report.errors.eventDayMismatch);

  // 日報はその日に出勤した本人が出すもの。画面のボタンを隠すだけでなく、
  // URL 直打ち・Server Action への直接送信でもここで止める。
  // 退勤後も通す（その日の記録を後から出せるようにする）。
  if (requireCheckedIn) {
    await assertCheckedInForEvent(tx, partner, event.id, day.id);
  }

  return {
    eventId: event.id,
    eventDayId: day.id,
    eventDate: day.eventDate,
    venuePlace: event.eventCandidate.storeName,
  };
}

export async function updatePartnerReportAction(
  input: DealerEventReportUpdateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_event_report.write");
  const parsed = DealerEventReportUpdateSchema.parse(input);

  return withTenant(partner.ctx, async (tx) => {
    // 自社の日報かを先に確認する。
    const existing = await tx.dealerEventReport.findFirst({
      where: { id: parsed.id, ...relationshipScope(partner) },
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

/**
 * 日報の訂正。
 *
 * 元の行は消さず、訂正後の行を新しく作って `supersedesReportId` で繋ぐ。
 * 集計は連鎖の末尾だけを対象にするので、訂正前と訂正後が二重に数えられない。
 * 提出日時・提出者・原文は元の行にそのまま残る。
 *
 * 同じ元行に対して二度訂正を作らない（二重送信で件数が増えないようにする）。
 */
export async function correctPartnerReportAction(
  input: DealerEventReportCreateInput & { supersedesReportId: string },
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_event_report.write");
  assertEventTargetGiven(input);
  const parsed = DealerEventReportCreateSchema.parse(input);
  const origin = resolveRelationship(partner, parsed.relationshipId);

  const created = await withTenant(partner.ctx, async (tx) => {
    // 訂正元は自社が出した日報であること。
    const original = await tx.dealerEventReport.findFirst({
      where: { id: input.supersedesReportId, ...relationshipScope(partner) },
      select: { id: true, eventId: true, eventDayId: true },
    });
    if (!original) throw new NotFoundError(labels.partner.errors.notFound);

    const already = await tx.dealerEventReport.findFirst({
      where: { supersedesReportId: original.id },
      select: { id: true },
    });
    if (already) return already;

    const link = await resolveReportEventLink(
      tx,
      partner,
      parsed.eventId,
      parsed.eventDayId,
      false,
    );

    return tx.dealerEventReport.create({
      data: {
        wholesalerId: origin.wholesalerId,
        relationshipId: origin.id,
        createdByUserId: partner.userId,
        supersedesReportId: original.id,
        eventId: link.eventId,
        eventDayId: link.eventDayId,
        reportScope: parsed.reportScope ?? "UNKNOWN",
        eventDate: link.eventDate,
        venuePlace: link.venuePlace,
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
    });
  });

  revalidatePath(LIST_PATH);
  return created;
}
