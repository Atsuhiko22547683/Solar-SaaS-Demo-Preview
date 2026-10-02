// Server-side data loader for the wholesaler appointment list (T-04-08 /
// F-034 / docs/04 §1.3 S-034 / docs/05 §4.7).
//
// Wholesaler sees all appointments linked to their wholesaler tenant via the
// Customer.wholesalerId FK. Filters: customerId / status / 取得担当者 /
// 顧客名部分一致 / 予定日レンジ。Pagination: PAGE_SIZE rows per page.
//
// 一覧が返す列はすべて実 DB 列に由来する（Appointment 本体 + Customer.area/
// address/nextAction + PreCall.result/calledAt/nextAction + User.name）。
// 顧客名は顧客一覧と同じ maskName を通す（CLAUDE.md ルール 6）。

import "server-only";

import { maskName } from "@solar/contracts/services/masking";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import { deriveArea } from "../customers/data";

import type { ViewerContext } from "@solar/contracts/services/masking";
import type { AppointmentStatus, PartnerAppointmentKind, PreCallResult, Prisma } from "@solar/db";

// 担当者ドロップダウン用（テナント内 ACTIVE ユーザー）。顧客一覧と同じ loader を再利用。
export { listWholesalerUsers } from "../event-detail/data";

export const PAGE_SIZE = 50;

export interface AppointmentListFilter {
  customerId?: string;
  status?: AppointmentStatus;
  /** 取得担当者（Appointment.acquiredByUserId）で絞り込む。 */
  assigneeUserId?: string;
  /** 顧客名の部分一致（大文字小文字を無視）。 */
  query?: string;
  /** アポ予定日の範囲。「検索範囲」がどの日付かを曖昧にしないため名前で区別する。 */
  from?: string;
  to?: string;
  /** 登録日の範囲（アポ予定日とは別条件。AND で効く）。 */
  createdFrom?: string;
  createdTo?: string;
  /** 顧客エリア（Customer.area はエリアマスタ名を保持しているので名称で一致）。 */
  area?: string;
  /** 担当会社（パートナー会社）。Appointment.acquiredRelationshipId。 */
  relationshipId?: string;
  /** アポイント種別（Appointment.appointmentType の実値）。 */
  appointmentType?: string;
  /** フォーム区分（初訪 / 訪問）。種別とは別概念なので混ぜない。 */
  partnerKind?: PartnerAppointmentKind;
  /** 獲得元催事。 */
  eventId?: string;
  /** 獲得元催事の名称検索（開催場所の部分一致）。訪問先住所とは別。 */
  eventQuery?: string;
  /** マエカク対応状況。"NONE" は未実施（PreCall が無い）。 */
  preCall?: PreCallResult | "NONE";
  /** 並び替え（項目 × 昇順/降順）。未指定は従来どおりアポ日時の降順。 */
  sortField?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
}

/** 受け付ける並べ替え項目。ここに無い値は既定へ落とす（任意の列を並べさせない）。 */
export const APPOINTMENT_SORT_FIELDS = [
  "scheduled_at",
  "created_at",
  "customer_name",
  "area",
  "assignee",
  "company",
  "appointment_type",
  "partner_kind",
  "event",
  "status",
  "pre_call",
] as const;
export type AppointmentSortField = (typeof APPOINTMENT_SORT_FIELDS)[number];

/**
 * 並び替え項目 → Prisma orderBy。
 *
 * 決め事:
 *  - すべて DB 側で並べる（取得済みの 1 ページだけを並べ替えない）。
 *  - 未設定値は昇順・降順とも末尾へ（Prisma の nulls: "last"）。
 *  - 同値は id で固定し、ページ境界で行が前後しないようにする。
 *  - 状態は enum の文字列順ではなく、業務上の並び（constants.ts の表示順）に合わせる
 *    ため、SQL 側では並べず sortIndex 列を使う（下の statusOrderBy を参照）。
 */
function buildOrderBy(
  sortField: string | undefined,
  direction: "asc" | "desc" = "desc",
): Prisma.AppointmentOrderByWithRelationInput[] {
  const dir = direction;
  const nulls = { sort: dir, nulls: "last" } as const;
  const tail: Prisma.AppointmentOrderByWithRelationInput = { id: "asc" };
  switch (sortField) {
    case "created_at":
      return [{ createdAt: dir }, tail];
    case "customer_name":
      return [{ customer: { name: dir } }, tail];
    case "area":
      return [{ customer: { area: nulls } }, tail];
    case "assignee":
      return [{ acquiredByUser: { name: dir } }, tail];
    case "company":
      // 自社取得（relationship なし）は末尾へ。
      return [{ acquiredRelationship: { dealer: { name: dir } } }, tail];
    case "appointment_type":
      return [{ appointmentType: nulls }, tail];
    case "partner_kind":
      return [{ partnerKind: nulls }, tail];
    case "event":
      return [{ event: { eventCandidate: { storeName: dir } } }, tail];
    case "status":
      return [{ status: dir }, tail];
    case "pre_call":
      return [{ preCall: { result: dir } }, tail];
    default:
      return [{ scheduledAt: dir }, tail];
  }
}

