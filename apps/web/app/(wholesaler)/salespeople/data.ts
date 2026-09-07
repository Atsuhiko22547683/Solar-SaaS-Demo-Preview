// スタッフ一覧の server-side data loader（設定配下「スタッフ一覧」）。
//
// テナント境界は他のマスタ（Installer / VenueProvider）と同じく wholesalerId 直持ち。
// auth → assertCan("salesperson.read") → withTenant（RLS + Prisma extension の二重防御）
// を通し、別テナントの販売員は取得も更新もできない。
//
// PII: 販売員は 生年月日 / 電話 / メール / 現住所 / 住民票住所 を持つため、一覧が返す値は
// WholesalerSettings.piiMaskingMode 由来の ViewerContext でマスクする（CLAUDE.md ルール 6）。
// 住所は一覧に全文を出さない（maskAddress で市区町村までに丸める）。
// 編集フォームは生値が必要なので getSalespersonEditable() を別に用意し、
// そちらは salesperson.update 権限を要求する。

import "server-only";

import { maskAddress, maskName, maskPhone } from "@solar/contracts/services/masking";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { StaffAffiliation } from "@solar/contracts";
import type { ViewerContext } from "@solar/contracts/services/masking";
import type { Prisma } from "@solar/db";

export const PAGE_SIZE = 50;

export interface SalespersonListFilter {
  /** 表示するタブ。self = 自社スタッフ / dealer = 二次店スタッフ。既定は self。 */
  affiliation?: StaffAffiliation;
  /** 氏名 / カナの部分一致（大文字小文字を無視）。 */
  query?: string;
  /** 所属二次店（Relationship.id）の完全一致。dealer タブでのみ使う。 */
  relationshipId?: string;
  /** 雇用形態の完全一致。 */
  employmentType?: string;
  /** 並び替え（項目 × 昇順/降順）。未指定は氏名カナの昇順。 */
  sortField?: string;
  sortDirection?: "asc" | "desc";
  page?: number;
}

export interface SalespersonListItem {
  /** Salesperson.id。 */
  id: string;
  /** PII マスク済みの表示氏名。 */
  name: string;
  kana: string | null;
  /** 所属会社名（加盟店名）。二次店は Relationship→Tenant、自社は自テナント名から導出。 */
  companyName: string;
  /** 所属二次店 ID。自社スタッフは null。 */
  relationshipId: string | null;
  /** トスアップ担当の顧客数（明示リンク + userId 経由の既存実績。重複は 1 件に畳む）。 */
  tossUpCustomerCount: number;
  /** クロージング担当の顧客数（同上）。 */
  closingCustomerCount: number;
  /** イベント担当件数（EventSalesperson）。eventId × salespersonId は一意なので二重に数えない。 */
  eventAssignmentCount: number;
  employmentType: string | null;
  /** マスク済み電話番号。未設定は null。 */
  phone: string | null;
  email: string | null;
  // --- 以下は展開バナー専用（通常行には出さない） ---
  gender: string | null;
  birthDate: string | null;
  /** マスク済み現住所（一覧に全文は出さない）。 */
  address: string | null;
  isActive: boolean;
  /** 並び替え（登録日時）用。スタッフ行があればその作成日時、無ければ User の作成日時。 */
  createdAt: string;
}

export interface PagedSalespersonResult {
  items: SalespersonListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** テナント文脈 + PII マスキング設定をまとめて解決する（一覧・編集で共有）。 */
async function requireCtx(action: "salesperson.read" | "salesperson.update") {
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
    action,
  });
  return { session, ctx };
}
/**
 * スタッフ一覧。
 *
 * スタッフ（Salesperson）とシステムユーザー（User）は別物として扱う。
 * この一覧は Salesperson だけを返し、ログインアカウントの有無や
 * User との紐付けは扱わない（それは設定 > システムユーザーの責務）。
 *
 * 論理削除（isActive = false）した行は通常一覧に出さない。行自体は残るので、
 * 過去の顧客担当実績やイベントアサインからの参照は切れない。
 */
