// 設置申請一覧の値域。
//
// 表示・絞り込みの語彙は顧客一覧の「設置申請状況」（4 値）に揃える。
// customers/constants.ts の applicationEnumToSubsidyValue が
// ApplicationStatus(enum 5 値) → 4 値の写像を持つので、ここではその逆写像
// （絞り込み用）だけを定義する。"preparing" は Customer.subsidyStatus 専用の値で
// Application 側に対応する enum が無いため、一覧の絞り込みには出さない。

import type { SubsidyStatusValue } from "../customers/constants";
import type { ApplicationStatus } from "@solar/db";

/** 一覧フィルタに出す 4 値（表示順）。 */
export const APPLICATION_FILTER_VALUES = [
  "not_applied",
  "applied",
  "revising",
  "completed",
] as const satisfies readonly SubsidyStatusValue[];

export type ApplicationFilterValue = (typeof APPLICATION_FILTER_VALUES)[number];

/** 4 値 → ApplicationStatus(enum) 群。applicationEnumToSubsidyValue の逆写像。 */
export const FILTER_VALUE_TO_ENUMS: Record<ApplicationFilterValue, ApplicationStatus[]> = {
  not_applied: ["DRAFT", "CANCELLED"],
  applied: ["SUBMITTED"],
  revising: ["REJECTED"],
  completed: ["APPROVED"],
};
