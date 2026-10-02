"use server";

import { revalidatePath } from "next/cache";

import { NotFoundError, ValidationError } from "@/lib/errors";
import { withServerActionContext } from "@/lib/tenancy/server-action";

export interface SaveAssignInput {
  eventCandidateId: string;
  mode: "SELF" | "DEALER" | "JOINT";
  /** 配置する自社スタッフ（Salesperson.id）。システムユーザー ID ではない。 */
  staffSalespersonIds: string[];
  dealerRelationshipIds: string[];
  memo: string;
}

export interface SaveAssignResult {
  eventId: string;
}

/**
 * 自社スタッフ（Salesperson）をイベントへ配置する。
 *
 * 受け取った id は必ず「自テナントの有効な自社スタッフ」であることを確認してから
 * 書き込む。クライアントから来た id をそのまま信用しない。
 */
async function assignSelfStaff(
  tx: Parameters<Parameters<typeof withServerActionContext>[1]>[0]["tx"],
  eventId: string,
  salespersonIds: string[],
  wholesalerId: string,
): Promise<void> {
  if (salespersonIds.length === 0) return;
  const staff = await tx.salesperson.findMany({
    where: { id: { in: salespersonIds }, wholesalerId, relationshipId: null, isActive: true },
    select: { id: true },
  });
  for (const s of staff) {
    await tx.eventSalesperson.create({ data: { eventId, salespersonId: s.id } });
  }
}

export const saveAssignAction = withServerActionContext<SaveAssignInput, SaveAssignResult>(
  {
    action: "event_decision.decide",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ tx, ctx, input }) => {
    if (!ctx.wholesalerId) {
      throw new ValidationError("wholesalerId is required");
    }

    const candidate = await tx.eventCandidate.findUnique({
      where: { id: input.eventCandidateId },
      select: { id: true, wholesalerId: true, status: true, event: { select: { id: true } } },
    });
    if (!candidate || candidate.wholesalerId !== ctx.wholesalerId) {
      throw new NotFoundError("イベント候補が見つかりません");
    }

    let eventId: string;

    if (candidate.event) {
      // Event exists — update mode, sync shifts + dealers
      eventId = candidate.event.id;

      await tx.event.update({
        where: { id: eventId },
        data: { mode: input.mode, note: input.memo || null },
      });

      // 自社スタッフ配置を入れ替える。EventShift（User ベースの時間帯シフト）は
      // 別機能なので触らない。
      await tx.eventSalesperson.deleteMany({ where: { eventId } });
      if (input.mode === "SELF" || input.mode === "JOINT") {
        await assignSelfStaff(tx, eventId, input.staffSalespersonIds, ctx.wholesalerId);
      }

      // Sync dealers: delete existing, re-create from dealerRelationshipIds
      if (input.mode === "DEALER" || input.mode === "JOINT") {
        await tx.eventDealer.deleteMany({ where: { eventId } });
        for (const relationshipId of input.dealerRelationshipIds) {
          await tx.eventDealer.create({
            data: {
              eventId,
              relationshipId,
              assignedBy: ctx.actorUserId,
            },
          });
        }
      } else {
        await tx.eventDealer.deleteMany({ where: { eventId } });
      }
    } else {
      // No Event yet — create one + set candidate to DECIDED
      const event = await tx.event.create({
        data: {
          wholesalerId: ctx.wholesalerId,
          eventCandidateId: input.eventCandidateId,
          mode: input.mode,
          decidedBy: ctx.actorUserId,
          note: input.memo || null,
        },
        select: { id: true },
      });
      eventId = event.id;

      // 開催日を 1 日ぶん作る（候補の予定日）。複数日催事や開催時間は
      // /events/[id]/days で足す。時間は未定なので入れない（架空の時間で埋めない）。
      const candidate = await tx.eventCandidate.findUnique({
        where: { id: input.eventCandidateId },
        select: { scheduledDate: true },
      });
      if (candidate) {
        await tx.eventDay.upsert({
          where: {
            eventId_eventDate: {
              eventId: event.id,
              eventDate: new Date(
                Date.UTC(
                  candidate.scheduledDate.getUTCFullYear(),
                  candidate.scheduledDate.getUTCMonth(),
                  candidate.scheduledDate.getUTCDate(),
                ),
              ),
            },
          },
          create: {
            eventId: event.id,
            eventDate: new Date(
              Date.UTC(
                candidate.scheduledDate.getUTCFullYear(),
                candidate.scheduledDate.getUTCMonth(),
                candidate.scheduledDate.getUTCDate(),
              ),
            ),
          },
          update: {},
        });
      }

      await tx.eventCandidate.update({
        where: { id: input.eventCandidateId },
        data: { status: "DECIDED" },
      });

      // 自社スタッフ配置
      if (input.mode === "SELF" || input.mode === "JOINT") {
        await assignSelfStaff(tx, eventId, input.staffSalespersonIds, ctx.wholesalerId);
      }

      // Create dealers
      if (input.mode === "DEALER" || input.mode === "JOINT") {
        for (const relationshipId of input.dealerRelationshipIds) {
          await tx.eventDealer.create({
            data: {
              eventId,
              relationshipId,
              assignedBy: ctx.actorUserId,
            },
          });
        }
      }
    }

    revalidatePath(`/event-detail/${input.eventCandidateId}`);
    return { eventId };
  },
);