export async function listSalespeople(
  filter: SalespersonListFilter = {},
): Promise<PagedSalespersonResult> {
  const { session, ctx } = await requireCtx("salesperson.read");

  const page = Math.max(1, filter.page ?? 1);
  const skip = (page - 1) * PAGE_SIZE;
  const affiliation: StaffAffiliation = filter.affiliation ?? "self";
  const queryStr = filter.query?.trim().toLowerCase();
  const direction = filter.sortDirection ?? "asc";

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

    // 自社スタッフの所属会社名として表示する自テナント名。
    const selfTenant = ctx.wholesalerId
      ? await tx.tenant.findUnique({ where: { id: ctx.wholesalerId }, select: { name: true } })
      : null;
    const selfCompanyName = selfTenant?.name ?? "—";

    const where: Prisma.SalespersonWhereInput = {
      // 論理削除済みは通常一覧に出さない。
      isActive: true,
      ...(affiliation === "dealer"
        ? filter.relationshipId
          ? { relationshipId: filter.relationshipId }
          : { relationshipId: { not: null } }
        : { relationshipId: null }),
      ...(filter.employmentType
        ? {
            employmentType: filter.employmentType as Prisma.SalespersonWhereInput["employmentType"],
          }
        : {}),
      ...(queryStr
        ? {
            OR: [
              { name: { contains: queryStr, mode: "insensitive" } },
              { kana: { contains: queryStr, mode: "insensitive" } },
              { email: { contains: queryStr, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.SalespersonOrderByWithRelationInput[] =
      filter.sortField === "created_at"
        ? [{ createdAt: direction }]
        : filter.sortField === "company"
          ? [{ relationshipId: direction }, { name: direction }]
          : [{ kana: direction }, { name: direction }];

    const [rows, total] = await Promise.all([
      tx.salesperson.findMany({
        where,
        orderBy,
        skip,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          kana: true,
          relationshipId: true,
          relationship: { select: { dealer: { select: { name: true } } } },
          gender: true,
          birthDate: true,
          phone: true,
          email: true,
          address: true,
          employmentType: true,
          isActive: true,
          createdAt: true,
        },
      }),
      tx.salesperson.count({ where }),
    ]);

    const items: SalespersonListItem[] = rows.map((r) => ({
      id: r.id,
      name: maskName(r.name, viewer),
      kana: r.kana,
      companyName: r.relationship?.dealer.name ?? selfCompanyName,
      relationshipId: r.relationshipId,
      tossUpCustomerCount: 0,
      closingCustomerCount: 0,
      eventAssignmentCount: 0,
      employmentType: r.employmentType,
      phone: r.phone ? maskPhone(r.phone, viewer) : null,
      email: r.email,
      gender: r.gender,
      birthDate: r.birthDate ? r.birthDate.toISOString() : null,
      address: r.address ? maskAddress(r.address, viewer) : null,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
    }));

    // 担当実績は Salesperson への明示リンクだけを数える。
    // User 経由（*UserId）の過去データは、スタッフとユーザーを分離した以降は
    // スタッフの実績としては数えない（表示は顧客詳細側の fallback が担う）。
    //
    // イベント担当は EventSalesperson から数える。@@unique([eventId, salespersonId])
    // があるので同じイベントが 2 回数えられることはない。
    await Promise.all(
      items.map(async (item) => {
        const [tossUp, closing, events] = await Promise.all([
          tx.customer.count({ where: { tossUpSalespersonId: item.id } }),
          tx.customer.count({ where: { closingSalespersonId: item.id } }),
          tx.eventSalesperson.count({ where: { salespersonId: item.id } }),
        ]);
        item.tossUpCustomerCount = tossUp;
        item.closingCustomerCount = closing;
        item.eventAssignmentCount = events;
      }),
    );

    return {
      items,
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE),
    };
  });
}

/** 編集フォーム用の生値。マスクしないので salesperson.update 権限を要求する。 */
export interface SalespersonEditable {
  id: string;
  name: string;
  kana: string | null;
  relationshipId: string | null;
  userId: string | null;
  gender: string | null;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  employmentType: string | null;
  note: string | null;
  isActive: boolean;
}

export async function getSalespersonEditable(id: string): Promise<SalespersonEditable | null> {
  const { ctx } = await requireCtx("salesperson.update");

  return withTenant(ctx, async (tx) => {
    const row = await tx.salesperson.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        kana: true,
        relationshipId: true,
        userId: true,
        gender: true,
        birthDate: true,
        phone: true,
        email: true,
        address: true,
        employmentType: true,
        note: true,
        isActive: true,
      },
    });
    if (!row) return null;
    return { ...row, birthDate: row.birthDate ? row.birthDate.toISOString() : null };
  });
}

/** イベントへのアサイン用の選択肢（有効な販売員だけ・氏名はマスクしない業務表示）。 */
export interface SalespersonOption {
  id: string;
  name: string;
  /** 所属会社名（加盟店名）。二次店は Relationship 由来、自社は自テナント名。 */
  companyName: string;
}

/** スタッフ登録フォームの所属二次店の選択肢。 */
export interface StaffRelationshipOption {
  id: string;
  dealerName: string;
}

/**
 * 所属二次店の選択肢（ACTIVE な Relationship）。
 *
 * 加盟店名は Relationship → Tenant から引くだけで、Salesperson 側へ文字列を複製しない。
 */
export async function listStaffRelationshipOptions(): Promise<StaffRelationshipOption[]> {
  const { ctx } = await requireCtx("salesperson.read");
  return withTenant(ctx, async (tx) => {
    const rows = await tx.relationship.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { id: true, dealer: { select: { name: true } } },
    });
    return rows.map((r) => ({ id: r.id, dealerName: r.dealer.name }));
  });
}

