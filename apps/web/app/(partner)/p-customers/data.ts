// 二次店ポータル：顧客・商談のデータローダー。
//
// 見える範囲が役割で変わる（customerScope）。
//   スタッフ … 本人が担当者として割り当てられている顧客・商談だけ。担当は既存列で判定する:
//              Customer.tossUpSalespersonId / closingSalespersonId = 本人の販売員
//              （Salesperson.userId 由来）、Deal.ownerUserId = 本人。
//              紐付けが無いアカウントは Deal.ownerUserId だけで判定する（推測はしない）。
//   管理者   … 自社（所属二次店）が保有する顧客すべて。他社の顧客は対象外。
//
// 個人情報は既存のマスキング方針（二次店向け d-customers と同じ ViewerContext）に従う。
// 顧客の基本情報を書き換えられるのは管理者だけで、その入口は actions.ts にある
// （スタッフが書き換えられるのは商談情報だけ）。

import "server-only";

import {
  isFullPiiViewer,
  maskAddress,
  maskName,
  maskPhone,
  type ViewerContext,
} from "@solar/contracts/services/masking";
import { rawPrisma } from "@solar/db";

import { requirePartnerContext, type PartnerContext } from "@/lib/partner/context";
import { DEFAULT_PAGE_SIZE, dateTimeBounds, hasBounds } from "@/lib/partner/list-query";
import {
  customerScope as companyCustomerScope,
  relationshipScope,
  salespersonScope,
} from "@/lib/partner/scope";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { CustomerListQuery } from "./query";
import type { Prisma } from "@solar/db";

export type AssignmentKind = "TOSS_UP" | "CLOSING" | "DEAL";

export interface PartnerCustomerListItem {
  id: string;
  name: string;
  assignments: AssignmentKind[];
  latestDealStatus: string | null;
  salesChannel: string | null;
  /** 顧客ステータス。管理者向けの列。 */
  status: string;
  /** 担当販売員（トス獲得者 / 営業担当者）。管理者向けの列。 */
  salespersonNames: string[];
  registeredAt: string;
  updatedAt: string;
}

export interface PartnerCustomerListResult {
  rows: PartnerCustomerListItem[];
  total: number;
  page: number;
  pageCount: number;
  /** お客様名で検索・並べ替えできるか（マスキング設定が FULL のときだけ）。 */
  canSearchName: boolean;
  /** 管理者のときだけ true。列・条件・編集導線の出し分けに使う。 */
  isAdmin: boolean;
  /** 担当販売員セレクトの選択肢（管理者のみ）。 */
  salespersonOptions: { id: string; name: string }[];
}

export interface PartnerDealSummary {
  id: string;
  status: string;
  /** 本人が担当（ownerUserId = 本人）の商談か。編集はこれが true のものだけ。 */
  mine: boolean;
  proposedProduct: string | null;
  proposedAmount: string | null;
  expectedContractDate: string | null;
  lostReason: string | null;
  nextAction: string | null;
  note: string | null;
  updatedAt: string;
}

export interface PartnerCustomerDetail {
  id: string;
  name: string;
  kana: string | null;
  phone: string;
  address: string | null;
  status: string;
  assignments: AssignmentKind[];
  registeredAt: string;
  deals: PartnerDealSummary[];
  /** 管理者のときだけ true（編集・削除の導線を出すかどうか）。 */
  isAdmin: boolean;
  /** 担当販売員の氏名（管理者向けの表示）。 */
  tossUpSalespersonName: string | null;
  closingSalespersonName: string | null;
}

/** 編集フォームの初期値。マスキングを掛けない生の値を返す。 */
export interface PartnerCustomerEditData {
  id: string;
  name: string;
  kana: string | null;
  phone: string;
  landlinePhone: string | null;
  mobilePhone: string | null;
  postalCode: string | null;
  prefecture: string | null;
  city: string | null;
  addressLine: string | null;
  status: string;
  tossUpSalespersonId: string | null;
  closingSalespersonId: string | null;
  note: string | null;
  salespersonOptions: { id: string; name: string }[];
}

