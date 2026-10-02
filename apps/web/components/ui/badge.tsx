import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

// バッジは「有限の状態値」だけに使う（契約状況・支払状況・施工状況など）。
// 自由入力の文字列や単なる分類ラベルには使わない — 何にでも付けると
// 一覧の中で「注目すべき状態」が埋もれるため。
//
// variant は見た目ではなく業務上の意味で選ぶ:
//   default  … 進行中（操作の主導権がこちらにある）
//   success  … 完了・正常終了
//   warning  … 期限が近い・要確認
//   destructive … 期限超過・失注・エラー
//   secondary/outline … 状態を持たない中立の分類
const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/10 text-primary",
        secondary: "border-transparent bg-surface-soft text-body-light",
        destructive: "border-transparent bg-danger/10 text-danger",
        outline: "border-hairline-light text-mute-light bg-white",
        success: "border-transparent bg-ok/10 text-ok",
        warning: "border-transparent bg-caution/10 text-caution",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
