// 二次店ポータル：利用者アカウントのデータローダー（二次店管理者のみ）。
//
// 対象は「操作した管理者と同じテナント（＝同じ二次店）の User」だけ。
// tenantId を where に必ず入れたうえで RLS も効くので、他社の利用者は引けない。
//
// 二次店以外のロール（代理店・SaaS 運営者）を持つ User はこの画面の対象外にする。
// 値域の違うロールを二次店管理者が触れると、代理店側の権限まで書き換えられてしまう。
//
// 販売員との紐付けは Salesperson.userId（@unique）だけを根拠にする。氏名の一致
// などからの推測紐付けはしない（紐付け無しは「紐付け無し」のまま表示する）。

import "server-only";

import { requirePartnerContext } from "@/lib/partner/context";
import { DEFAULT_PAGE_SIZE } from "@/lib/partner/list-query";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { AccountListQuery } from "./query";
import type { AppRole, Prisma, TxClient } from "@solar/db";

/** 二次店側のロールだけを扱う。ここに無いロールの User は画面に出さない。 */
const DEALER_ROLES: AppRole[] = ["DEALER_ADMIN", "DEALER_STAFF"];

export interface PartnerAccountListItem {
  id: string;
  name: string;
  email: string;
  /** DEALER_ADMIN / DEALER_STAFF。両方持つ異常データは管理者として扱う。 */
  role: string;
  status: string;
  salespersonId: string | null;
  salespersonName: string | null;
  lastLoginAt: string | null;
  /** 自分自身の行か（自分の利用区分・利用状況は変えられない）。 */
  isSelf: boolean;
}

export interface PartnerAccountListResult {
  rows: PartnerAccountListItem[];
  total: number;
  page: number;
  pageCount: number;
  /** 所属二次店の表示名（変更はできないので表示だけ）。 */
  dealerName: string | null;
  franchiseNo: string | null;
}

export interface PartnerAccountDetail extends PartnerAccountListItem {
  createdAt: string;
  /** 紐付け先に選べる自社販売員（他の利用者に紐付いているものは除く）。 */
  salespersonOptions: { id: string; name: string }[];
  /** 自分以外に利用中の管理者がいるか（最後の管理者を降格・停止させないため）。 */
  hasOtherActiveAdmin: boolean;
}

/** 二次店ロールを 1 つに畳む。DEALER_ADMIN があれば管理者。 */
function roleOf(roles: { role: AppRole }[]): string {
  return roles.some((r) => r.role === "DEALER_ADMIN") ? "DEALER_ADMIN" : "DEALER_STAFF";
}

/** この画面が扱う User の共通条件（同一テナント × 二次店ロールのみ）。 */
function scopeWhere(tenantId: string): Prisma.UserWhereInput {
  return { tenantId, roles: { some: { role: { in: DEALER_ROLES } } } };
}

export async function listPartnerAccounts(q: AccountListQuery): Promise<PartnerAccountListResult> {
  const partner = await requirePartnerContext("partner_user.read");
  return withTenant(partner.ctx, async (tx) => {
    const where: Prisma.UserWhereInput = {
      ...scopeWhere(partner.tenantId),
      // 既定では削除済みを出さない。条件で明示したときだけ出す。
      ...(q.status ? { status: q.status } : { status: { not: "DELETED" } }),
      ...(q.role ? { roles: { some: { role: q.role } } } : {}),
      ...(q.keyword
        ? {
            OR: [
              { name: { contains: q.keyword, mode: "insensitive" } },
              { email: { contains: q.keyword, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(q.link === "LINKED" ? { salesperson: { isNot: null } } : {}),
      ...(q.link === "UNLINKED" ? { salesperson: { is: null } } : {}),
    };

    const orderBy: Prisma.UserOrderByWithRelationInput[] = [
      { [q.sort.field]: q.sort.direction },
      { id: "asc" },
    ];
    const total = await tx.user.count({ where });
    const pageCount = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));
    const current = Math.min(q.page, pageCount);
    const rows = await tx.user.findMany({
      where,
      orderBy,
      skip: (current - 1) * DEFAULT_PAGE_SIZE,
      take: DEFAULT_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        lastLoginAt: true,
        roles: { select: { role: true } },
        salesperson: { select: { id: true, name: true, relationshipId: true } },
      },
    });

    // 所属の表示（加盟店番号は Relationship 由来。ここでは変更させない）。
    // 取引先が複数あるときは代表として先頭（代理店名の昇順）を出す。
    const relationship = await tx.relationship.findFirst({
      where: { id: { in: partner.relationshipIds } },
      select: { franchiseNo: true, dealer: { select: { name: true } } },
    });

    return {
      rows: rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: roleOf(u.roles),
        status: u.status,
        // 他社の relationship に属する販売員が紐付いている異常データは表示しない。
        salespersonId:
          u.salesperson?.relationshipId != null &&
          partner.relationshipIds.includes(u.salesperson.relationshipId)
            ? u.salesperson.id
            : null,
        salespersonName:
          u.salesperson?.relationshipId != null &&
          partner.relationshipIds.includes(u.salesperson.relationshipId)
            ? u.salesperson.name
            : null,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        isSelf: u.id === partner.userId,
      })),
      total,
      page: current,
      pageCount,
      dealerName: relationship?.dealer.name ?? null,
      franchiseNo: relationship?.franchiseNo ?? null,
    };
  });
}

/** 他に「利用中の管理者」がいるか。最後の管理者を降格・停止させないための判定。 */
export async function countOtherActiveAdmins(
  tx: TxClient,
  tenantId: string,
  exceptUserId: string,
): Promise<number> {
  return tx.user.count({
    where: {
      tenantId,
      id: { not: exceptUserId },
      status: "ACTIVE",
      roles: { some: { role: "DEALER_ADMIN" } },
    },
  });
}

export async function getPartnerAccount(id: string): Promise<PartnerAccountDetail | null> {
  const partner = await requirePartnerContext("partner_user.read");
  return withTenant(partner.ctx, async (tx) => {
    const u = await tx.user.findFirst({
      where: { id, ...scopeWhere(partner.tenantId) },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        roles: { select: { role: true } },
        salesperson: { select: { id: true, name: true, relationshipId: true } },
      },
    });
    if (!u) return null;

    // 紐付け先の候補は「自社の販売員で、他の利用者に紐付いていないもの」＋
    // 本人に既に紐付いているもの。userId は @unique なので奪い合いにならない。
    const salespeople = await tx.salesperson.findMany({
      where: {
        relationshipId: { in: partner.relationshipIds },
        OR: [{ userId: null }, { userId: u.id }],
      },
      orderBy: [{ isActive: "desc" }, { kana: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    });

    const linked =
      u.salesperson?.relationshipId != null &&
      partner.relationshipIds.includes(u.salesperson.relationshipId);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: roleOf(u.roles),
      status: u.status,
      salespersonId: linked ? u.salesperson!.id : null,
      salespersonName: linked ? u.salesperson!.name : null,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      isSelf: u.id === partner.userId,
      createdAt: u.createdAt.toISOString(),
      salespersonOptions: salespeople,
      hasOtherActiveAdmin: (await countOtherActiveAdmins(tx, partner.tenantId, u.id)) > 0,
    };
  });
}
