// コール一覧（旧「マエカク一覧」）の server-side data loader。
//
// 顧客詳細「コール」タブ（ProjectCallStatusSection）が 1 顧客ごとに表示している内容を、
// 顧客横断で 1 ページぶんまとめて返す。表示列はすべて Customer / CustomerCallLog の実列で、
// このローダーは新しい列も導出値も作らない。
//
// テナント境界は顧客一覧（../data.ts listCustomers）と同じ posture:
//   auth → assertCan("customer.read") → withTenant（RLS + Prisma extension の二重防御）。
// PII（氏名・電話番号）は WholesalerSettings.piiMaskingMode 由来の ViewerContext で
// マスクしてから返す（CLAUDE.md ルール 6）。
//
// N+1 回避:
//   1) customer.findMany  … ページ内の顧客行（絞り込み・並び替え・ページングは全て DB 側）
//   2) customerCallLog.findMany + distinct … 顧客ごとの最新 1 件を 1 クエリで取得
//   3) user.findMany      … 担当者 / 次回アポ担当者の氏名をまとめて解決
// の計 3 クエリ（+ 件数カウントと設定取得）で固定。顧客ごとの追加リクエストは行わない。

import "server-only";

import { maskName, maskPhone } from "@solar/contracts/services/masking";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import { endOfDay } from "../../appointments/data";
import { normalizePageSize } from "../constants";
import {
  CALL_DATE_FIELD_COLUMN,
  CALL_TYPE_STATUS_COLUMN,
  UNSET_STATUS,
  computeNextTask,
} from "./constants";

import type {
  CallListFilter,
  CallListItem,
  CallSectionCell,
  PagedCallListResult,
} from "./constants";
import type { ViewerContext } from "@solar/contracts/services/masking";
import type { Prisma } from "@solar/db";

// 担当者ドロップダウン用（テナント内 ACTIVE ユーザー）。顧客一覧と同じ loader を再利用する。
export { listWholesalerUsers } from "../../event-detail/data";

/** 並び替え項目 → Customer の列名。name のみフリガナ優先なので個別に組み立てる。 */
const SORT_FIELD_COLUMN = {
  updated_at: "updatedAt",
  maekaku_preferred_at: "maekakuPreferredAt",
  thank_you_preferred_at: "thankYouCallPreferredAt",
  loan_completion_preferred_at: "loanCompletionCallPreferredAt",
  post_completion_preferred_at: "postCompletionCallPreferredAt",
  next_appointment_at: "nextAppointmentAt",
} as const;

/**
 * 【並び替え項目】×【昇順/降順】→ Prisma orderBy。
 * 日時列は未設定を常に末尾へ（nulls: "last"）、第 2 キーは更新日時降順で安定させる。
 * 顧客名は Customer.kana（フリガナ）優先、未設定は name にフォールバック。
 */
function buildOrderBy(
  sortField: NonNullable<CallListFilter["sortField"]>,
  direction: NonNullable<CallListFilter["sortDirection"]>,
): Prisma.CustomerOrderByWithRelationInput[] {
  if (sortField === "name") {
    return [
      { kana: { sort: direction, nulls: "last" } },
      { name: direction },
      { updatedAt: "desc" },
    ];
  }
  if (sortField === "updated_at") {
    return [{ updatedAt: direction }];
  }
  const column = SORT_FIELD_COLUMN[sortField];
  return [{ [column]: { sort: direction, nulls: "last" } }, { updatedAt: "desc" }];
}

/**
 * 【対象項目】×【ステータス】→ where 断片。
 * - 対象項目が個別のコールなら、そのステータス列を直接絞る（未設定 = null）。
 * - 対象項目が「すべて」なら 4 種の OR（= いずれかが該当する顧客）。
 *   マエカクの「未実施」は pending、他 3 種は not_done と CODE が違うため、
 *   統合値 "not_done" だけは種別ごとに CODE を読み替えて OR する。
 */
