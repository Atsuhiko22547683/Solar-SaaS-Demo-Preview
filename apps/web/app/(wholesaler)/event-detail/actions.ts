"use server";

// Server Actions for the event-candidate workflow (T-03-03 / F-018 /
// docs/05 §4.5).
//
// Five actions, all wired through the canonical `withServerActionContext`
// three-step idiom (auth → assertCan → withTenant). The wholesalerId is
// injected from the tenant context — callers MUST NOT pass it as input.
//
//   createEventCandidateAction   — DRAFT 行を新規作成
//   updateEventCandidateAction   — DRAFT のみ全フィールド編集可、
//                                  それ以外は `EVENT_CANDIDATE_NON_DRAFT_EDITABLE_FIELDS`
//                                  (deadlineAt / internalNote) に限定
//   publishEventCandidateAction  — DRAFT → OPEN (希望受付中) 遷移
//   closePreferenceAction        — OPEN → CLOSED (希望受付終了) 遷移
//   cancelEventCandidateAction   — 任意の非終端状態 → CANCELLED 遷移
//
// State machine (enforced here, not in Zod — the schema only validates the
// payload shape):
//
//   DRAFT     → OPEN  / CANCELLED
//   OPEN      → CLOSED / CANCELLED
//   CLOSED    → DECIDED / OPEN (期限延長で再受付) / CANCELLED
//   DECIDED   → CANCELLED only
//   CANCELLED → (terminal — no outgoing transitions)
//
// Invalid transitions throw `InvalidStateTransitionError` (HTTP 422,
// `code:"INVALID_STATE_TRANSITION"`). Visibility 管理 (target dealers) は
// T-03-04 で `eventCandidate.updateVisibility` として別アクションに実装する。
// 本タスクのスコープは EventCandidate 単体のみ。

import {
  EVENT_CANDIDATE_NON_DRAFT_EDITABLE_FIELDS,
  EventCandidateInputSchema,
  EventCandidateUpdateSchema,
  EventCandidateVisibilityUpdateSchema,
  TASK_NAMES,
  type EventCandidateInput,
  type EventCandidateStatus,
  type EventCandidateUpdate,
  type EventCandidateVisibilityUpdate,
} from "@solar/contracts";
import { revalidatePath } from "next/cache";

import { InvalidStateTransitionError, NotFoundError, ValidationError } from "@/lib/errors";
import { enqueue } from "@/lib/jobs/queue";
import { notificationService } from "@/lib/notifications/notification-service";
import { resolveDealerAdmins } from "@/lib/notifications/recipient-helpers";
import { withServerActionContext } from "@/lib/tenancy/server-action";

import type { TxClient } from "@solar/db";

const LIST_PATH = "/event-detail";

// Allowed-transition adjacency table — see header comment for rationale.
// CLOSED → OPEN is the 期限延長 (re-open for preferences) operation; the UI
// surfaces it as a separate button but the action layer reuses publish.
const ALLOWED_TRANSITIONS: Record<EventCandidateStatus, EventCandidateStatus[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["CLOSED", "CANCELLED"],
  CLOSED: ["DECIDED", "OPEN", "CANCELLED"],
  DECIDED: ["CANCELLED"],
  CANCELLED: [],
};

function assertTransitionAllowed(from: EventCandidateStatus, to: EventCandidateStatus): void {
  if (from === to) {
    throw new InvalidStateTransitionError("既に同じ状態です", { from, to });
  }
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new InvalidStateTransitionError(`「${from}」から「${to}」への変更はできません`, {
      from,
      to,
      allowed,
    });
  }
}

// Strip unsupported keys from an update payload when the candidate is past
// DRAFT. We don't silently drop keys — passing a forbidden field is a
// programmer error and surfaces as 400 so the UI can show "編集できない項目
// が含まれています" instead of pretending the write succeeded.
function assertNonDraftPatchAllowed(patch: EventCandidateUpdate): void {
  const allowed = new Set<string>(EVENT_CANDIDATE_NON_DRAFT_EDITABLE_FIELDS);
  const offending: string[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (!allowed.has(key)) offending.push(key);
  }
  if (offending.length > 0) {
    throw new ValidationError("公開後は回答期限と内部メモのみ編集できます", {
      offending,
      allowed: [...allowed],
    });
  }
}

