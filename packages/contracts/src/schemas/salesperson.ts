// スタッフ（販売員）マスタ（設定配下「スタッフ一覧」）の入力スキーマ。
//
// スタッフは認証 User とは別概念で、ログインしない催事販売員も含む。
// wholesalerId はテナント文脈から注入するので入力には含めない（クロステナント防止）。
//
// 所属:
//   relationshipId == null → 自社スタッフ
//   relationshipId != null → 二次店スタッフ（会社名は Relationship 側から導出）
// 会社名（加盟店名）は文字列で複製しないので、この入力にも含めない。
//
// userId は同一人物の自社ログイン User への任意リンク。二次店の User は RLS で
// 参照できないため、二次店スタッフでは常に null。
//
// PII（生年月日 / 電話 / メール / 現住所）を含むため、保存は許すが一覧表示側で
// マスキングする（DTO / loader 側の責務）。
//
// residentAddress / salesExperience / franchiseNo は DB 列としては残すが
// （既存データ保護のため DROP しない）、UI・入力からは扱わない。

import { z } from "zod";

/** 性別。未回答は null（列自体が nullable なので UNKNOWN 値は作らない）。 */
export const GENDER_VALUES = ["MALE", "FEMALE", "OTHER"] as const;
export const GenderEnum = z.enum(GENDER_VALUES);
export type GenderValue = z.infer<typeof GenderEnum>;

/** 雇用形態。 */
export const EMPLOYMENT_TYPE_VALUES = [
  "EMPLOYEE",
  "CONTRACT",
  "PART_TIME",
  "SUBCONTRACT",
  "OTHER",
] as const;
export const EmploymentTypeEnum = z.enum(EMPLOYMENT_TYPE_VALUES);
export type EmploymentTypeValue = z.infer<typeof EmploymentTypeEnum>;

const baseShape = {
  /** 氏名（漢字）。必須。 */
  name: z.string().min(1, "氏名は必須です").max(255),
  /** 氏名（カナ）。 */
  kana: z.string().max(255).nullable().optional(),
  /** 所属二次店（Relationship.id）。null / 未指定なら自社スタッフ。 */
  relationshipId: z.string().min(1).nullable().optional(),
  /** 同一人物の自社ログイン User。null で紐付け解除。二次店スタッフでは常に null。 */
  userId: z.string().min(1).nullable().optional(),
  gender: GenderEnum.nullable().optional(),
  /** 生年月日。任意。`YYYY-MM-DD`（または ISO）文字列 / null。Action 側で Date 化する。
      未入力は必ず null（空文字やダミー日付を保存しない）。 */
  birthDate: z.string().nullable().optional(),
  phone: z.string().max(32).nullable().optional(),
  email: z.string().email("メールアドレスの形式が正しくありません").max(255).nullable().optional(),
  /** 現住所（居住地）。 */
  address: z.string().max(500).nullable().optional(),
  employmentType: EmploymentTypeEnum.nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
};

export const SalespersonInputSchema = z.object(baseShape);
export type SalespersonInput = z.infer<typeof SalespersonInputSchema>;

// 更新は全項目 optional。name は指定されたときだけ空文字を拒否する
// （「氏名必須」をパッチ経由で破られないようにする — installer と同じ方針）。
export const SalespersonUpdateSchema = z.object({
  name: baseShape.name.optional(),
  kana: baseShape.kana,
  relationshipId: baseShape.relationshipId,
  userId: baseShape.userId,
  gender: baseShape.gender,
  birthDate: baseShape.birthDate,
  phone: baseShape.phone,
  email: baseShape.email,
  address: baseShape.address,
  employmentType: baseShape.employmentType,
  note: baseShape.note,
  isActive: baseShape.isActive,
});
export type SalespersonUpdate = z.infer<typeof SalespersonUpdateSchema>;

/** イベントへの販売員アサイン（差し替え方式: この配列の内容が最終状態になる）。 */
export const EventSalespeopleAssignSchema = z.object({
  eventId: z.string().min(1),
  salespersonIds: z.array(z.string().min(1)).max(100),
});
export type EventSalespeopleAssignInput = z.infer<typeof EventSalespeopleAssignSchema>;

/** スタッフ一覧のタブ。所属は relationshipId の有無から導出する（DB 列は増やさない）。 */
export const STAFF_AFFILIATION_VALUES = ["self", "dealer"] as const;
export const StaffAffiliationEnum = z.enum(STAFF_AFFILIATION_VALUES);
export type StaffAffiliation = z.infer<typeof StaffAffiliationEnum>;