export interface AppointmentListItem {
  id: string;
  customerId: string;
  /** PII マスク済みの顧客名（顧客一覧と同じ maskName を通す）。 */
  customerName: string;
  /** 住所先頭の都道府県（Customer.area、無ければ住所から導出）。 */
  area: string | null;
  /** 取得担当者名。テナント外（二次店取得）は解決できず null。 */
  assigneeName: string | null;
  scheduledAt: string;
  /** Appointment.appointmentType（任意入力・未設定は null）。 */
  appointmentType: string | null;
  /** フォーム区分（初訪 / 訪問）。種別とは別概念。 */
  partnerKind: PartnerAppointmentKind | null;
  /** 取得したパートナー会社。自社取得は null。 */
  companyName: string | null;
  /** 獲得元催事（開催場所と開催日）。 */
  eventId: string | null;
  eventCandidateId: string | null;
  eventVenue: string | null;
  location: string | null;
  status: AppointmentStatus;
  /** マエカク（PreCall）の結果。未実施は null。 */
  preCallResult: PreCallResult | null;
  preCallCalledAt: string | null;
  /** 次に必要な対応 — PreCall.nextAction を優先し、無ければ Customer.nextAction。 */
  nextAction: string | null;
  acquiredOrgType: "WHOLESALER" | "DEALER";
  createdAt: string;
}