function buildStatusWhere(
  callType: NonNullable<CallListFilter["callType"]>,
  status: string,
): Prisma.CustomerWhereInput {
  if (callType !== "all") {
    const column = CALL_TYPE_STATUS_COLUMN[callType];
    return { [column]: status === UNSET_STATUS ? null : status };
  }

  if (status === UNSET_STATUS) {
    return {
      OR: [
        { maekakuStatus: null },
        { thankYouCallStatus: null },
        { loanCompletionCallStatus: null },
        { postCompletionCallStatus: null },
      ],
    };
  }
  // 統合「未実施・実施前」だけマエカク側の CODE が pending。done / unnecessary は共通。
  const maekakuStatus = status === "not_done" ? "pending" : status;
  return {
    OR: [
      { maekakuStatus },
      { thankYouCallStatus: status },
      { loanCompletionCallStatus: status },
      { postCompletionCallStatus: status },
    ],
  };
}

/**
 * 【日付対象】×【開始日/終了日】→ where 断片。
 * 最終架電日時のみ CustomerCallLog 側なので relation filter（some）で表現する。
 * to は当日終端まで含める（アポイント一覧の期間フィルタと同じ規約）。
 */
function buildDateWhere(
  dateField: NonNullable<CallListFilter["dateField"]>,
  from: string | undefined,
  to: string | undefined,
): Prisma.CustomerWhereInput | undefined {
  if (!from && !to) return undefined;
  const range = {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lt: endOfDay(to) } : {}),
  };
  if (dateField === "last_called_at") {
    return { callLogs: { some: { calledAt: range } } };
  }
  // 既定の「すべて」— 検索できる日時すべてを横断し、いずれかが期間に入る顧客を出す。
  // 単一の where に畳んだ OR なので、件数カウントもページングも通常どおり整合する。
  if (dateField === "all") {
    return {
      OR: [
        ...Object.values(CALL_DATE_FIELD_COLUMN).map((column) => ({ [column]: range })),
        { callLogs: { some: { calledAt: range } } },
      ],
    };
  }
  return { [CALL_DATE_FIELD_COLUMN[dateField]]: range };
}