/** 削除したときに一緒に消える関連データの件数（削除前の確認表示に使う）。 */
export interface PartnerCustomerImpact {
  deals: number;
  appointments: number;
  activities: number;
  tasks: number;
  callLogs: number;
  messages: number;
  loanReviews: number;
  existingEquipments: number;
  /** 削除を止める理由になる 2 つ。0 件でないと削除できない。 */
  contracts: number;
  files: number;
}

/** 削除できるか（できない場合はその理由）。影響件数はどちらでも返す。 */
export type PartnerCustomerDeletability =
  | { ok: true; impact: PartnerCustomerImpact }
  | { ok: false; reason: "CONTRACT" | "FILE"; impact: PartnerCustomerImpact };

/**
 * 画面が扱う顧客の範囲。一覧・詳細・編集・削除のすべてで同じ条件を使う。
 *
 * 通常スタッフ・ゲストスタッフ・管理者とも、所属パートナー会社が取り扱う顧客は全件。
 * 「本人担当分だけ」は閲覧の制限ではなく絞り込み条件（assignedToMe）として扱う。
 * 会社の外（無関係な他社の顧客）には出ない。
 */
export function customerScope(partner: PartnerContext): Prisma.CustomerWhereInput {
  return companyCustomerScope(partner);
}

/** 本人が担当の顧客だけに絞る条件（範囲の制限ではなく利用者の絞り込み）。 */
export function assignedToMe(partner: PartnerContext): Prisma.CustomerWhereInput {
  const bySalesperson: Prisma.CustomerWhereInput[] = partner.salespersonId
    ? [
        { tossUpSalespersonId: partner.salespersonId },
        { closingSalespersonId: partner.salespersonId },
      ]
    : [];
  return { OR: [...bySalesperson, { deals: { some: { ownerUserId: partner.userId } } }] };
}

async function viewerFor(partner: PartnerContext): Promise<ViewerContext> {
  // マスキング水準は取引先代理店の設定に従う（既存 d-customers と同じ解決）。
  // 取引先が複数あるときは、最も厳しい水準に倒す（緩い側に合わせない）。
  const settingsRows = await rawPrisma.wholesalerSettings.findMany({
    where: { wholesalerId: { in: partner.relationships.map((r) => r.wholesalerId) } },
    select: { piiMaskingMode: true },
  });
  const settings = settingsRows.some((r) => r.piiMaskingMode !== "FULL")
    ? { piiMaskingMode: "MASKED" as const }
    : settingsRows[0];
  return {
    role: partner.role === "ADMIN" ? "DEALER_ADMIN" : "DEALER_STAFF",
    tenantType: "DEALER",
    isSelfTenant: true,
    piiMaskingMode: (settings?.piiMaskingMode ?? "MASKED") as ViewerContext["piiMaskingMode"],
  };
}

function assignmentsOf(
  partner: PartnerContext,
  c: { tossUpSalespersonId: string | null; closingSalespersonId: string | null },
  hasMyDeal: boolean,
): AssignmentKind[] {
  const out: AssignmentKind[] = [];
  if (partner.salespersonId && c.tossUpSalespersonId === partner.salespersonId) out.push("TOSS_UP");
  if (partner.salespersonId && c.closingSalespersonId === partner.salespersonId)
    out.push("CLOSING");
  if (hasMyDeal) out.push("DEAL");
  return out;
}

/**
 * 一覧。権限による対象限定（本人担当）→ 絞り込み → 並べ替え → ページ分割を DB 側で行う。
 *
 * 商談ステータスの絞り込みは「本人担当の商談に該当ステータスがある顧客」で、
 * 顧客行は重複しない（deals.some による顧客単位の条件）。
 * お客様名の検索・並べ替えはマスキング設定が FULL のときだけ受け付ける
 * （非表示の名前を検索の抜け道にしない）。
 */
/** 報告の紐付け先に選べる顧客（自社が取り扱っている顧客）。 */
export interface PartnerCustomerOption {
  id: string;
  /** 「氏名（市区町村）」。同姓の取り違えを防ぐために住所の頭を添える。 */
  label: string;
}

