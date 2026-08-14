// 契約一覧の値域・バッジ配色。
//
// customers/constants.ts と同じ役割 — "server-only" を付けないことで client
// component（filter / table）が server-only な data.ts を巻き込まずに
// 定数と型を import できる。

import type { BadgeVariant } from "@/components/ui/badge";
import type { ContractStatus } from "@solar/db";

/** 表示順・値域の単一の真実（filter と page の searchParams 検証が共有）。 */
export const CONTRACT_STATUS_ENUM_VALUES: ContractStatus[] = [
  "CONTRACTED",
  "CONSTRUCTING",
  "DONE",
  "CANCELLED",
];

/** 完了=成功 / 施工中=注意 / 契約中=進行中 / キャンセル=終了。 */
export function contractStatusVariant(s: ContractStatus): BadgeVariant {
  switch (s) {
    case "DONE":
      return "success";
    case "CONSTRUCTING":
      return "warning";
    case "CONTRACTED":
      return "default";
    case "CANCELLED":
      return "secondary";
  }
}