export async function listCallCustomers(filter: CallListFilter = {}): Promise<PagedCallListResult> {
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
    action: "customer.read",
  });

  const pageSize = normalizePageSize(filter.pageSize);
  const page = Math.max(1, filter.page ?? 1);
  const skip = (page - 1) * pageSize;

  return withTenant(ctx, async (tx) => {
    const settings = ctx.wholesalerId
      ? await tx.wholesalerSettings.findUnique({
          where: { wholesalerId: ctx.wholesalerId },
          select: { piiMaskingMode: true },
        })
      : null;
    const viewer: ViewerContext = {
      role: (session.user.roles[0] ?? "WHOLESALER_ADMIN") as ViewerContext["role"],
      tenantType: "WHOLESALER",
      isSelfTenant: true,
      piiMaskingMode: (settings?.piiMaskingMode ?? "MASKED") as "FULL" | "PARTIAL" | "MASKED",
    };

    const queryStr = filter.query?.trim();
    const callType = filter.callType ?? "all";
    const dateField = filter.dateField ?? "maekaku_preferred_at";

    // ステータス条件と期間条件は OR を含みうるので AND 配列に積む（トップレベル衝突の回避）。
    const and: Prisma.CustomerWhereInput[] = [];
    if (filter.callStatus) and.push(buildStatusWhere(callType, filter.callStatus));
    const dateWhere = buildDateWhere(dateField, filter.dateFrom, filter.dateTo);
    if (dateWhere) and.push(dateWhere);

    // 絞り込みは全て DB の where に落とす（ページネーション件数を正しく保つため）。
    const where: Prisma.CustomerWhereInput = {
      ...(queryStr ? { name: { contains: queryStr, mode: "insensitive" } } : {}),
      ...(filter.assigneeUserId ? { registeredByUserId: filter.assigneeUserId } : {}),
      ...(and.length > 0 ? { AND: and } : {}),
    };

    const [rows, total] = await Promise.all([
      tx.customer.findMany({
        where,
        orderBy: buildOrderBy(filter.sortField ?? "updated_at", filter.sortDirection ?? "desc"),
        skip,
        take: pageSize,
        select: {
          id: true,
          name: true,
          registeredByUserId: true,
          landlinePhone: true,
          mobilePhone: true,
          maekakuStatus: true,
          maekakuPreferredAt: true,
          maekakuCallNote: true,
          nextAppointmentAt: true,
          nextAppointmentAssigneeUserId: true,
          nextAction: true,
          thankYouCallStatus: true,
          thankYouCallPreferredAt: true,
          thankYouCallNote: true,
          loanCompletionCallStatus: true,
          loanCompletionCallPreferredAt: true,
          loanCompletionCallNote: true,
          postCompletionCallStatus: true,
          postCompletionCallPreferredAt: true,
          postCompletionCallNote: true,
          updatedAt: true,
        },
      }),
      tx.customer.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);
    if (rows.length === 0) {
      return { items: [], total, page, pageSize, totalPages };
    }

    const customerIds = rows.map((r) => r.id);

    // 顧客ごとの「最終架電」= CustomerCallLog のうち calledAt が最新の 1 件。
    // distinct(customerId) + orderBy(customerId, calledAt desc) で 1 クエリに畳む。
    const latestLogs = await tx.customerCallLog.findMany({
      where: { customerId: { in: customerIds } },
      distinct: ["customerId"],
      orderBy: [{ customerId: "asc" }, { calledAt: "desc" }],
      select: { customerId: true, calledAt: true, handlerUserId: true, note: true },
    });
    const latestLogByCustomer = new Map(latestLogs.map((l) => [l.customerId, l]));

    // 担当者 / 次回アポ担当者 / 最終対応者の氏名を 1 クエリでまとめて解決（N+1 回避）。
    // テナント外（二次店ユーザー）は RLS で解決できないため null にフォールバックする。
    const userIds = new Set<string>();
    for (const r of rows) {
      userIds.add(r.registeredByUserId);
      if (r.nextAppointmentAssigneeUserId) userIds.add(r.nextAppointmentAssigneeUserId);
      const log = latestLogByCustomer.get(r.id);
      if (log?.handlerUserId) userIds.add(log.handlerUserId);
    }
    const users = await tx.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, name: true },
    });
    const nameById = new Map(users.map((u) => [u.id, u.name]));

    const isoOrNull = (d: Date | null): string | null => (d ? d.toISOString() : null);
    const section = (
      status: string | null,
      preferredAt: Date | null,
      note: string | null,
    ): CallSectionCell => ({ status, preferredAt: isoOrNull(preferredAt), note });

    // 「次回対応」の基準時刻。1 リクエスト内で 1 回だけ採り、全行で同じ now を使う
    // （行ごとに Date.now() を呼ぶと境界時刻で判定がぶれるため）。
    const nowMs = Date.now();

    return {
      items: rows.map((r): CallListItem => {
        const log = latestLogByCustomer.get(r.id) ?? null;
        const maekaku = section(r.maekakuStatus, r.maekakuPreferredAt, r.maekakuCallNote);
        const thankYouCall = section(
          r.thankYouCallStatus,
          r.thankYouCallPreferredAt,
          r.thankYouCallNote,
        );
        const loanCompletionCall = section(
          r.loanCompletionCallStatus,
          r.loanCompletionCallPreferredAt,
          r.loanCompletionCallNote,
        );
        const postCompletionCall = section(
          r.postCompletionCallStatus,
          r.postCompletionCallPreferredAt,
          r.postCompletionCallNote,
        );
        const nextAppointmentAt = isoOrNull(r.nextAppointmentAt);

        return {
          id: r.id,
          name: maskName(r.name, viewer),
          assigneeName: nameById.get(r.registeredByUserId) ?? null,
          maekaku,
          thankYouCall,
          loanCompletionCall,
          postCompletionCall,
          // 取得済みの日時だけで算出する（追加クエリ・追加列なし）。
          nextTask: computeNextTask(
            { maekaku, thankYouCall, loanCompletionCall, postCompletionCall, nextAppointmentAt },
            nowMs,
          ),
          // 未設定は null で返し、表示側で "—" に統一する（マスクは非空の場合のみ）。
          landlinePhone: r.landlinePhone ? maskPhone(r.landlinePhone, viewer) : null,
          mobilePhone: r.mobilePhone ? maskPhone(r.mobilePhone, viewer) : null,
          nextAppointmentAt,
          nextAppointmentAssigneeName: r.nextAppointmentAssigneeUserId
            ? (nameById.get(r.nextAppointmentAssigneeUserId) ?? null)
            : null,
          nextAction: r.nextAction,
          lastCalledAt: log ? log.calledAt.toISOString() : null,
          lastHandlerName: log?.handlerUserId ? (nameById.get(log.handlerUserId) ?? null) : null,
          lastCallNote: log?.note ?? null,
          updatedAt: r.updatedAt.toISOString(),
        };
      }),
      total,
      page,
      pageSize,
      totalPages,
    };
  });
}