// 催事ブース場所の自由記述は「その他」を選んだときだけ保持する。
// 種別を戻したのに旧メモが残ると、一覧・詳細で矛盾した表示になるため。
function normalizeBoothAreaNote(
  boothArea: EventCandidateUpdate["boothArea"],
  boothAreaNote: EventCandidateUpdate["boothAreaNote"],
): string | null {
  if (boothArea !== "OTHER") return null;
  const trimmed = boothAreaNote?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export interface CreateEventCandidateResult {
  id: string;
}

/** 店舗マスタから確定した開催場所。storeName / address / area は開催当時の記録になる。 */
interface ResolvedVenue {
  storeId: string | null;
  storeName?: string;
  address?: string | null;
  area?: string | null;
  venueProviderId?: string | null;
}

/**
 * 開催場所を店舗マスタから確定する。
 *
 * storeId が来たら、店舗名・住所・開催エリア・場所提供元はすべてマスタから取る。
 * 画面から一緒に送られてきた値は採用しない（ブラウザの値を信用しない）。
 * 場所提供元も一緒に送られていて、店舗マスタ上の親と違うときは拒否する
 * — これが「カインズ 大宮店 なのに 場所提供元がスーパービバホーム」を塞ぐ防波堤。
 *
 * storeId が無い場合はマスタ未登録の場所の登録とみなし、送られた値をそのまま使う。
 */
async function resolveVenueFromStore(
  tx: TxClient,
  input: { storeId?: string; venueProviderId?: string | null },
): Promise<ResolvedVenue> {
  if (!input.storeId) return { storeId: null };

  const store = await tx.store.findUnique({
    where: { id: input.storeId },
    select: {
      id: true,
      name: true,
      address: true,
      venueProviderId: true,
      isActive: true,
      area: { select: { name: true } },
    },
  });
  // RLS で他テナントの店舗は引けない。見つからない = 自社の店舗ではない。
  if (!store) throw new NotFoundError("店舗が見つかりません");
  if (!store.isActive) {
    throw new ValidationError("停止中の店舗は選択できません", { field: "storeId" });
  }
  if (
    input.venueProviderId !== undefined &&
    input.venueProviderId !== null &&
    input.venueProviderId !== store.venueProviderId
  ) {
    throw new ValidationError("選択した店舗と場所提供元の組合せが正しくありません", {
      field: "venueProviderId",
    });
  }

  return {
    storeId: store.id,
    storeName: store.name,
    address: store.address,
    area: store.area?.name ?? null,
    venueProviderId: store.venueProviderId,
  };
}

export const createEventCandidateAction = withServerActionContext<
  EventCandidateInput,
  CreateEventCandidateResult
>(
  {
    action: "event_candidate.create",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ tx, ctx, input }) => {
    if (!ctx.wholesalerId) {
      throw new ValidationError("wholesalerId is required for event candidate");
    }
    const parsed = EventCandidateInputSchema.parse(input);

    // Defence in depth — RLS + assertCan already restrict tenants, but we also
    // verify any provided venueProvider / venueNegotiation is owned by the
    // caller's wholesaler. (Both fields are optional; F-018 入力 lists 場所提供元
    // as optional because the candidate may not yet be linked to a master row.)
    if (parsed.venueProviderId) {
      const provider = await tx.venueProvider.findUnique({
        where: { id: parsed.venueProviderId },
        select: { id: true },
      });
      if (!provider) {
        throw new NotFoundError("場所提供元が見つかりません");
      }
    }
    if (parsed.venueNegotiationId) {
      const negotiation = await tx.venueNegotiation.findUnique({
        where: { id: parsed.venueNegotiationId },
        select: { id: true },
      });
      if (!negotiation) {
        throw new NotFoundError("場所提供元対応が見つかりません");
      }
    }

    // 作成時に許可する初期ステータスは DRAFT / DECIDED / CANCELLED のみ。
    // OPEN / CLOSED は publish / close フローを経るべき中間状態のため、直接
    // 指定が来た場合 (または未指定) は DRAFT にフォールバックする。
    const CREATABLE_STATUSES = new Set<EventCandidateStatus>(["DRAFT", "DECIDED", "CANCELLED"]);
    const initialStatus =
      parsed.status && CREATABLE_STATUSES.has(parsed.status) ? parsed.status : "DRAFT";

    // 開催場所は店舗マスタを正本にする。storeId が来たら名称・住所・エリア・提供元は
    // マスタから確定し、画面から来た同名の値は捨てる。
    const venue = await resolveVenueFromStore(tx, {
      storeId: parsed.storeId,
      venueProviderId: parsed.venueProviderId ?? null,
    });
    const storeName = venue.storeName ?? parsed.storeName;
    if (!storeName) {
      throw new ValidationError("開催場所を選択してください", { field: "storeId" });
    }

    const created = await tx.eventCandidate.create({
      data: {
        wholesalerId: ctx.wholesalerId,
        venueProviderId: venue.storeId ? venue.venueProviderId : parsed.venueProviderId,
        venueNegotiationId: parsed.venueNegotiationId,
        targetMonth: parsed.targetMonth,
        scheduledDate: parsed.scheduledDate,
        storeId: venue.storeId,
        storeName,
        address: venue.storeId ? venue.address : parsed.address,
        area: venue.storeId ? venue.area : parsed.area,
        deadlineAt: parsed.deadlineAt,
        contractType: parsed.contractType,
        fixedFee: parsed.fixedFee,
        performanceRate: parsed.performanceRate,
        internalNote: parsed.internalNote,
        contractNote: parsed.contractNote,
        venueChain: parsed.venueChain ?? null,
        boothArea: parsed.boothArea ?? null,
        boothAreaNote: normalizeBoothAreaNote(parsed.boothArea, parsed.boothAreaNote),
        productCategory: parsed.productCategory ?? null,
        status: initialStatus,
        createdBy: ctx.actorUserId,
      },
      select: { id: true },
    });

    revalidatePath(LIST_PATH);
    return { id: created.id };
  },
);

