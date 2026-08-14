// ローン審査一覧の値域・バッジ配色。
//
// LoanReview.status / LoanReviewLog.result は Prisma 上 String 列で、値域は
// schema.prisma のコメントと顧客詳細タブの実装に定義されている。ここではその
// 値域を一覧側で再利用できる形に固定する（新しい値は増やさない）。
//
// "server-only" を付けないことで client component（filter / table）が
// server-only な data.ts を巻き込まずに定数と型を import できる。

import type { BadgeVariant } from "@/components/ui/badge";

/** LoanReview.status の値域（schema.prisma の既定コメントと同一）。 */
export const LOAN_REVIEW_STATUS_VALUES = [
  "not_reviewed",
  "reviewing",
  "completed",
  "defect",
] as const;
export type LoanReviewStatusValue = (typeof LOAN_REVIEW_STATUS_VALUES)[number];

/** LoanReviewLog.result の値域。 */
export const LOAN_REVIEW_RESULT_VALUES = ["approved", "rejected", "defect", "other"] as const;
export type LoanReviewResultValue = (typeof LOAN_REVIEW_RESULT_VALUES)[number];

/** 不備の集計状態（ログから導出。DB 列ではない）。 */
export type DefectStateValue = "none" | "open" | "resolved";

/** 一覧フィルタの「不備」選択肢。 */
export const DEFECT_FILTER_VALUES = ["open", "none"] as const;
export type DefectFilterValue = (typeof DEFECT_FILTER_VALUES)[number];

/** 審査完了=成功 / 審査中=進行中 / 不備あり=注意 / 審査前=灰。 */
export function loanStatusVariant(s: string): BadgeVariant {
  switch (s) {
    case "completed":
      return "success";
    case "reviewing":
      return "default";
    case "defect":
      return "warning";
    default:
      return "secondary";
  }
}

/** 承認=成功 / 否決=エラー / 不備=注意 / その他=灰。 */
export function loanResultVariant(r: string): BadgeVariant {
  switch (r) {
    case "approved":
      return "success";
    case "rejected":
      return "destructive";
    case "defect":
      return "warning";
    default:
      return "secondary";
  }
}

/** 未解消=注意 / 解消済み=成功 / なし=灰。 */
export function defectVariant(d: DefectStateValue): BadgeVariant {
  switch (d) {
    case "open":
      return "warning";
    case "resolved":
      return "success";
    case "none":
      return "secondary";
  }
}