/** 顧客担当者に指定できるスタッフ 1 件。 */
export interface AssignableStaffOption {
  id: string;
  name: string;
  /** 所属二次店。null なら自社スタッフ。 */
  relationshipId: string | null;
  /** 紐付く自社ログイン User（自社スタッフのみ）。 */
  userId: string | null;
}

/**
 * 顧客のトスアップ / クロージング担当に選べるスタッフ一覧（有効なものだけ）。
 *
 * 自社・二次店の両方を返し、呼び出し側が relationshipId で振り分ける。
 * 氏名は業務表示なのでマスクしない（担当者選択と同じ扱い）。
 */
export async function listAssignableStaff(): Promise<AssignableStaffOption[]> {
  const { ctx } = await requireCtx("salesperson.read");
  return withTenant(ctx, async (tx) => {
    const rows = await tx.salesperson.findMany({
      where: { isActive: true },
      orderBy: [{ kana: { sort: "asc", nulls: "last" } }, { name: "asc" }],
      select: { id: true, name: true, relationshipId: true, userId: true },
    });
    return rows;
  });
}

/** スタッフ登録・編集フォームが必要とする選択肢一式。 */
export interface StaffFormOptions {
  relationships: StaffRelationshipOption[];
  linkableUsers: LinkableUserOption[];
  /** 自社スタッフの所属会社として表示する自テナント名。 */
  selfCompanyName: string;
}

/**
 * 登録・編集フォーム用の選択肢をまとめて取得する。
 *
 * 3 つの読み取りを 1 つの withTenant トランザクションで済ませる。
 * ローダーごとに withTenant を張ると、1 ページの描画で同時に開くトランザクションが
 * 増えてコネクションプールを圧迫するため（編集ページは別途 getSalespersonEditable も呼ぶ）。
 */
export async function getStaffFormOptions(): Promise<StaffFormOptions> {
  const { ctx } = await requireCtx("salesperson.read");
  return withTenant(ctx, async (tx) => {
    const tenant = ctx.wholesalerId
      ? await tx.tenant.findUnique({ where: { id: ctx.wholesalerId }, select: { name: true } })
      : null;

    const relationshipRows = await tx.relationship.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { id: true, dealer: { select: { name: true } } },
    });

    const userRows = await tx.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, salesperson: { select: { name: true } } },
    });

    return {
      relationships: relationshipRows.map((r) => ({ id: r.id, dealerName: r.dealer.name })),
      linkableUsers: userRows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        linkedToStaffName: u.salesperson?.name ?? null,
      })),
      selfCompanyName: tenant?.name ?? "—",
    };
  });
}

/** 同一人物リンク用の自社ログイン User 候補。 */
export interface LinkableUserOption {
  id: string;
  name: string;
  email: string;
  /** すでに別のスタッフへ紐付いている場合の相手氏名（重複リンク防止の表示用）。 */
  linkedToStaffName: string | null;
}

/**
 * 自社ログイン User の一覧（スタッフとの任意リンク用）。
 *
 * RLS により自テナントの User しか見えない = 二次店の User はここに出ない。
 * 二次店スタッフでは所属会社（Relationship）だけを持ち、User リンクは常に無し。
 */
export async function listLinkableUsers(): Promise<LinkableUserOption[]> {
  const { ctx } = await requireCtx("salesperson.read");
  return withTenant(ctx, async (tx) => {
    const rows = await tx.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, salesperson: { select: { name: true } } },
    });
    return rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      linkedToStaffName: u.salesperson?.name ?? null,
    }));
  });
}

/**
 * salesperson.update を持つか（例外を投げずに真偽で返す）。
 *
 * アサイン UI の編集可否に使う。書き込み自体は assignEventSalespeopleAction 側で
 * 同じ権限を assertCan するので、ここは「押せないボタンを出さない」ための表示制御。
 */
export async function canUpdateSalesperson(): Promise<boolean> {
  try {
    await requireCtx("salesperson.update");
    return true;
  } catch {
    return false;
  }
}

export async function listActiveSalespeople(): Promise<SalespersonOption[]> {
  const { ctx } = await requireCtx("salesperson.read");
  return withTenant(ctx, async (tx) => {
    const selfTenant = ctx.wholesalerId
      ? await tx.tenant.findUnique({ where: { id: ctx.wholesalerId }, select: { name: true } })
      : null;
    const rows = await tx.salesperson.findMany({
      where: { isActive: true },
      orderBy: [{ kana: { sort: "asc", nulls: "last" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        relationship: { select: { dealer: { select: { name: true } } } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      companyName: r.relationship?.dealer.name ?? selfTenant?.name ?? "—",
    }));
  });
}