export interface PagedAppointmentResult {
  items: AppointmentListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listAppointments(
  filter: AppointmentListFilter = {},
): Promise<PagedAppointmentResult> {
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
    action: "appointment.read",
  });

  const page = Math.max(1, filter.page ?? 1);
  const skip = (page - 1) * PAGE_SIZE;

  return withTenant(ctx, async (tx) => {
    // PII マスクモードは顧客一覧（customers/data.ts）と同じ経路で解決する。
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

    const eventQ = filter.eventQuery?.trim();

    // 条件はすべて AND。未指定（"すべて"）の項目は where に足さない。
    const where: Prisma.AppointmentWhereInput = {
      customer: {
        wholesalerId: ctx.wholesalerId!,
        ...(queryStr ? { name: { contains: queryStr, mode: "insensitive" } } : {}),
        ...(filter.area ? { area: filter.area } : {}),
      },
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.assigneeUserId ? { acquiredByUserId: filter.assigneeUserId } : {}),
      ...(filter.relationshipId ? { acquiredRelationshipId: filter.relationshipId } : {}),
      ...(filter.appointmentType ? { appointmentType: filter.appointmentType } : {}),
      ...(filter.partnerKind ? { partnerKind: filter.partnerKind } : {}),
      ...(filter.eventId ? { eventId: filter.eventId } : {}),
      // 催事の「開催場所」で探す。訪問先住所（Appointment.location）とは別物。
      ...(eventQ
        ? { event: { eventCandidate: { storeName: { contains: eventQ, mode: "insensitive" } } } }
        : {}),
      // マエカク対応状況。未実施は PreCall が無い行。
      ...(filter.preCall === "NONE"
        ? { preCall: { is: null } }
        : filter.preCall
          ? { preCall: { is: { result: filter.preCall } } }
          : {}),
      ...(filter.from || filter.to
        ? {
            scheduledAt: {
              ...(filter.from ? { gte: new Date(filter.from) } : {}),
              // to は当日終端まで含める（日付入力の直感に合わせる）。
              ...(filter.to ? { lt: endOfDay(filter.to) } : {}),
            },
          }
        : {}),
      ...(filter.createdFrom || filter.createdTo
        ? {
            createdAt: {
              ...(filter.createdFrom ? { gte: new Date(filter.createdFrom) } : {}),
              ...(filter.createdTo ? { lt: endOfDay(filter.createdTo) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      tx.appointment.findMany({
        where,
        orderBy: buildOrderBy(filter.sortField, filter.sortDirection),
        skip,
        take: PAGE_SIZE,
        select: {
          id: true,
          customerId: true,
          scheduledAt: true,
          appointmentType: true,
          location: true,
          status: true,
          acquiredByUserId: true,
          acquiredOrgType: true,
          partnerKind: true,
          eventId: true,
          createdAt: true,
          customer: { select: { name: true, area: true, address: true, nextAction: true } },
          preCall: { select: { result: true, calledAt: true, nextAction: true } },
          // 関連にしたので、担当者名・会社名は同じクエリで取れる（追加の N+1 が要らない）。
          acquiredByUser: { select: { name: true } },
          acquiredRelationship: { select: { dealer: { select: { name: true } } } },
          event: { select: { eventCandidate: { select: { id: true, storeName: true } } } },
        },
      }),
      tx.appointment.count({ where }),
    ]);

    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (rows.length === 0) {
      return { items: [], total, page, pageSize: PAGE_SIZE, totalPages };
    }

    return {
      items: rows.map((r) => ({
        id: r.id,
        customerId: r.customerId,
        customerName: maskName(r.customer.name, viewer),
        area: r.customer.area ?? deriveArea(r.customer.address),
        assigneeName: r.acquiredByUser?.name ?? null,
        scheduledAt: r.scheduledAt.toISOString(),
        appointmentType: r.appointmentType,
        partnerKind: r.partnerKind,
        companyName: r.acquiredRelationship?.dealer.name ?? null,
        eventId: r.eventId,
        eventCandidateId: r.event?.eventCandidate.id ?? null,
        eventVenue: r.event?.eventCandidate.storeName ?? null,
        location: r.location,
        status: r.status,
        preCallResult: r.preCall?.result ?? null,
        preCallCalledAt: r.preCall?.calledAt.toISOString() ?? null,
        nextAction: r.preCall?.nextAction ?? r.customer.nextAction,
        acquiredOrgType: r.acquiredOrgType as "WHOLESALER" | "DEALER",
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages,
    };
  });
}

/** "YYYY-MM-DD" → 翌日 00:00（ローカル）。期間フィルタの上限を当日終端にする。 */
export function endOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

// ---------------------------------------------------------------------------
// 絞り込みの候補一覧
// ---------------------------------------------------------------------------
//
// いずれも一覧と同じ三段ガード（auth → assertCan(appointment.read) → withTenant）を
// 通すので、閲覧範囲の外の候補は出ない。候補の名称にも一覧と同じマスキングをかける
// （画面に出ない個人情報を、候補一覧から推測できるようにしない）。

async function requireAppointmentReadCtx() {
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
    action: "appointment.read",
  });
  return ctx;
}

export interface AppointmentFilterOptions {
  /** 顧客エリア（AreaType.CUSTOMER）。開催エリアとは値域が別なので混ぜない。 */
  areas: { value: string; label: string }[];
  /** 担当会社（パートナー会社）。 */
  companies: { value: string; label: string }[];
  /** アポイント種別。実データにある値だけを出す（使われていない選択肢を並べない）。 */
  appointmentTypes: { value: string; label: string }[];
  /** 獲得元催事。直近のものから。 */
  events: { value: string; label: string }[];
}

export async function listAppointmentFilterOptions(): Promise<AppointmentFilterOptions> {
  const ctx = await requireAppointmentReadCtx();
  return withTenant(ctx, async (tx) => {
    const [areas, rels, types, events] = await Promise.all([
      tx.area.findMany({
        where: { isActive: true, type: "CUSTOMER" },
        orderBy: { name: "asc" },
        select: { name: true },
      }),
      tx.relationship.findMany({
        where: { status: "ACTIVE" },
        orderBy: { dealer: { name: "asc" } },
        select: { id: true, dealer: { select: { name: true } } },
      }),
      tx.appointment.findMany({
        where: { appointmentType: { not: null } },
        distinct: ["appointmentType"],
        orderBy: { appointmentType: "asc" },
        select: { appointmentType: true },
      }),
      tx.event.findMany({
        orderBy: { eventCandidate: { scheduledDate: "desc" } },
        take: 100,
        select: {
          id: true,
          eventCandidate: { select: { storeName: true, scheduledDate: true } },
        },
      }),
    ]);

    return {
      areas: areas.map((a) => ({ value: a.name, label: a.name })),
      companies: rels.map((r) => ({ value: r.id, label: r.dealer.name })),
      appointmentTypes: types
        .map((t) => t.appointmentType)
        .filter((v): v is string => !!v)
        .map((v) => ({ value: v, label: v })),
      events: events.map((e) => ({
        value: e.id,
        label: `${e.eventCandidate.scheduledDate.toISOString().slice(0, 10)} ${e.eventCandidate.storeName}`,
      })),
    };
  });
}