export interface UpdateEventCandidateInput {
  id: string;
  patch: EventCandidateUpdate;
}

export interface UpdateEventCandidateResult {
  id: string;
}

export const updateEventCandidateAction = withServerActionContext<
  UpdateEventCandidateInput,
  UpdateEventCandidateResult
>(
  {
    action: "event_candidate.update",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ tx, input }) => {
    const parsed = EventCandidateUpdateSchema.parse(input.patch);

    const existing = await tx.eventCandidate.findUnique({
      where: { id: input.id },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundError("イベント候補が見つかりません");
    }

    // After DRAFT, only deadlineAt / internalNote may change. We surface a
    // 400 ValidationError (not 422) because the request itself is malformed
    // — the caller is asking to edit a sealed field, not making an invalid
    // status transition.
    if (existing.status !== "DRAFT") {
      assertNonDraftPatchAllowed(parsed);
    }

    // 店舗を差し替えたときだけ、開催場所一式をマスタから引き直す。
    // 店舗を触らないパッチでは開催当時の記録（storeName / address / area）を維持する。
    const venue =
      parsed.storeId !== undefined
        ? await resolveVenueFromStore(tx, {
            storeId: parsed.storeId,
            venueProviderId: parsed.venueProviderId ?? null,
          })
        : null;

    const updated = await tx.eventCandidate.update({
      where: { id: input.id },
      data: {
        ...(venue?.storeId
          ? {
              storeId: venue.storeId,
              storeName: venue.storeName!,
              address: venue.address ?? null,
              area: venue.area ?? null,
              venueProviderId: venue.venueProviderId ?? null,
            }
          : {
              ...("storeId" in parsed ? { storeId: parsed.storeId ?? null } : {}),
              ...("venueProviderId" in parsed && parsed.venueProviderId !== undefined
                ? { venueProviderId: parsed.venueProviderId }
                : {}),
              ...(parsed.storeName !== undefined ? { storeName: parsed.storeName } : {}),
              ...("address" in parsed ? { address: parsed.address } : {}),
              ...("area" in parsed ? { area: parsed.area } : {}),
            }),
        ...("venueNegotiationId" in parsed && parsed.venueNegotiationId !== undefined
          ? { venueNegotiationId: parsed.venueNegotiationId }
          : {}),
        ...(parsed.targetMonth !== undefined ? { targetMonth: parsed.targetMonth } : {}),
        ...(parsed.scheduledDate !== undefined ? { scheduledDate: parsed.scheduledDate } : {}),
        ...(parsed.deadlineAt !== undefined ? { deadlineAt: parsed.deadlineAt } : {}),
        ...("contractType" in parsed ? { contractType: parsed.contractType } : {}),
        ...("fixedFee" in parsed ? { fixedFee: parsed.fixedFee } : {}),
        ...("performanceRate" in parsed ? { performanceRate: parsed.performanceRate } : {}),
        ...("internalNote" in parsed ? { internalNote: parsed.internalNote } : {}),
        ...("venueChain" in parsed ? { venueChain: parsed.venueChain ?? null } : {}),
        // boothAreaNote は boothArea=OTHER のときだけ意味を持つ。boothArea を
        // 変更するパッチでは note 側も必ず整合させる（OTHER 以外なら null）。
        ...("boothArea" in parsed || "boothAreaNote" in parsed
          ? {
              ...("boothArea" in parsed ? { boothArea: parsed.boothArea ?? null } : {}),
              boothAreaNote: normalizeBoothAreaNote(parsed.boothArea, parsed.boothAreaNote),
            }
          : {}),
        ...("productCategory" in parsed ? { productCategory: parsed.productCategory ?? null } : {}),
      },
      select: { id: true },
    });

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${input.id}`);
    return { id: updated.id };
  },
);

export interface StatusTransitionInput {
  id: string;
}

export interface StatusTransitionResult {
  id: string;
  status: EventCandidateStatus;
}

async function transitionStatus(
  tx: TxClient,
  id: string,
  target: EventCandidateStatus,
): Promise<StatusTransitionResult> {
  const existing = await tx.eventCandidate.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) {
    throw new NotFoundError("イベント候補が見つかりません");
  }
  assertTransitionAllowed(existing.status, target);

  // `publishedAt` is stamped the first time we enter OPEN. On 期限延長
  // (CLOSED → OPEN) we keep the original timestamp — that's the canonical
  // "公開日" for downstream notifications (T-03-04).
  let publishedAtToWrite: Date | undefined;
  if (target === "OPEN") {
    const row = await tx.eventCandidate.findUnique({
      where: { id },
      select: { publishedAt: true },
    });
    if (!row?.publishedAt) {
      publishedAtToWrite = new Date();
    }
  }

  const updated = await tx.eventCandidate.update({
    where: { id },
    data: {
      status: target,
      ...(publishedAtToWrite ? { publishedAt: publishedAtToWrite } : {}),
    },
    select: { id: true, status: true },
  });
  return { id: updated.id, status: updated.status };
}

export const publishEventCandidateAction = withServerActionContext<
  StatusTransitionInput,
  StatusTransitionResult
>(
  {
    action: "event_candidate.update",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ tx, input }) => {
    const result = await transitionStatus(tx, input.id, "OPEN");
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${input.id}`);
    return result;
  },
);