/**
 * 訪問アポ報告・成約報告の「対象の顧客」の候補。
 *
 * 自社が取り扱っている顧客だけ。候補に出さないものはサーバー側でも弾く
 * （actions.ts の resolveVisitTarget / resolveContractTargetCustomerId）。
 */
export async function listPartnerCustomerOptions(limit = 300): Promise<PartnerCustomerOption[]> {
  const partner = await requirePartnerContext("customer.read");
  return withTenant(partner.ctx, async (tx) => {
    const rows = await tx.customer.findMany({
      where: customerScope(partner),
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, name: true, prefecture: true, addressLine: true },
    });
    return rows.map((r) => ({
      id: r.id,
      label: `${r.name}（${r.prefecture ?? ""}${r.addressLine ?? ""}）`,
    }));
  });
}

export async function listMyCustomers(q: CustomerListQuery): Promise<PartnerCustomerListResult> {
  const partner = await requirePartnerContext("partner_customer.read");
  const isAdmin = partner.role === "ADMIN";
  const viewer = await viewerFor(partner);
  const canSearchName = isFullPiiViewer(viewer);
  const name = canSearchName ? q.name : undefined;
  const sortField = q.sort.field === "name" && !canSearchName ? "createdAt" : q.sort.field;

  return withTenant(partner.ctx, async (tx) => {
    const createdBounds = dateTimeBounds(q.createdAt);
    // 商談ステータスの条件は、スタッフなら「本人担当の商談」、管理者なら
    // 「自社の商談」に対して効く（見える範囲と揃える）。
    const dealOwner = { ownerRelationshipId: { in: partner.relationshipIds } };
    const where: Prisma.CustomerWhereInput = {
      AND: [
        customerScope(partner),
        ...(name ? [{ name: { contains: name, mode: "insensitive" as const } }] : []),
        ...(q.salesChannel ? [{ salesChannel: q.salesChannel }] : []),
        ...(hasBounds(createdBounds) ? [{ createdAt: createdBounds }] : []),
        ...(q.dealStatus ? [{ deals: { some: { ...dealOwner, status: q.dealStatus } } }] : []),
        // フリガナは氏名と同じ扱い（マスキング中は canSearchName が false になるので使わせない）。
        ...(canSearchName && q.kana
          ? [{ kana: { contains: q.kana, mode: "insensitive" as const } }]
          : []),
        // 電話番号は代表・携帯・固定のいずれかに一致すればよい。
        ...(q.phone
          ? [
              {
                OR: [
                  { phone: { contains: q.phone } },
                  { mobilePhone: { contains: q.phone } },
                  { landlinePhone: { contains: q.phone } },
                ],
              },
            ]
          : []),
        // 住所は構造化列と旧来の 1 行住所の両方を見る。
        ...(q.address
          ? [
              {
                OR: [
                  { prefecture: { contains: q.address, mode: "insensitive" as const } },
                  { city: { contains: q.address, mode: "insensitive" as const } },
                  { addressLine: { contains: q.address, mode: "insensitive" as const } },
                  { address: { contains: q.address, mode: "insensitive" as const } },
                ],
              },
            ]
          : []),
        // 過去の催事場所。登録元の催事（id リンクと自由記述の両方）と、商談履歴の催事を見る。
        ...(q.venue
          ? [
              {
                OR: [
                  { sourceVenuePlace: { contains: q.venue, mode: "insensitive" as const } },
                  {
                    sourceEvent: {
                      eventCandidate: {
                        storeName: { contains: q.venue, mode: "insensitive" as const },
                      },
                    },
                  },
                  {
                    activities: {
                      some: {
                        event: {
                          eventCandidate: {
                            storeName: { contains: q.venue, mode: "insensitive" as const },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            ]
          : []),
        // 管理者だけの条件。スタッフの URL には現れないし、来ても query.ts が落とす。
        ...(isAdmin && q.status ? [{ status: q.status }] : []),
        ...(isAdmin && q.salespersonId
          ? [
              {
                OR: [
                  { tossUpSalespersonId: q.salespersonId },
                  { closingSalespersonId: q.salespersonId },
                ],
              },
            ]
          : []),
      ],
    };
    const orderBy: Prisma.CustomerOrderByWithRelationInput[] = [
      { [sortField]: q.sort.direction },
      { id: "asc" },
    ];
    const total = await tx.customer.count({ where });
    const pageCount = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));
    const current = Math.min(q.page, pageCount);
    const rows = await tx.customer.findMany({
      where,
      orderBy,
      skip: (current - 1) * DEFAULT_PAGE_SIZE,
      take: DEFAULT_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        salesChannel: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        tossUpSalespersonId: true,
        closingSalespersonId: true,
        tossUpSalesperson: { select: { name: true } },
        closingSalesperson: { select: { name: true } },
        deals: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, ownerUserId: true },
        },
      },
    });

    // 担当販売員セレクトの選択肢（管理者のみ）。無効な販売員も過去の担当として
    // 残っているので、絞り込みには全件を出す。
    const salespersonOptions = isAdmin
      ? await tx.salesperson.findMany({
          where: { ...salespersonScope(partner) },
          orderBy: [{ isActive: "desc" }, { kana: "asc" }, { name: "asc" }],
          select: { id: true, name: true },
        })
      : [];

    return {
      rows: rows.map((r) => ({
        id: r.id,
        name: maskName(r.name, viewer),
        assignments: assignmentsOf(
          partner,
          r,
          r.deals.some((d) => d.ownerUserId === partner.userId),
        ),
        latestDealStatus: r.deals[0]?.status ?? null,
        salesChannel: r.salesChannel,
        status: r.status,
        salespersonNames: [r.tossUpSalesperson?.name, r.closingSalesperson?.name].filter(
          (v): v is string => Boolean(v),
        ),
        registeredAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      total,
      page: current,
      pageCount,
      canSearchName,
      isAdmin,
      salespersonOptions,
    };
  });
}

export async function getMyCustomer(id: string): Promise<PartnerCustomerDetail | null> {
  const partner = await requirePartnerContext("partner_customer.read");
  const viewer = await viewerFor(partner);
  return withTenant(partner.ctx, async (tx) => {
    const c = await tx.customer.findFirst({
      where: { id, ...customerScope(partner) },
      select: {
        id: true,
        name: true,
        kana: true,
        phone: true,
        prefecture: true,
        city: true,
        addressLine: true,
        status: true,
        createdAt: true,
        tossUpSalespersonId: true,
        closingSalespersonId: true,
        tossUpSalesperson: { select: { name: true } },
        closingSalesperson: { select: { name: true } },
        deals: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            ownerUserId: true,
            proposedProduct: true,
            proposedAmount: true,
            expectedContractDate: true,
            lostReason: true,
            nextAction: true,
            note: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!c) return null;
    const address = [c.prefecture, c.city, c.addressLine].filter(Boolean).join("");
    return {
      id: c.id,
      name: maskName(c.name, viewer),
      kana: c.kana,
      phone: maskPhone(c.phone, viewer),
      address: address ? maskAddress(address, viewer) : null,
      status: c.status,
      assignments: assignmentsOf(
        partner,
        c,
        c.deals.some((d) => d.ownerUserId === partner.userId),
      ),
      registeredAt: c.createdAt.toISOString(),
      deals: c.deals.map((d) => ({
        id: d.id,
        status: d.status,
        mine: d.ownerUserId === partner.userId,
        proposedProduct: d.proposedProduct,
        proposedAmount: d.proposedAmount ? d.proposedAmount.toString() : null,
        expectedContractDate: d.expectedContractDate ? d.expectedContractDate.toISOString() : null,
        lostReason: d.lostReason,
        nextAction: d.nextAction,
        note: d.note,
        updatedAt: d.updatedAt.toISOString(),
      })),
      isAdmin: partner.role === "ADMIN",
      tossUpSalespersonName: c.tossUpSalesperson?.name ?? null,
      closingSalespersonName: c.closingSalesperson?.name ?? null,
    };
  });
}

/** 編集対象の商談。本人が担当（ownerUserId）で、所属二次店の商談に限る。 */
export async function getMyDeal(
  dealId: string,
): Promise<(PartnerDealSummary & { customerId: string; customerName: string }) | null> {
  const partner = await requirePartnerContext("partner_customer.read");
  const viewer = await viewerFor(partner);
  return withTenant(partner.ctx, async (tx) => {
    const d = await tx.deal.findFirst({
      // 自社の商談は担当者以外も開ける（引継ぎ・共同対応のため）。
      where: { id: dealId, ownerRelationshipId: { in: partner.relationshipIds } },
      select: {
        id: true,
        status: true,
        proposedProduct: true,
        proposedAmount: true,
        expectedContractDate: true,
        lostReason: true,
        nextAction: true,
        note: true,
        updatedAt: true,
        customer: { select: { id: true, name: true } },
      },
    });
    if (!d) return null;
    return {
      id: d.id,
      status: d.status,
      mine: true,
      proposedProduct: d.proposedProduct,
      proposedAmount: d.proposedAmount ? d.proposedAmount.toString() : null,
      expectedContractDate: d.expectedContractDate ? d.expectedContractDate.toISOString() : null,
      lostReason: d.lostReason,
      nextAction: d.nextAction,
      note: d.note,
      updatedAt: d.updatedAt.toISOString(),
      customerId: d.customer.id,
      customerName: maskName(d.customer.name, viewer),
    };
  });
}

/**
 * 顧客の編集フォームの初期値（二次店管理者のみ）。
 *
 * マスキングを掛けない生の値を返すので、個人情報が伏せられている設定
 * （piiMaskingMode !== FULL）のときは編集そのものを許さない。
 * 伏せられた値をそのまま保存すると、元の情報が失われるため。
 */
export async function getPartnerCustomerForEdit(
  id: string,
): Promise<{ canEdit: boolean; data: PartnerCustomerEditData | null }> {
  const partner = await requirePartnerContext("partner_customer.write");
  const viewer = await viewerFor(partner);
  if (!isFullPiiViewer(viewer)) return { canEdit: false, data: null };

  return withTenant(partner.ctx, async (tx) => {
    const c = await tx.customer.findFirst({
      where: { id, ...customerScope(partner) },
      select: {
        id: true,
        name: true,
        kana: true,
        phone: true,
        landlinePhone: true,
        mobilePhone: true,
        postalCode: true,
        prefecture: true,
        city: true,
        addressLine: true,
        status: true,
        tossUpSalespersonId: true,
        closingSalespersonId: true,
        note: true,
      },
    });
    if (!c) return { canEdit: true, data: null };

    const salespersonOptions = await tx.salesperson.findMany({
      where: { ...salespersonScope(partner) },
      orderBy: [{ isActive: "desc" }, { kana: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    });
    return { canEdit: true, data: { ...c, salespersonOptions } };
  });
}

/**
 * 削除できるかどうか。
 *
 * 契約（Contract）が紐づく顧客は削除しない。契約は粗利・インセンティブ・月次
 * 集計の起点で、顧客ごと消すとそれらの整合が壊れるため（取消は代理店の業務）。
 * 添付ファイル（CustomerFile）がある顧客も削除しない。行は Cascade で消えるが、
 * オブジェクトストレージ上の実体を消す経路がこの画面に無く、孤児が残るため。
 */
export async function checkPartnerCustomerDeletable(
  id: string,
): Promise<PartnerCustomerDeletability | null> {
  const partner = await requirePartnerContext("partner_customer.delete");
  return withTenant(partner.ctx, async (tx) => {
    const c = await tx.customer.findFirst({
      where: { id, ...customerScope(partner) },
      select: {
        id: true,
        _count: {
          select: {
            deals: true,
            appointments: true,
            activities: true,
            tasks: true,
            callLogs: true,
            messages: true,
            loanReviews: true,
            existingEquipments: true,
            contracts: true,
            files: true,
          },
        },
      },
    });
    if (!c) return null;
    const impact: PartnerCustomerImpact = { ...c._count };
    if (impact.contracts > 0) return { ok: false, reason: "CONTRACT", impact };
    if (impact.files > 0) return { ok: false, reason: "FILE", impact };
    return { ok: true, impact };
  });
}

// ---------------------------------------------------------------------------
// 商談履歴（接点の積み重ね）と業務情報
// ---------------------------------------------------------------------------

export interface PartnerActivityView {
  id: string;
  /** 何回目の接点か（古い順に 1 から）。行の修正では変わらない。 */
  seq: number;
  occurredAt: string;
  category: string;
  detail: string;
  amount: number | null;
  /** どこで（催事）。 */
  venuePlace: string | null;
  eventId: string | null;
  /** 誰が（接客した担当者）。 */
  assigneeName: string | null;
  /** 実際に登録した利用者。担当者とは別。 */
  createdByName: string | null;
  /** 直近に修正した利用者。 */
  updatedByName: string | null;
}

export interface PartnerNegotiationView {
  customerId: string;
  customerName: string;
  dealStatus: string;
  maekakuStatus: string | null;
  nextAppointmentAt: string | null;
  nextAction: string | null;
  assigneeUserId: string | null;
  /** 接点の一覧（古い順）。 */
  activities: PartnerActivityView[];
  /** 担当者の候補（自社の利用者）。引継ぎ・共同対応で選び直せる。 */
  memberOptions: { id: string; name: string }[];
  /** 「どこで」の候補（自社担当の催事）。 */
  eventOptions: { id: string; label: string }[];
  /** 成約報告の提出状況。ステータス変更とは別に扱う。 */
  contractReportCount: number;
  canEdit: boolean;
}

export async function getPartnerNegotiation(
  customerId: string,
): Promise<PartnerNegotiationView | null> {
  const partner = await requirePartnerContext("partner_customer.read");

  return withTenant(partner.ctx, async (tx) => {
    const customer = await tx.customer.findFirst({
      where: { id: customerId, AND: [customerScope(partner)] },
      select: {
        id: true,
        name: true,
        contractStatus: true,
        maekakuStatus: true,
        nextAppointmentAt: true,
        nextAction: true,
        nextAppointmentAssigneeUserId: true,
        activities: {
          orderBy: { occurredAt: "asc" },
          select: {
            id: true,
            occurredAt: true,
            category: true,
            detail: true,
            amount: true,
            eventId: true,
            assigneeUserId: true,
            createdByUserId: true,
            updatedByUserId: true,
            event: { select: { eventCandidate: { select: { storeName: true } } } },
          },
        },
      },
    });
    if (!customer) return null;

    const [members, events, contractReportCount] = await Promise.all([
      tx.user.findMany({
        where: { tenantId: partner.tenantId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      tx.event.findMany({
        where: { dealers: { some: { relationshipId: { in: partner.relationshipIds } } } },
        orderBy: { eventCandidate: { scheduledDate: "desc" } },
        take: 100,
        select: {
          id: true,
          eventCandidate: { select: { storeName: true, scheduledDate: true } },
        },
      }),
      // 成約報告は別の提出物。件数だけ見て、ステータスとは区別して表示する。
      tx.dealerContractReport.count({ where: { ...relationshipScope(partner) } }),
    ]);

    const memberNames = new Map(members.map((m) => [m.id, m.name]));

    return {
      customerId: customer.id,
      customerName: customer.name,
      dealStatus: customer.contractStatus,
      maekakuStatus: customer.maekakuStatus,
      nextAppointmentAt: customer.nextAppointmentAt?.toISOString() ?? null,
      nextAction: customer.nextAction,
      assigneeUserId: customer.nextAppointmentAssigneeUserId,
      activities: customer.activities.map((a, index) => ({
        id: a.id,
        seq: index + 1,
        occurredAt: a.occurredAt.toISOString(),
        category: a.category,
        detail: a.detail,
        amount: a.amount,
        venuePlace: a.event?.eventCandidate.storeName ?? null,
        eventId: a.eventId,
        assigneeName: a.assigneeUserId ? (memberNames.get(a.assigneeUserId) ?? null) : null,
        createdByName: memberNames.get(a.createdByUserId) ?? null,
        updatedByName: a.updatedByUserId ? (memberNames.get(a.updatedByUserId) ?? null) : null,
      })),
      memberOptions: members,
      eventOptions: events.map((e) => {
        const d = e.eventCandidate.scheduledDate;
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return { id: e.id, label: `${date} ${e.eventCandidate.storeName}` };
      }),
      contractReportCount,
      canEdit: true,
    };
  });
}
