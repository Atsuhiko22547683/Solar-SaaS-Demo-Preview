// 商談履歴（接点）と、顧客の業務情報の更新。
//
// 商談履歴の考え方:
//   1 回の接点 = 1 行。「いつ・どこで・誰が・何を行い・どうなったか」を 1 行に持つ。
//   接点が積み重なると 1 回目 / 2 回目 / 3 回目 … と数えられる。
//   既存行の誤記を直しても行は増えないので、修正で回数は変わらない。
//
// 「訪問アポ = 顧客との 2 回目以降の接点」という定義はまだ無いので、商談回数から
// 初訪 / 訪問のフォーム区分を自動判定はしない（フォームの選択はそのまま尊重する）。

import { z } from "zod";

/**
 * 接点の種別。既存の顧客詳細（代理店側）の category コードに合わせる。
 * 値の意味を変えたくないので、新しいコードは足さずにこの集合を使う。
 */
export const PARTNER_ACTIVITY_CATEGORY_VALUES = [
  "tossup",
  "event",
  "appointment",
  "visit",
  "quote",
  "phone",
  "email",
  "other",
] as const;
export type PartnerActivityCategory = (typeof PARTNER_ACTIVITY_CATEGORY_VALUES)[number];

const toDate = (v: string | Date): Date => (v instanceof Date ? v : new Date(v));

const dateTime = (label: string) =>
  z
    .union([z.string(), z.date()])
    .refine((v) => v !== "" && !Number.isNaN(toDate(v).getTime()), {
      message: `${label}を入力してください`,
    })
    .transform((v) => toDate(v));

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

export const PartnerActivityCreateSchema = z.object({
  customerId: z.string().trim().min(1).max(64),
  /** いつ。 */
  occurredAt: dateTime("接点の日時"),
  /** 何を行ったか。 */
  category: z.enum(PARTNER_ACTIVITY_CATEGORY_VALUES, {
    required_error: "種別を選択してください",
    invalid_type_error: "種別を選択してください",
  }),
  /** どうなったか（内容・結果）。 */
  detail: z.string().trim().min(1, "内容を入力してください").max(4000),
  /** どこで（催事）。催事外の接点は省略。 */
  eventId: optional(64),
  /** 誰が（接客した担当者）。操作した利用者とは別に記録する。 */
  assigneeUserId: optional(64),
  /** 見積提示のときの金額（円）。 */
  amount: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
});
export type PartnerActivityCreateInput = z.input<typeof PartnerActivityCreateSchema>;

/** 誤記の修正。行は増えないので商談回数は変わらない。 */
export const PartnerActivityUpdateSchema = PartnerActivityCreateSchema.extend({
  id: z.string().trim().min(1).max(64),
});
export type PartnerActivityUpdateInput = z.input<typeof PartnerActivityUpdateSchema>;

/** 商談ステータス。既存 Customer.contractStatus の値域に合わせる。 */
export const PARTNER_DEAL_STATUS_VALUES = [
  "negotiating",
  "contracted",
  "cancelled",
  "lost",
] as const;
export type PartnerDealStatus = (typeof PARTNER_DEAL_STATUS_VALUES)[number];

/** マエカクステータス。既存 Customer.maekakuStatus の値域に合わせる。 */
export const PARTNER_MAEKAKU_STATUS_VALUES = ["pending", "done", "unnecessary"] as const;
export type PartnerMaekakuStatus = (typeof PARTNER_MAEKAKU_STATUS_VALUES)[number];

/**
 * 顧客の業務情報の更新。
 *
 * 「契約済へ変更する」ことと「成約報告を出した」ことは別なので、ここでは
 * ステータスだけを扱う。金額を伴う正式な Contract はここからは作らない。
 */
export const PartnerNegotiationUpdateSchema = z.object({
  customerId: z.string().trim().min(1).max(64),
  dealStatus: z.enum(PARTNER_DEAL_STATUS_VALUES),
  maekakuStatus: z.enum(PARTNER_MAEKAKU_STATUS_VALUES).optional(),
  nextAppointmentAt: z
    .union([z.string(), z.date()])
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : toDate(v)))
    .refine((v) => v === undefined || !Number.isNaN(v.getTime()), {
      message: "次回アポ日程の形式が正しくありません",
    }),
  nextAction: optional(500),
  /** 担当者（引継ぎ・共同対応）。ログイン利用者を初期値にする。 */
  assigneeUserId: optional(64),
});
export type PartnerNegotiationUpdateInput = z.input<typeof PartnerNegotiationUpdateSchema>;
