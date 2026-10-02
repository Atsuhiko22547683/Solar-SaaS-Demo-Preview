// 二次店スタッフの商談情報編集の入力スキーマ。
//
// 既存 DealUpdateSchema（代理店・二次店管理者向け）から「商談情報」だけを切り出す。
// 担当者の変更（assignedToUserId）と粗利見込み（expectedProfit）は受け取らない —
// 前者はスタッフに許さない操作、後者は代理店側の管理情報のため。
//
// 顧客の基本情報（氏名・住所・連絡先）はこのスキーマに含めない。画面に無い項目を
// 直接送られても Zod で落ちるので、Server Action へは商談情報しか届かない。

import { z } from "zod";

import { DealStatusEnum } from "./deal.js";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

export const PartnerDealUpdateSchema = z
  .object({
    id: z.string().min(1, "商談 ID が必要です"),
    /** ステータス。既存の遷移規則（DEAL_ALLOWED_TRANSITIONS）で検証する。 */
    status: DealStatusEnum.optional(),
    proposedProduct: optionalText(500),
    /** 提案金額（円）。空欄は未設定。 */
    proposedAmount: z
      .union([z.number(), z.string()])
      .optional()
      .transform((v) => {
        if (v === undefined || v === "") return undefined;
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) ? n : NaN;
      })
      .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), {
        message: "提案金額は 0 以上の数値で入力してください",
      }),
    /** 契約予定日（YYYY-MM-DD）。空欄は未設定。 */
    expectedContractDate: z
      .string()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined))
      .refine((v) => v === undefined || !Number.isNaN(new Date(v).getTime()), {
        message: "契約予定日を正しく入力してください",
      }),
    lostReason: optionalText(2000),
    nextAction: optionalText(500),
    note: optionalText(5000),
  })
  // 画面に無い項目（顧客基本情報・担当者・粗利など）は受け取らない。
  .strict();

export type PartnerDealUpdateInput = z.input<typeof PartnerDealUpdateSchema>;

/** 商談情報として編集できる項目（画面・テストが同じ表を見る）。 */
export const PARTNER_DEAL_EDITABLE_FIELDS = [
  "status",
  "proposedProduct",
  "proposedAmount",
  "expectedContractDate",
  "lostReason",
  "nextAction",
  "note",
] as const;
