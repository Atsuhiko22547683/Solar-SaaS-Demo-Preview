// 個人設定（スタッフ本人）。正本は既存の販売員マスタ（Salesperson）。
//
// ログイン利用者から本人の Salesperson を特定する。id はフォームから受け取らない。

import "server-only";

import { requirePartnerContext } from "@/lib/partner/context";
import { salespersonScope } from "@/lib/partner/scope";
import { withTenant } from "@/lib/tenancy/with-tenant";

export interface PartnerProfile {
  /** 表示のみ（本人が直せない項目）。 */
  companyName: string;
  franchiseNo: string | null;
  isActive: boolean;
  isGuest: boolean;
  /** ログイン用のメールアドレス（資格情報なのでここでは直せない）。 */
  loginEmail: string;

  /** 本人が直せる項目。 */
  name: string;
  kana: string | null;
  email: string | null;
  gender: string | null;
  birthDate: string | null;
  phone: string | null;
  address: string | null;
  residentAddress: string | null;
  employmentType: string | null;
  salesExperience: string | null;
}

/**
 * 本人の販売員情報。
 *
 * 販売員マスタと紐付いていない利用者（管理者が作ったログインだけの状態）では null。
 * その場合は画面で案内し、勝手にレコードを作らない。
 */
export async function getMyProfile(): Promise<PartnerProfile | null> {
  const partner = await requirePartnerContext("partner_profile.read");

  return withTenant(partner.ctx, async (tx) => {
    const row = await tx.salesperson.findFirst({
      // 本人の利用者に紐づく販売員だけ。自社の範囲も併せて絞る。
      where: { userId: partner.userId, ...salespersonScope(partner) },
      select: {
        name: true,
        kana: true,
        email: true,
        gender: true,
        birthDate: true,
        phone: true,
        address: true,
        residentAddress: true,
        employmentType: true,
        salesExperience: true,
        franchiseNo: true,
        isActive: true,
        isGuest: true,
        relationship: { select: { dealer: { select: { name: true } } } },
      },
    });
    if (!row) return null;

    const user = await tx.user.findFirst({
      where: { id: partner.userId },
      select: { email: true },
    });

    return {
      companyName: row.relationship?.dealer.name ?? "—",
      franchiseNo: row.franchiseNo,
      isActive: row.isActive,
      isGuest: row.isGuest,
      loginEmail: user?.email ?? "—",
      name: row.name,
      kana: row.kana,
      email: row.email,
      gender: row.gender,
      // 生年月日は暦日。UTC 基準で切り出して往復させ、日付ずれを起こさない。
      birthDate: row.birthDate ? row.birthDate.toISOString().slice(0, 10) : null,
      phone: row.phone,
      address: row.address,
      residentAddress: row.residentAddress,
      employmentType: row.employmentType,
      salesExperience: row.salesExperience,
    };
  });
}
