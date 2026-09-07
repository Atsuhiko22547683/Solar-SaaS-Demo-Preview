"use client";

// 取引先の追加 / 削除（論理削除）の client 部品。
// 一覧のインライン編集（relationship-row.tsx）とは責務を分け、
// 行の増減だけをここで扱う。

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { labels } from "@/lib/i18n/labels";

import { createRelationshipAction, deleteRelationshipAction } from "./actions";

const t = labels.dealerRelationships;

/** 取引先を新規追加するダイアログ。 */
export function CreateRelationshipDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t.create.nameRequired);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createRelationshipAction({ dealerName: trimmed });
        toast.success(t.create.submit);
        setOpen(false);
        setName("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : labels.common.unknownError);
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t.create.trigger}</Button>
      <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.create.title}</DialogTitle>
            <DialogDescription>{t.create.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-dealer-name">{t.create.nameLabel}</Label>
            <Input
              id="new-dealer-name"
              value={name}
              autoComplete="off"
              placeholder={t.create.namePlaceholder}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
            />
            {error ? (
              <p role="alert" className="text-danger text-sm">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              {t.create.cancel}
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? t.create.submitting : t.create.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * 取引先を削除する。
 * 物理削除ではなく status を「取引終了」にするだけなので、
 * 過去データからの参照は残ることを確認文で明示する。
 */
export function DeleteRelationshipButton({ id, dealerName }: { id: string; dealerName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      try {
        await deleteRelationshipAction({ id });
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
        size="sm"
        className="text-danger"
        aria-label={`${dealerName} ${t.remove.trigger}`}
        onClick={() => setOpen(true)}
      >
        {t.remove.trigger}
      </Button>
      <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.remove.confirmTitle}</DialogTitle>
            <DialogDescription>
              {dealerName} — {t.remove.confirmBody}
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
