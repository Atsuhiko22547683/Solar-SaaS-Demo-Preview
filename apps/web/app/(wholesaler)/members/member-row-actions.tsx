"use client";

// システムユーザー（User）1 行の操作 — 編集 / 削除。
//
// ここで扱うのは User だけ。スタッフ（Salesperson）には一切触れない。
// 削除は物理削除ではなく status = DELETED の論理削除。

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

import { deleteWholesalerMemberAction, updateWholesalerMemberAction } from "./actions";

import type { AppRole, UserStatus } from "@solar/db";

const t = labels.memberManagement;

// 正式仕様の 3 ロールだけを選ばせる。旧ロールが付いた既存ユーザーを開いた場合は
// 既定値を「一般ユーザー」にして、保存時に 3 ロールのいずれかへ移行させる。
const EDITABLE_ROLES = ["OWNER", "SYSTEM_ADMIN", "GENERAL_USER"] as const;

const FIELD =
  "border-ash-light text-ink focus:border-primary focus:ring-primary/40 h-9 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2";

export function MemberRowActions({
  id,
  name,
  roles,
  status,
}: {
  id: string;
  name: string;
  roles: AppRole[];
  status: UserStatus;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [nextName, setNextName] = useState(name);
  const [nextRole, setNextRole] = useState<string>(() => {
    const current = roles.find((r) => (EDITABLE_ROLES as readonly string[]).includes(r));
    return current ?? "GENERAL_USER";
  });
  // 削除は別操作なので、この選択肢には DELETED を出さない。
  const [nextStatus, setNextStatus] = useState<string>(status === "DELETED" ? "ACTIVE" : status);

  function save() {
    startTransition(async () => {
      try {
        await updateWholesalerMemberAction({
          id,
          name: nextName.trim(),
          role: nextRole as (typeof EDITABLE_ROLES)[number],
          // 招待済み（未受諾）は受諾で変わる状態なので、ここでは送らない。
          ...(nextStatus === "ACTIVE" || nextStatus === "SUSPENDED"
            ? { status: nextStatus as "ACTIVE" | "SUSPENDED" }
            : {}),
        });
        toast.success(labels.common.saved);
        setEditOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error && err.message ? err.message : labels.common.unknownError);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        await deleteWholesalerMemberAction({ id });
        toast.success(t.remove.submit);
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
      <Button
        variant="ghost"
        size="sm"
        className="text-danger"
        aria-label={`${name} ${t.remove.trigger}`}
        onClick={() => setRemoveOpen(true)}
      >
        {t.remove.trigger}
      </Button>

      <Dialog open={editOpen} onOpenChange={(v) => !pending && setEditOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.edit.title}</DialogTitle>
            <DialogDescription>{t.edit.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-left">
            <div className="space-y-1.5">
              <Label htmlFor={`member-name-${id}`}>{t.fields.name}</Label>
              <Input
                id={`member-name-${id}`}
                value={nextName}
                autoComplete="off"
                disabled={pending}
                onChange={(e) => setNextName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`member-role-${id}`}>{t.fields.roles}</Label>
              <select
                id={`member-role-${id}`}
                value={nextRole}
                disabled={pending}
                className={FIELD}
                onChange={(e) => setNextRole(e.target.value)}
              >
                {EDITABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t.wholesalerRoles[r] ?? r}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`member-status-${id}`}>{t.fields.status}</Label>
              <select
                id={`member-status-${id}`}
                value={nextStatus}
                disabled={pending}
                className={FIELD}
                onChange={(e) => setNextStatus(e.target.value)}
              >
                <option value="ACTIVE">{t.statuses.ACTIVE}</option>
                <option value="SUSPENDED">{t.statuses.SUSPENDED}</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={pending}>
              {t.edit.cancel}
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? t.edit.submitting : t.edit.submit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removeOpen} onOpenChange={(v) => !pending && setRemoveOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.remove.confirmTitle}</DialogTitle>
            <DialogDescription>
              {name} — {t.remove.confirmBody}
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
