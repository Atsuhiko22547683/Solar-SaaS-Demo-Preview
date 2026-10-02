"use client";

// 一覧の通常行に置く「有効 / 無効」チェックボックス。
//
// 押した時点で保存する（別途の保存ボタンは持たない）。行のどこを押しても
// アコーディオンが開く表なので、このセルだけはクリックを行へ伝播させない
// — チェックのつもりで押して詳細が開く、という取り違えを無くすため。
//
// タップ領域はスマホで 44px 角を確保する（list-shell のシェブロンと同じ考え方）。
// 見た目のチェックボックス自体は素の <input type="checkbox"> のままにして、
// この画面だけの独自トグルを作らない。

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { labels } from "@/lib/i18n/labels";

import { setCatalogProductActiveAction } from "./actions";

const t = labels.productCatalog;

export function ProductActiveToggle({
  id,
  name,
  isActive,
}: {
  id: string;
  name: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // サーバー確定までの見た目を先に動かす（チェックが一拍遅れて付くのを避ける）。
  // 失敗したら元へ戻す。
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const checked = optimistic ?? isActive;

  function toggle(next: boolean) {
    setOptimistic(next);
    startTransition(async () => {
      try {
        await setCatalogProductActiveAction({ id, isActive: next });
        toast.success(next ? t.activeToggle.activated : t.activeToggle.deactivated);
        router.refresh();
      } catch (err) {
        setOptimistic(null);
        toast.error(err instanceof Error && err.message ? err.message : labels.common.unknownError);
      }
    });
  }

  return (
    // クリック・キーボード操作とも、この枠の中で完結させて行へ渡さない。
    <span
      className="inline-flex size-11 items-center justify-center sm:size-8"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={pending}
        aria-label={t.activeToggle.ariaLabel.replace("{name}", name)}
        className="border-ash-light text-primary focus-visible:ring-primary/40 size-4 cursor-pointer rounded border focus:outline-none focus-visible:ring-2 disabled:cursor-progress"
        onChange={(e) => toggle(e.target.checked)}
      />
    </span>
  );
}
