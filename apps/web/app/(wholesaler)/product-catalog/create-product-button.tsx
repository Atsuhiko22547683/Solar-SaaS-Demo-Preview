"use client";

// 画面右上の「商品を登録」。
//
// いま開いているタブのカテゴリを登録ダイアログの初期値にする
// （カテゴリを選び直させない — 大半は「見ているカテゴリに足す」操作のため）。
// 別カテゴリへ登録したいときはダイアログ内のセレクトで変えられる。

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { labels } from "@/lib/i18n/labels";

import { ProductFormDialog } from "./product-form-dialog";

import type { CatalogCategory } from "@solar/contracts";

export function CreateProductButton({
  category,
  makerOptions,
}: {
  category: CatalogCategory;
  /** メーカー入力の候補（既存メーカー。ここに無い名前も直接入力できる）。 */
  makerOptions: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>{labels.productCatalog.new}</Button>
      <ProductFormDialog
        mode="create"
        open={open}
        onOpenChange={setOpen}
        category={category}
        makerOptions={makerOptions}
      />
    </>
  );
}