export const closePreferenceAction = withServerActionContext<
  StatusTransitionInput,
  StatusTransitionResult
>(
  {
    action: "event_candidate.update",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ tx, input }) => {
    const result = await transitionStatus(tx, input.id, "CLOSED");
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${input.id}`);
    return result;
  },
);

export const cancelEventCandidateAction = withServerActionContext<
  StatusTransitionInput,
  StatusTransitionResult
>(
  {
    action: "event_candidate.update",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ tx, input }) => {
    const result = await transitionStatus(tx, input.id, "CANCELLED");
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${input.id}`);
    return result;
  },
);

// ---------------------------------------------------------------------------
// T-03-04 / F-019 — 二次店共有 (公開トグル + 対象二次店フィルタ)
// ---------------------------------------------------------------------------
//
// 公開 (isVisible=true) / 公開取消 (isVisible=false) を同一 Action でハンドル。
//
// 不変条件：
//   - DRAFT 状態では visibility 操作不可 (まず希望受付開始してから対象を選ぶ)。
//   - 渡された全 relationshipId は同 EventCandidate の wholesalerId 配下である
//     こと（refine だけでなく DB 突き合わせで確認 — RLS の defence-in-depth）。
//   - 既存行は upsert、未存在は create。`(eventCandidateId, relationshipId)` は
//     Prisma の複合 PK なので二重行は不可。
//
// `event.publish_followups` ジョブは公開（true）の時だけ enqueue する。
// 公開取消は通知不要なのでスキップ。

