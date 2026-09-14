// 二次店ポータル：販売員のデータローダー。
//
// 取得範囲は必ず自社（requirePartnerContext が解決した relationshipId）に限る。
// URL の id を書き換えても、where に relationshipId を必ず入れているうえ
// RLS も効くので他社の行は取得できない（見つからない = 404）。

import "server-only";

import { requirePartnerContext } from "@/lib/partner/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

export interface PartnerSalespersonListItem {
  id: string;
  name: string;
  kana: string | null;
  phone: string | null;
  employmentType: string | null;
  isActive: boolean;
}

export interface PartnerSalespersonDetail extends PartnerSalespersonListItem {
  email: string | null;
  franchiseNo: string | null;
  gender: string | null;
  birthDate: string | null;
  address: string | null;
  residentAddress: string | null;
  salesExperience: string | null;
  note: string | null;
}

export async function listPartnerSalespeople(): Promise<PartnerSalespersonListItem[]> {
  const partner = await requirePartnerContext("partner_salesperson.read");
  return withTenant(partner.ctx, async (tx) => {
    const rows = await tx.salesperson.findMany({
      where: { relationshipId: partner.relationshipId },
      orderBy: [{ isActive: "desc" }, { kana: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        kana: true,
        phone: true,
        employmentType: true,
        isActive: true,
      },
    });
    return rows.map((r) => ({ ...r, employmentType: r.employmentType ?? null }));
  });
}

export async function getPartnerSalesperson(id: string): Promise<PartnerSalespersonDetail | null> {
  const partner = await requirePartnerContext("partner_salesperson.read");
  return withTenant(partner.ctx, async (tx) => {
    // relationshipId を where に含めるのが肝。id だけで引かない。
    const r = await tx.salesperson.findFirst({
      where: { id, relationshipId: partner.relationshipId },
      select: {
        id: true,
        name: true,
        kana: true,
        phone: true,
        employmentType: true,
        isActive: true,
        email: true,
        franchiseNo: true,
        gender: true,
        birthDate: true,
        address: true,
        residentAddress: true,
        salesExperience: true,
        note: true,
      },
    });
    if (!r) return null;
    return {
      ...r,
      employmentType: r.employmentType ?? null,
      gender: r.gender ?? null,
      birthDate: r.birthDate ? r.birthDate.toISOString().slice(0, 10) : null,
    };
  });
}

/** アポイント登録の担当者セレクト用（有効な自社販売員のみ）。 */
export async function listPartnerSalespersonOptions(): Promise<{ id: string; name: string }[]> {
  const partner = await requirePartnerContext("partner_salesperson.read");
  return withTenant(partner.ctx, (tx) =>
    tx.salesperson.findMany({
      where: { relationshipId: partner.relationshipId, isActive: true },
      orderBy: [{ kana: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  );
}
