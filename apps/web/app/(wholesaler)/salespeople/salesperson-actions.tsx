"use client";

// スタッフ（Salesperson）の削除ボタン。
//
// スタッフとシステムユーザー（User）は別物なので、ここでは User に一切触れない。
// 削除は物理削除ではなく isActive = false の論理削除。

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

import { deleteSalespersonAction } from "./actions";

const t = labels.salespersonList;

export function DeleteSalespersonButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      try {
        await deleteSalespersonAction({ id });
        toast.success(t.remove.submit);
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error && err.message ? err.message : labels.common.unknownError);
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="default"
        className="text-danger"
        aria-label={`${name} ${t.remove.trigger}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {t.remove.trigger}
      </Button>
      <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{t.remove.confirmTitle}</DialogTitle>
            <DialogDescription>
              {name} — {t.remove.confirmBody}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              {t.remove.cancel}
            </Button>
            <Button variant="destructive" onClick={submit} disabled={pending}>
              {pending ? t.remove.submitting : t.remove.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
