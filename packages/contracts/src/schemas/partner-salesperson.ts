// 二次店が登録する販売員（Google フォームの販売員登録の置き換え）の入力スキーマ。
//
// 既存 SalespersonInputSchema（代理店の設定配下「スタッフ一覧」用）とは別に持つ。
// あちらは residentAddress / salesExperience / franchiseNo を入力から外している
// が、二次店のフォームはこの 3 項目を含むため、同じスキーマを共有できない。
// DB 列はいずれも既存なのでマイグレーションは不要。
//
// relationshipId / wholesalerId / franchiseNo（加盟店番号）は入力に含めない。
// 認証済みユーザーの所属からサーバー側で決まる（§6「認証情報から特定できる情報は
// 自動設定」）。

import { z } from "zod";

import { EMPLOYMENT_TYPE_VALUES, GENDER_VALUES } from "./salesperson.js";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

const baseShape = {
  /** 氏名（漢字）。フォーム上の唯一の必須項目。 */
  name: z.string().trim().min(1, "氏名（漢字）を入力してください").max(255),
  /** 氏名（カナ）。 */
  kana: optionalText(255),
  /** メールアドレス。 */
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
  /** 現住所（居住地）。 */
  address: optionalText(500),
  /** 住民票住所（現住所と異なる場合）。 */
  residentAddress: optionalText(500),
  employmentType: z.enum(EMPLOYMENT_TYPE_VALUES).optional(),
  /** 営業経験歴（自由記述: 「3年」「未経験」など）。 */
  salesExperience: optionalText(255),
  note: optionalText(2000),
};

export const PartnerSalespersonCreateSchema = z.object(baseShape);
export type PartnerSalespersonCreateInput = z.input<typeof PartnerSalespersonCreateSchema>;

export const PartnerSalespersonUpdateSchema = z.object({
  id: z.string().min(1),
  ...baseShape,
  /** 有効 / 無効。物理削除はしない。 */
  isActive: z.boolean().optional(),
});
export type PartnerSalespersonUpdateInput = z.input<typeof PartnerSalespersonUpdateSchema>;
