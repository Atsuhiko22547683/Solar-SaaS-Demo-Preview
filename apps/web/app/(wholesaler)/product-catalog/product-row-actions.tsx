"use client";

// 商品 1 行の操作 — 編集 / 削除。展開バナーの中にだけ出す。
//
// 削除は物理削除ではなく isActive = false の論理削除。行は残るので、
// 過去の契約・見積から参照されている商品情報は壊れない。

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { labels } from "@/lib/i18n/labels";

import { retireCatalogProductAction } from "./actions";
import { ProductFormDialog } from "./product-form-dialog";

import type { CatalogProductListItem } from "./data";

const t = labels.productCatalog;

export function ProductRowActions({
  product,
  makerOptions,
}: {
  product: CatalogProductListItem;
  /** メーカー入力の候補（既存メーカー。ここに無い名前も直接入力できる）。 */
  makerOptions: string[];
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      try {
        await retireCatalogProductAction({ id: product.id });
        toast.success(t.remove.done);
        setRemoveOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error && err.message ? err.message : labels.common.unknownError);
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
        {t.edit.trigger}
      </Button>
      {/* 削除済みの商品には削除を出さない（もう一覧から外れている）。 */}
      {product.isActive ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-danger"
          aria-label={`${product.name} ${t.remove.trigger}`}
          onClick={() => setRemoveOpen(true)}
        >
          {t.remove.trigger}
        </Button>
      ) : null}

      <ProductFormDialog
        mode="edit"
        open={editOpen}
        onOpenChange={setEditOpen}
        category={product.category}
        product={product}
        makerOptions={makerOptions}
      />

      <Dialog open={removeOpen} onOpenChange={(v) => !pending && setRemoveOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.remove.confirmTitle}</DialogTitle>
            <DialogDescription>
              {product.name} — {t.remove.confirmBody}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveOpen(false)} disabled={pending}>
              {t.remove.cancel}
            </Button>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              {pending ? t.remove.submitting : t.remove.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
