"use server";

// 成果報告の「追加集計項目」(EventReportMetric) の Server Actions。
//
// 固定集計項目（アプローチ数 / 着座数 / アポ取得数 / 所感）は EventReport.payload
// に持つ既存仕様のままで、こちらは触らない。ここで扱うのは催事ごとにその場で
// 足したい数値項目だけ（例: 「カインズPay対応数 12」）。
//
// 汎用カスタムフィールド機構にはしない — 値は常に「名称 + 0 以上の整数」で、
// 型選択・選択肢・条件表示などは持たない。
//
// テナント分離: EventReportMetric 自体は wholesalerId を持たないので、
// report → event と辿って ctx.wholesalerId と突き合わせる（RLS 側でも
// 同じ経路のポリシーが張られており、二重防御になる）。

import {
  EventReportMetricCreateSchema,
  EventReportMetricDeleteSchema,
  EventReportMetricUpdateSchema,
  type EventReportMetricCreateInput,
  type EventReportMetricDeleteInput,
  type EventReportMetricUpdateInput,
} from "@solar/contracts";
import { revalidatePath } from "next/cache";

import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { withServerActionContext } from "@/lib/tenancy/server-action";

import type { TxClient } from "@/lib/tenancy/with-tenant";

export interface EventReportMetricResult {
  id: string;
  eventId: string;
}

/**
 * 報告 ID から所属イベントを解決し、自テナントのものか検証する。
 * 見つからない / 他テナントはどちらも NotFound に潰して存在を漏らさない。
 */
async function resolveEventId(
  tx: TxClient,
  reportId: string,
  wholesalerId: string,
): Promise<string> {
  const report = await tx.eventReport.findUnique({
    where: { id: reportId },
    select: { id: true, type: true, event: { select: { id: true, wholesalerId: true } } },
  });
  if (!report || report.event.wholesalerId !== wholesalerId) {
    throw new NotFoundError("成果報告が見つかりません");
  }
  if (report.type !== "RESULT") {
    throw new ValidationError("追加集計項目は成果報告にのみ登録できます");
  }
  return report.event.id;
}

// ── 追加 ─────────────────────────────────────────────────────────────────────

export const createEventReportMetricAction = withServerActionContext<
  EventReportMetricCreateInput,
  EventReportMetricResult
>({ action: "event_report.submit" }, async ({ tx, ctx, input }) => {
  if (!ctx.wholesalerId) {
    throw new ValidationError("卸業者コンテキストが必要です");
  }
  const parsed = EventReportMetricCreateSchema.parse(input);
  const eventId = await resolveEventId(tx, parsed.reportId, ctx.wholesalerId);

  // 同一報告内で項目名は一意（@@unique([reportId, name])）。先に弾いて
  // P2002 ではなく業務エラーとして UI に返す。
  const duplicate = await tx.eventReportMetric.findFirst({
    where: { reportId: parsed.reportId, name: parsed.name },
    select: { id: true },
  });
  if (duplicate) {
    throw new ConflictError("同じ項目名がすでに登録されています");
  }

  // 末尾に追加する。sortOrder は表示順のみに使い、欠番は許容する。
  const last = await tx.eventReportMetric.findFirst({
    where: { reportId: parsed.reportId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await tx.eventReportMetric.create({
    data: {
      reportId: parsed.reportId,
      name: parsed.name,
      value: parsed.value,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });

  revalidatePath(`/events/${eventId}`);
  return { id: created.id, eventId };
});

// ── 名称 / 値の編集 ──────────────────────────────────────────────────────────

export const updateEventReportMetricAction = withServerActionContext<
  EventReportMetricUpdateInput,
  EventReportMetricResult
>({ action: "event_report.submit" }, async ({ tx, ctx, input }) => {
  if (!ctx.wholesalerId) {
    throw new ValidationError("卸業者コンテキストが必要です");
  }
  const parsed = EventReportMetricUpdateSchema.parse(input);

  const existing = await tx.eventReportMetric.findUnique({
    where: { id: parsed.id },
    select: { id: true, reportId: true },
  });
  if (!existing) {
    throw new NotFoundError("追加集計項目が見つかりません");
  }
  const eventId = await resolveEventId(tx, existing.reportId, ctx.wholesalerId);

  const duplicate = await tx.eventReportMetric.findFirst({
    where: { reportId: existing.reportId, name: parsed.name, id: { not: parsed.id } },
    select: { id: true },
  });
  if (duplicate) {
    throw new ConflictError("同じ項目名がすでに登録されています");
  }

  await tx.eventReportMetric.update({
    where: { id: parsed.id },
    data: { name: parsed.name, value: parsed.value },
    select: { id: true },
  });

  revalidatePath(`/events/${eventId}`);
  return { id: parsed.id, eventId };
});

// ── 削除 ─────────────────────────────────────────────────────────────────────

export const deleteEventReportMetricAction = withServerActionContext<
  EventReportMetricDeleteInput,
  EventReportMetricResult
>({ action: "event_report.submit" }, async ({ tx, ctx, input }) => {
  if (!ctx.wholesalerId) {
    throw new ValidationError("卸業者コンテキストが必要です");
  }
  const parsed = EventReportMetricDeleteSchema.parse(input);

  const existing = await tx.eventReportMetric.findUnique({
    where: { id: parsed.id },
    select: { id: true, reportId: true },
  });
  if (!existing) {
    throw new NotFoundError("追加集計項目が見つかりません");
  }
  const eventId = await resolveEventId(tx, existing.reportId, ctx.wholesalerId);

  await tx.eventReportMetric.delete({ where: { id: parsed.id } });

  revalidatePath(`/events/${eventId}`);
  return { id: parsed.id, eventId };
});
