"use server";

// 二次店ポータル：販売員の登録・編集。
//
// wholesalerId / relationshipId / franchiseNo は requirePartnerContext が
// 認証情報から決める。フォームからは受け取らない（受け取る口自体を作らない）。
// 編集は必ず「自社の行か」を where で確認してから更新する。

// 備考（Salesperson.note）は Google フォームに無いので二次店ポータルでは書き換えない。
// 既存データと代理店側の編集はそのまま残す。
import {
  PartnerSalespersonCreateSchema,
  PartnerSalespersonUpdateSchema,
  type PartnerSalespersonCreateInput,
  type PartnerSalespersonUpdateInput,
} from "@solar/contracts";
import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/lib/errors";
import { labels } from "@/lib/i18n/labels";
import { companyRelationship, requirePartnerContext } from "@/lib/partner/context";
import { salespersonScope } from "@/lib/partner/scope";
import { withTenant } from "@/lib/tenancy/with-tenant";

const LIST_PATH = "/p-salespeople";

/** "YYYY-MM-DD" → Date。空はそのまま null（ダミー日付を作らない）。 */
function toDate(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createPartnerSalespersonAction(
  input: PartnerSalespersonCreateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_salesperson.write");
  const parsed = PartnerSalespersonCreateSchema.parse(input);

  const company = companyRelationship(partner);
  const created = await withTenant(partner.ctx, (tx) =>
    tx.salesperson.create({
      data: {
        // 所属はすべてサーバー側で決める。スタッフは「人」が単位なので、複数の代理店と
        // 取引していても行は複製せず、代表の取引関係に紐づける。
        wholesalerId: company.wholesalerId,
        relationshipId: company.id,
        // 加盟店番号は Relationship 由来。入力させない（§6）。
        franchiseNo: company.franchiseNo,
        name: parsed.name,
        kana: parsed.kana ?? null,
        email: parsed.email ?? null,
        gender: parsed.gender ?? null,
        birthDate: toDate(parsed.birthDate),
        phone: parsed.phone ?? null,
        address: parsed.address ?? null,
        residentAddress: parsed.residentAddress ?? null,
        employmentType: parsed.employmentType ?? null,
        salesExperience: parsed.salesExperience ?? null,
        // ゲスト区分。登録・招待・催事への追加は管理者だけ（この Action 自体が管理者限定）。
        isGuest: parsed.isGuest ?? false,
      },
      select: { id: true },
    }),
  );

  revalidatePath(LIST_PATH);
  return created;
}

export async function updatePartnerSalespersonAction(
  input: PartnerSalespersonUpdateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_salesperson.write");
  const parsed = PartnerSalespersonUpdateSchema.parse(input);

  return withTenant(partner.ctx, async (tx) => {
    // 自社の行であることを先に確認する。クライアントから来た id を
    // そのまま update に渡さない。
    const existing = await tx.salesperson.findFirst({
      where: { id: parsed.id, ...salespersonScope(partner) },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError(labels.partner.errors.notFound);

    await tx.salesperson.update({
      where: { id: existing.id },
      data: {
        name: parsed.name,
        kana: parsed.kana ?? null,
        email: parsed.email ?? null,
        gender: parsed.gender ?? null,
        birthDate: toDate(parsed.birthDate),
        phone: parsed.phone ?? null,
        address: parsed.address ?? null,
        residentAddress: parsed.residentAddress ?? null,
        employmentType: parsed.employmentType ?? null,
        salesExperience: parsed.salesExperience ?? null,
        // ゲスト区分。登録・招待・催事への追加は管理者だけ（この Action 自体が管理者限定）。
        isGuest: parsed.isGuest ?? false,
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
      },
    });

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${existing.id}`);
    return { id: existing.id };
  });
}