export interface UpdateVisibilityResult {
  eventCandidateId: string;
  affectedCount: number;
}

export const updateVisibilityAction = withServerActionContext<
  EventCandidateVisibilityUpdate,
  UpdateVisibilityResult
>(
  {
    action: "event_candidate.update",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ tx, ctx, input }) => {
    if (!ctx.wholesalerId) {
      throw new ValidationError("wholesalerId is required for visibility update");
    }
    const parsed = EventCandidateVisibilityUpdateSchema.parse(input);

    const candidate = await tx.eventCandidate.findUnique({
      where: { id: parsed.eventCandidateId },
      select: { id: true, status: true, wholesalerId: true },
    });
    if (!candidate) {
      throw new NotFoundError("イベント候補が見つかりません");
    }
    if (candidate.status === "DRAFT") {
      throw new InvalidStateTransitionError(
        "下書き状態では公開できません。先に希望受付を開始してください",
        { status: candidate.status },
      );
    }

    // Cross-tenant defence: every relationshipId MUST belong to the caller's
    // wholesaler. RLS already filters but we surface a clean 400 here so the
    // UI can show the offending ids rather than getting a generic 404.
    const uniqueIds = Array.from(new Set(parsed.relationshipIds));
    const rels = await tx.relationship.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, wholesalerId: true, status: true },
    });
    const foundIds = new Set(rels.map((r) => r.id));
    const missing = uniqueIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new ValidationError("指定された二次店関係が見つかりません", {
        offending: missing,
      });
    }
    const foreign = rels.filter((r) => r.wholesalerId !== candidate.wholesalerId);
    if (foreign.length > 0) {
      throw new ValidationError("他テナントの二次店関係は指定できません", {
        offending: foreign.map((r) => r.id),
      });
    }

    // Upsert every (candidateId, relationshipId) row in sequence. Loop is fine
    // — the relationship list is bounded by a single wholesaler's dealer count
    // (typically < 50 in MVP scope) and we're inside one withTenant tx.
    for (const relationshipId of uniqueIds) {
      await tx.eventCandidateVisibility.upsert({
        where: {
          eventCandidateId_relationshipId: {
            eventCandidateId: parsed.eventCandidateId,
            relationshipId,
          },
        },
        create: {
          eventCandidateId: parsed.eventCandidateId,
          relationshipId,
          isVisible: parsed.isVisible,
        },
        update: {
          isVisible: parsed.isVisible,
        },
      });
    }

    // Fire the follow-up notification job only on publish (true). 公開取消で
    // 通知を送ると二次店にとってノイズになるためスキップ。SP-07 で in-app +
    // email を実装。
    if (parsed.isVisible) {
      await enqueue(TASK_NAMES.EVENT_PUBLISH_FOLLOWUPS, {
        eventCandidateId: parsed.eventCandidateId,
        relationshipIds: uniqueIds,
      });

      // Fetch candidate title for notification content.
      const candRow = await tx.eventCandidate.findUnique({
        where: { id: parsed.eventCandidateId },
        select: { storeName: true },
      });
      const eventTitle = candRow?.storeName ?? parsed.eventCandidateId;

      // Notify DEALER_ADMIN of each newly-visible relationship.
      for (const relationshipId of uniqueIds) {
        const dealerAdmins = await resolveDealerAdmins(tx, relationshipId);
        if (dealerAdmins.length > 0) {
          await notificationService.fire(tx, {
            type: "EVENT_PUBLISHED",
            recipientUserIds: dealerAdmins,
            tenantId: ctx.wholesalerId!,
            params: { eventTitle },
            dedupKey: `EVENT_PUBLISHED:${parsed.eventCandidateId}:${relationshipId}`,
          });
        }
      }
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${parsed.eventCandidateId}`);
    return {
      eventCandidateId: parsed.eventCandidateId,
      affectedCount: uniqueIds.length,
    };
  },
);
