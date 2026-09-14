"use server";

// 二次店ポータル：販売員の登録・編集。
//
// wholesalerId / relationshipId / franchiseNo は requirePartnerContext が
// 認証情報から決める。フォームからは受け取らない（受け取る口自体を作らない）。
// 編集は必ず「自社の行か」を where で確認してから更新する。

import {
  PartnerSalespersonCreateSchema,
  PartnerSalespersonUpdateSchema,
  type PartnerSalespersonCreateInput,
  type PartnerSalespersonUpdateInput,
} from "@solar/contracts";
import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/lib/errors";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext } from "@/lib/partner/context";
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

  const created = await withTenant(partner.ctx, (tx) =>
    tx.salesperson.create({
      data: {
        // 所属はすべてサーバー側で決める。
        wholesalerId: partner.wholesalerId,
        relationshipId: partner.relationshipId,
        // 加盟店番号は Relationship 由来。入力させない（§6）。
        franchiseNo: partner.franchiseNo,
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
        note: parsed.note ?? null,
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
      where: { id: parsed.id, relationshipId: partner.relationshipId },
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
        note: parsed.note ?? null,
        ...(parsed.isActive !== undefined ? { isActive: parsed.isActive } : {}),
      },
    });

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${existing.id}`);
    return { id: existing.id };
  });
}
