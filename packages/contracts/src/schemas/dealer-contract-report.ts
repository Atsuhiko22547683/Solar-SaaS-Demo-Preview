// 二次店が提出する成約報告（Google フォーム「成約フォーム」の置き換え）の入力スキーマ。
//
// フォームの 9 項目がすべてで、すべて必須。所属二次店 / 取引先代理店 / 提出者は
// 認証済みユーザーから決まるので入力に含めない。
//
// 保存先は専用テーブル DealerContractReport。既存 Contract は dealId / customerId /
// contractAmount / cancelDeadline が必須で、商談から積み上がる粗利・インセンティブ
// 計算の起点になっている。このフォームにはそれらの項目が無く、埋めるにはダミー値の
// 生成が必要になるため相乗りさせない。

import { z } from "zod";

import { partnerOriginFields } from "./partner-origin.js";

/**
 * 所属。Prisma の DealerContractAffiliation と 1:1。
 *
 *   VE … バリューエコロジーの社員が獲得した場合
 *   PS … それ以外が獲得した場合
 */
export const DEALER_CONTRACT_AFFILIATION_VALUES = ["VE", "PS"] as const;
export type DealerContractAffiliationValue = (typeof DEALER_CONTRACT_AFFILIATION_VALUES)[number];

/**
 * アポ獲得時チャネル。Prisma の DealerContractChannel と 1:1。
 *
 * 既存 SalesChannel（訪問販売 / 反響 / 催事 / 紹介 / その他）とは選択肢が違う
 * （テレアポがあり「その他」が無い）ため、意味の違う既存 enum へは読み替えない。
 */
export const DEALER_CONTRACT_CHANNEL_VALUES = [
  "VISIT_SALES",
  "TELE_APPOINTMENT",
  "REFERRAL",
  "EVENT",
  "INBOUND",
] as const;
export type DealerContractChannelValue = (typeof DEALER_CONTRACT_CHANNEL_VALUES)[number];

const requiredText = (label: string, max = 255) =>
  z.string().trim().min(1, `${label}を入力してください`).max(max);

const toDate = (v: string | Date) => (v instanceof Date ? v : new Date(v));

/** 必須の日付。空文字・不正値は弾く（既定値を作らない）。 */
const requiredDate = (label: string) =>
  z
    .union([z.string(), z.date()])
    .refine((v) => v !== "" && !Number.isNaN(toDate(v).getTime()), {
      message: `${label}を入力してください`,
    })
    .transform((v) => toDate(v));

const baseFields = {
  // 依頼元代理店（取引先が 1 社なら省略可）。
  ...partnerOriginFields,
  /**
   * 対象の顧客（任意）。
   *
   * このフォームは顧客名を聞かないので、提出者が自社の顧客から選んだときだけ入る。
   * 選ばれていれば代理店の顧客詳細からこの提出を辿れる。空なら紐付けない
   * （名前や日付が近いというだけで後から機械的に結び付けない）。
   */
  customerId: z.string().trim().min(1).optional(),
  /** ご契約日。 */
  contractDate: requiredDate("ご契約日"),
  /** トス日。 */
  tossDate: requiredDate("トス日"),
  /** トス部署。 */
  tossDept: requiredText("トス部署", 100),
  /** アポ獲得者（自由記述）。 */
  apptGetter: requiredText("アポ獲得者", 120),
  /** 営業担当者（自由記述）。 */
  salesRep: requiredText("営業担当者", 120),
  /** 取次拠点。 */
  referralBranch: requiredText("取次拠点", 120),
  /** 所属（VE / PS）。 */
  affiliation: z.enum(DEALER_CONTRACT_AFFILIATION_VALUES, {
    required_error: "所属を選択してください",
    invalid_type_error: "所属を選択してください",
  }),
  /** 所属部署。 */
  affiliationDept: requiredText("所属部署", 100),
  /** アポ獲得時チャネル。 */
  acquisitionChannel: z.enum(DEALER_CONTRACT_CHANNEL_VALUES, {
    required_error: "アポ獲得時チャネルを選択してください",
    invalid_type_error: "アポ獲得時チャネルを選択してください",
  }),
};

export const DealerContractReportCreateSchema = z.object(baseFields);
export type DealerContractReportCreateInput = z.input<typeof DealerContractReportCreateSchema>;

export const DealerContractReportUpdateSchema = z.object({
  id: z.string().min(1),
  ...baseFields,
});
export type DealerContractReportUpdateInput = z.input<typeof DealerContractReportUpdateSchema>;
