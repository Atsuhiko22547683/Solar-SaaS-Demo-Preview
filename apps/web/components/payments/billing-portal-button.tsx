"use client";

// 決済管理ページ（Stripe カスタマーポータル）を開くボタン。
//
// 以前の「Stripe で管理」は Stripe ダッシュボードのトップを新しいタブで開く
// だけのリンクだった。いまは自テナントの Customer に紐づくポータルの
// セッションをサーバー側で作って、その URL へ遷移する。
// URL は 1 回限りの署名付きなので、リンクとして持たず押されたときに作る。

import { useTransition } from "react";
import { toast } from "sonner";

import { openBillingPortalAction } from "@/app/(wholesaler)/payments/actions";
import { Button } from "@/components/ui/button";
import { labels } from "@/lib/i18n/labels";

const t = labels.billing.portal;

export function BillingPortalButton({
  /** Stripe Customer が未作成なら「決済情報を登録」にする。 */
  hasCustomer,
  /** Stripe が未設定・障害中。押しても開けないので無効化する。 */
  disabled,
  className,
}: {
  hasCustomer: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  function open() {
    startTransition(async () => {
      try {
        await openBillingPortalAction();
      } catch (err) {
        // redirect() は例外で制御を返す仕組みなので、それは握りつぶさない。
        if (err && typeof err === "object" && "digest" in err) throw err;
        toast.error(err instanceof Error && err.message ? err.message : t.error);
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled || pending}
      onClick={open}
      className={className}
      title={disabled ? t.notConfigured : undefined}
    >
      {pending ? t.opening : hasCustomer ? t.manage : t.start}
    </Button>
  );
}
