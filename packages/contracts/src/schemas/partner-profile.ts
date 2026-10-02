// スタッフ本人が直せる「個人設定」の入力スキーマ。
//
// 正本は既存の Salesperson（販売員マスタ）。別のプロフィール表は作らない。
// ログイン利用者から本人の Salesperson を特定するので、対象の id は受け取らない。
//
// 直せるのは本人の連絡先・住所などに限る（許可リスト）。
//   変更不可: 所属会社（relationshipId / wholesalerId）、加盟店番号、ロール、
//             利用状態（isActive）、ゲスト区分（isGuest）、利用者との紐付け（userId）。
//   ログイン資格情報（メールでのサインイン・パスワード）はここでは扱わない。

import { z } from "zod";

import { EMPLOYMENT_TYPE_VALUES, GENDER_VALUES } from "./salesperson.js";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

/**
 * 本人が直せる項目の許可リスト。
 *
 * Server Action はこのキーだけを取り出して更新する。ここに無いキーが送られても
 * 無視する（スキーマが落とすので、書き込み先に届かない）。
 */
export const PARTNER_PROFILE_EDITABLE_FIELDS = [
  "name",
  "kana",
  "email",
  "gender",
  "birthDate",
  "phone",
  "address",
  "residentAddress",
  "employmentType",
  "salesExperience",
] as const;

export type PartnerProfileEditableField = (typeof PARTNER_PROFILE_EDITABLE_FIELDS)[number];

export const PartnerProfileUpdateSchema = z
  .object({
    /** 氏名（漢字）。本人を特定する表示名なので必須。 */
    name: z.string().trim().min(1, "氏名（漢字）を入力してください").max(255),
    kana: optionalText(255),
    email: z
      .string()
      .trim()
      .max(255)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined))
      .refine((v) => v === undefined || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), {
        message: "メールアドレスの形式が正しくありません",
      }),
    gender: z.enum(GENDER_VALUES).optional(),
    /** 生年月日。`YYYY-MM-DD`。未入力は undefined（ダミー日付を保存しない）。 */
    birthDate: optionalText(32),
    phone: optionalText(32),
    address: optionalText(500),
    residentAddress: optionalText(500),
    employmentType: z.enum(EMPLOYMENT_TYPE_VALUES).optional(),
    salesExperience: optionalText(255),
  })
  // 許可リスト外のキーは受け取らない（送られても落とす）。
  .strip();

export type PartnerProfileUpdateInput = z.input<typeof PartnerProfileUpdateSchema>;
export type PartnerProfileUpdateValues = z.output<typeof PartnerProfileUpdateSchema>;

/** 許可リストのキーだけを残す（書き込み直前の最後の絞り込み）。 */
export function pickProfileEditable(
  values: Record<string, unknown>,
): Partial<Record<PartnerProfileEditableField, unknown>> {
  const out: Partial<Record<PartnerProfileEditableField, unknown>> = {};
  for (const key of PARTNER_PROFILE_EDITABLE_FIELDS) {
    if (key in values) out[key] = values[key];
  }
  return out;
}
