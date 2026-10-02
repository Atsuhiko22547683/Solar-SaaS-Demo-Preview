// 二次店管理者が扱う「利用者アカウント」の入力スキーマ。
//
// 代理店側のシステムユーザー管理（members）とは別に持つ。あちらは
// OWNER / SYSTEM_ADMIN / GENERAL_USER の 3 階層で、二次店の利用区分は
// DEALER_ADMIN / DEALER_STAFF の 2 つだけ。ロール値域が違うので共有しない。
//
// tenantId（所属二次店）は入力に含めない。招待も更新も、操作した管理者の
// 所属テナント配下に限られる（サーバー側で決める / §6「認証情報から特定できる
// 情報は自動設定」）。
//
// 販売員との紐付け（Salesperson.userId）は管理者が明示的に指定する項目。
// 氏名の一致などからの自動紐付けはしない。

import { z } from "zod";

/** 二次店の利用区分。ここ以外の AppRole は二次店管理者からは指定できない。 */
export const PARTNER_ACCOUNT_ROLE_VALUES = ["DEALER_ADMIN", "DEALER_STAFF"] as const;
export type PartnerAccountRole = (typeof PARTNER_ACCOUNT_ROLE_VALUES)[number];

/**
 * 画面から指定できる利用状況。
 *
 * INVITED（招待済み・未ログイン）は招待の結果としてのみ発生し、
 * DELETED は二次店ポータルでは扱わない（代理店 / 運営側の操作）。
 */
export const PARTNER_ACCOUNT_STATUS_VALUES = ["ACTIVE", "SUSPENDED"] as const;
export type PartnerAccountStatus = (typeof PARTNER_ACCOUNT_STATUS_VALUES)[number];

export const PartnerAccountInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "メールアドレスを入力してください")
    .max(255)
    .refine((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), {
      message: "メールアドレスの形式が正しくありません",
    }),
  role: z.enum(PARTNER_ACCOUNT_ROLE_VALUES),
});
export type PartnerAccountInviteInput = z.input<typeof PartnerAccountInviteSchema>;

/**
 * 利用区分・利用状況・販売員との紐付けの更新。
 *
 * `.strict()` で、氏名・メール・テナント等が混ざっても受け付けない
 * （送っても無視されるのではなく、検証で落ちる）。
 * salespersonId は null で「紐付けを解除」を表す（undefined は「変更しない」）。
 */
export const PartnerAccountUpdateSchema = z
  .object({
    id: z.string().min(1),
    role: z.enum(PARTNER_ACCOUNT_ROLE_VALUES).optional(),
    status: z.enum(PARTNER_ACCOUNT_STATUS_VALUES).optional(),
    salespersonId: z.string().min(1).nullable().optional(),
  })
  .strict();
export type PartnerAccountUpdateInput = z.input<typeof PartnerAccountUpdateSchema>;
