// 二次店ポータル：販売員のデータローダー。
//
// 取得範囲は必ず自社（requirePartnerContext が解決した relationshipId）に限る。
// URL の id を書き換えても、where に relationshipId を必ず入れているうえ
// RLS も効くので他社の行は取得できない（見つからない = 404）。

import "server-only";

import { requirePartnerContext } from "@/lib/partner/context";
import { DEFAULT_PAGE_SIZE } from "@/lib/partner/list-query";
import { salespersonScope } from "@/lib/partner/scope";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { SalespersonListQuery } from "./query";
import type { Prisma } from "@solar/db";

export interface PartnerSalespersonListItem {
  id: string;
  name: string;
  kana: string | null;
  phone: string | null;
  employmentType: string | null;
  isActive: boolean;
  /** ゲストスタッフか（管理者が受け入れた外部スタッフ）。 */
  isGuest: boolean;
  /** 紐付いているログイン利用者の氏名。未紐付けなら null（推測はしない）。 */
  accountName: string | null;
}

export interface PartnerSalespersonListResult {
  rows: PartnerSalespersonListItem[];
  total: number;
  page: number;
  pageCount: number;
}

export interface PartnerSalespersonDetail extends PartnerSalespersonListItem {
  /** 紐付いているログイン利用者のメールアドレス（未紐付けなら null）。 */
  accountEmail: string | null;
  email: string | null;
  franchiseNo: string | null;
  gender: string | null;
  birthDate: string | null;
  address: string | null;
  residentAddress: string | null;
  salesExperience: string | null;
}

/**
 * 一覧。処理順は「権限による対象限定（自社）→ 絞り込み → 並べ替え → ページ分割」で、
 * すべて DB 側で行う（件数も同じ条件で数えるので、絞り込み後の件数がずれない）。
 */
export async function listPartnerSalespeople(
  q: SalespersonListQuery,
): Promise<PartnerSalespersonListResult> {
  const partner = await requirePartnerContext("partner_salesperson.read");
  return withTenant(partner.ctx, async (tx) => {
    const like = (v: string) => ({ contains: v, mode: "insensitive" as const });
    const where: Prisma.SalespersonWhereInput = {
      ...salespersonScope(partner),
      ...(q.keyword
        ? {
            OR: [
              { name: like(q.keyword) },
              { kana: like(q.keyword) },
              { phone: like(q.keyword) },
              { email: like(q.keyword) },
            ],
          }
        : {}),
      ...(q.employmentType ? { employmentType: q.employmentType } : {}),
      ...(q.isActive ? { isActive: q.isActive === "ACTIVE" } : {}),
      ...(q.link === "LINKED" ? { userId: { not: null } } : {}),
      ...(q.link === "UNLINKED" ? { userId: null } : {}),
    };

    // 既定（状態）のときは従来の並び（有効が先、カナ順）を保つ。
    const orderBy: Prisma.SalespersonOrderByWithRelationInput[] =
      q.sort.field === "isActive"
        ? [{ isActive: q.sort.direction }, { kana: "asc" }, { name: "asc" }, { id: "asc" }]
        : [{ [q.sort.field]: q.sort.direction }, { id: "asc" }];

    const total = await tx.salesperson.count({ where });
    const pageCount = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));
    const current = Math.min(q.page, pageCount);
    const rows = await tx.salesperson.findMany({
      where,
      orderBy,
      skip: (current - 1) * DEFAULT_PAGE_SIZE,
      take: DEFAULT_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        kana: true,
        phone: true,
        employmentType: true,
        isActive: true,
        isGuest: true,
        // 紐付いている利用者の氏名。紐付けの設定は利用者アカウント管理側で行う。
        user: { select: { name: true } },
      },
    });
    return {
      rows: rows.map((r) => ({
        id: r.id,
        name: r.name,
        kana: r.kana,
        phone: r.phone,
        employmentType: r.employmentType ?? null,
        isActive: r.isActive,
        isGuest: r.isGuest,
        accountName: r.user?.name ?? null,
      })),
      total,
      page: current,
      pageCount,
    };
  });
}

export async function getPartnerSalesperson(id: string): Promise<PartnerSalespersonDetail | null> {
  const partner = await requirePartnerContext("partner_salesperson.read");
  return withTenant(partner.ctx, async (tx) => {
    // relationshipId を where に含めるのが肝。id だけで引かない。
    const r = await tx.salesperson.findFirst({
      where: { id, ...salespersonScope(partner) },
      select: {
        id: true,
        name: true,
        kana: true,
        phone: true,
        employmentType: true,
        isActive: true,
        isGuest: true,
        email: true,
        franchiseNo: true,
        gender: true,
        birthDate: true,
        address: true,
        residentAddress: true,
        salesExperience: true,
        user: { select: { name: true, email: true } },
      },
    });
    if (!r) return null;
    const { user, ...rest } = r;
    return {
      ...rest,
      employmentType: r.employmentType ?? null,
      gender: r.gender ?? null,
      birthDate: r.birthDate ? r.birthDate.toISOString().slice(0, 10) : null,
      accountName: user?.name ?? null,
      accountEmail: user?.email ?? null,
    };
  });
}

/**
 * アポイント登録の担当者セレクト用（有効な自社販売員のみ）。
 *
 * 管理画面（partner_salesperson.read = 管理者のみ）とは別アクションで、スタッフも
 * 呼べる。返すのは id と氏名だけで、住所などの個人情報は出さない。
 */
export async function listPartnerSalespersonOptions(): Promise<{ id: string; name: string }[]> {
  const partner = await requirePartnerContext("partner_salesperson.options");
  return withTenant(partner.ctx, (tx) =>
    tx.salesperson.findMany({
      where: { ...salespersonScope(partner), isActive: true },
      orderBy: [{ kana: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  );
}
