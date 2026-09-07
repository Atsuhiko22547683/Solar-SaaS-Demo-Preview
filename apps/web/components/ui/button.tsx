import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

// 業務ツールのボタン。マーケティングの CTA ではなく、1 画面に何個も並ぶ操作
// 部品として設計する:
//   - 角丸は入力欄・カードと同じ 6px（rounded-md）。全周を丸めた pill にすると
//     フォーム部品の並びの中でボタンだけ出自の違う要素に見える。
//   - ウェイトは medium。全ボタンが bold だと主操作と副操作の区別が付かない。
//   - tracking は掛けない（「保存」「戻る」のような 2 文字が間延びするため）。
//   - 高さは 36px 基準。密度を上げた一覧・フィルタ行に収まる寸法に揃える。
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary-pressed active:bg-primary-active",
        // 破壊的操作。状態色 danger を参照する（旧 warning は値が赤なのに名前が
        // 「警告」で、意味論が壊れていた）。
        destructive: "bg-danger text-white hover:bg-danger/90",
        outline: "bg-white border border-ash-light text-ink hover:bg-surface-soft",
        secondary: "bg-secondary text-ink hover:bg-hairline-light",
        ghost: "hover:bg-surface-soft text-ink",
        link: "text-link-light underline-offset-4 hover:underline rounded-none",
      },
      // 高さはデスクトップ 36px 基準。ただしタッチ環境では 36px は
      // 誤タップしやすいため、sm 未満（≒スマートフォン）でだけ 44px へ広げる。
      // 全体を 40px 以上へ戻すと、1 画面に何十行も並ぶ一覧の密度が落ちるので、
      // 密度を犠牲にせずタップ領域だけを確保する。
      size: {
        default: "h-11 px-4 sm:h-9",
        sm: "h-10 px-3 text-xs sm:h-8",
        lg: "h-11 px-5 sm:h-10",
        icon: "h-11 w-11 sm:h-9 sm:w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
