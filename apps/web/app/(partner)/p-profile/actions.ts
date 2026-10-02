"use server";

// 個人設定の保存（スタッフ本人）。
//
// 正本は既存の販売員マスタ（Salesperson）。別のプロフィール表は作らない。
// 対象はログイン利用者に紐づく本人の行だけで、id はフォームから受け取らない
// （他人の id を送っても書き込み先にならない）。
//
// 書き込むのは許可リストの項目だけ。所属会社・加盟店番号・ロール・利用状態・
// ゲスト区分・利用者との紐付けは、送られてきても更新しない。
// ログイン資格情報（メールでのサインイン・パスワード）はここでは扱わない。

import {
  PartnerProfileUpdateSchema,
  pickProfileEditable,
  type PartnerProfileUpdateInput,
} from "@solar/contracts";
import { revalidatePath } from "next/cache";

import { NotFoundError } from "@/lib/errors";
import { labels } from "@/lib/i18n/labels";
import { requirePartnerContext } from "@/lib/partner/context";
import { salespersonScope } from "@/lib/partner/scope";
import { withTenant } from "@/lib/tenancy/with-tenant";

const BASE = "/p-profile";

export async function updateMyProfileAction(
  input: PartnerProfileUpdateInput,
): Promise<{ id: string }> {
  const partner = await requirePartnerContext("partner_profile.write");
  const parsed = PartnerProfileUpdateSchema.parse(input);

  return withTenant(partner.ctx, async (tx) => {
    const mine = await tx.salesperson.findFirst({
      where: { userId: partner.userId, ...salespersonScope(partner) },
      select: { id: true },
    });
    if (!mine) throw new NotFoundError(labels.partner.profile.errors.noSalesperson);

    // 許可リストで最後にもう一度絞る（スキーマの後ろでも書き込み先を固定する）。
    const values = pickProfileEditable(parsed as unknown as Record<string, unknown>);

    await tx.salesperson.update({
      where: { id: mine.id },
      data: {
        name: values.name as string,
        kana: (values.kana as string | undefined) ?? null,
        email: (values.email as string | undefined) ?? null,
        gender: (values.gender as never) ?? null,
        // 空欄は「未入力」として保存する（ダミー日付を作らない）。
        birthDate: values.birthDate
          ? new Date(`${values.birthDate as string}T00:00:00.000Z`)
          : null,
        phone: (values.phone as string | undefined) ?? null,
        address: (values.address as string | undefined) ?? null,
        residentAddress: (values.residentAddress as string | undefined) ?? null,
        employmentType: (values.employmentType as never) ?? null,
        salesExperience: (values.salesExperience as string | undefined) ?? null,
      },
    });

    revalidatePath(BASE);
    // 既存のスタッフ情報表示（管理者サイトの販売員一覧・詳細）にも反映する。
    revalidatePath("/p-salespeople");
    revalidatePath(`/p-salespeople/${mine.id}`);
    return { id: mine.id };
  });
}
