"use client";

// 顧客ページ ヘッダーの担当者変更ダイアログ (F-031 / docs/04 §1.3).
// 「トスアップ担当」「クロージング担当」を、自社社員(User) または二次店(Relationship)
// から選んで更新する。各役割は自社/二次店いずれか一方（排他）で、「未設定」も可。
//
// 以前は 1 つの select に optgroup で自社社員と二次店を詰めていたため、
// 候補が増えると非常に長いプルダウンになっていた。これを
//   【所属区分】（未設定 / 自社社員 / 二次店）→【担当者】
// の 2 段階に分割する。所属区分を変えると担当者の選択肢が入れ替わり、選択済みの
// 担当者はリセットされる（自社社員を選んだまま区分だけ二次店、のような不整合を作らない）。
//
// 保存形式は従来どおり tossUpUserId / tossUpRelationshipId /
// closingUserId / closingRelationshipId の 4 列（排他）。所属区分は保存せず、
// どちらの列に値が入っているかで判定・復元する（DB 変更なし）。
//
// 候補集合（users / dealers）は呼び出し元 page.tsx が
// listWholesalerUsers() / listActiveDealers() で取得したものをそのまま使う。
// テナント・権限の絞り込みは変更していない（UI 上で分類するだけ）。

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { labels } from "@/lib/i18n/labels";

import { updateCustomerAction } from "../actions";

interface UserChoice {
  id: string;
  name: string;
}

interface DealerChoice {
  relationshipId: string;
  dealerName: string;
}

interface EditAssigneeDialogProps {
  customerId: string;
  currentTossUpUserId: string | null;
  currentTossUpRelationshipId: string | null;
  currentClosingUserId: string | null;
  currentClosingRelationshipId: string | null;
  users: UserChoice[];
  dealers: DealerChoice[];
}

/** 所属区分。"unset" は担当者そのものが未設定（担当者 select は disabled）。 */
const KINDS = ["unset", "user", "dealer"] as const;
type AssigneeKind = (typeof KINDS)[number];

/** 1 役割ぶんの選択状態。id は kind に対応する User.id または Relationship.id。 */
interface AssigneeSelection {
  kind: AssigneeKind;
  id: string;
}

/**
 * 保存済みの値 → 初期選択。どちらの列に値が入っているかで所属区分を判定する
 * （所属区分は DB に持たないので、既存データからの復元はここだけで完結する）。
 */
function toSelection(userId: string | null, relationshipId: string | null): AssigneeSelection {
  if (relationshipId) return { kind: "dealer", id: relationshipId };
  if (userId) return { kind: "user", id: userId };
  return { kind: "unset", id: "" };
}

/** 選択状態 → 保存用の {userId, relationshipId}（排他、未選択側は null）。 */
function toPayload(sel: AssigneeSelection): {
  userId: string | null;
  relationshipId: string | null;
} {
  if (sel.kind === "user") return { userId: sel.id || null, relationshipId: null };
  if (sel.kind === "dealer") return { userId: null, relationshipId: sel.id || null };
  return { userId: null, relationshipId: null };
}

const SELECT_CLASS =
  "h-9 w-full rounded-sm border border-hairline-light bg-white px-3 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-surface-soft disabled:text-mute-light";

/**
 * 1 役割ぶんの入力（所属区分 → 担当者 の 2 段）。
 * コンポーネント本体の外に置く（本体内に定義すると再レンダーのたびに再マウントされ、
 * select のフォーカスが飛ぶため）。
 */
function AssigneeFields({
  idPrefix,
  roleLabel,
  selection,
  onChange,
  users,
  dealers,
}: {
  idPrefix: string;
  roleLabel: string;
  selection: AssigneeSelection;
  onChange: (next: AssigneeSelection) => void;
  users: UserChoice[];
  dealers: DealerChoice[];
}) {
  const d = labels.customer.detail;
  const kindLabel: Record<AssigneeKind, string> = {
    unset: d.unassigned,
    user: d.ownStaffGroup,
    dealer: d.dealerGroup,
  };

  // 所属区分を変えたら担当者は必ず未選択に戻す（区分と担当者の不整合を作らない）。
  function onKindChange(kind: AssigneeKind) {
    onChange({ kind, id: "" });
  }

  return (
    <fieldset className="space-y-1.5">
      <legend className="text-ink mb-1.5 text-sm font-medium">{roleLabel}</legend>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-kind`}>{d.assigneeKind}</Label>
        <select
          id={`${idPrefix}-kind`}
          value={selection.kind}
          onChange={(e) => onKindChange(e.target.value as AssigneeKind)}
          className={SELECT_CLASS}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {kindLabel[k]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-select`}>{d.assigneeLabel}</Label>
        <select
          id={`${idPrefix}-select`}
          value={selection.id}
          // 所属区分が未設定のときは選ぶものが無いので無効化する。
          disabled={selection.kind === "unset"}
          onChange={(e) => onChange({ kind: selection.kind, id: e.target.value })}
          className={SELECT_CLASS}
        >
          <option value="">{d.unassigned}</option>
          {selection.kind === "user" &&
            users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          {/* 二次店側の担当主体は「二次店（会社）」そのもの（Relationship）。
              二次店所属の個人ユーザーを持つデータ構造ではないため会社名を並べる。 */}
          {selection.kind === "dealer" &&
            dealers.map((dl) => (
              <option key={dl.relationshipId} value={dl.relationshipId}>
                {dl.dealerName}
              </option>
            ))}
        </select>
      </div>
    </fieldset>
  );
}

export function EditAssigneeDialog({
  customerId,
  currentTossUpUserId,
  currentTossUpRelationshipId,
  currentClosingUserId,
  currentClosingRelationshipId,
  users,
  dealers,
}: EditAssigneeDialogProps) {
  const d = labels.customer.detail;
  const c = labels.common;
  const router = useRouter();

  const tossUpInitial = toSelection(currentTossUpUserId, currentTossUpRelationshipId);
  const closingInitial = toSelection(currentClosingUserId, currentClosingRelationshipId);

  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [tossUp, setTossUp] = useState<AssigneeSelection>(tossUpInitial);
  const [closing, setClosing] = useState<AssigneeSelection>(closingInitial);

  function onOpenChange(next: boolean) {
    // 開くたびに保存済みの値へ戻す（キャンセル後に編集途中の状態を持ち越さない）。
    if (next) {
      setTossUp(tossUpInitial);
      setClosing(closingInitial);
    }
    setOpen(next);
  }

  function handleSave() {
    const tu = toPayload(tossUp);
    const cl = toPayload(closing);
    startTransition(async () => {
      try {
        await updateCustomerAction({
          id: customerId,
          tossUpUserId: tu.userId,
          tossUpRelationshipId: tu.relationshipId,
          closingUserId: cl.userId,
          closingRelationshipId: cl.relationshipId,
        });
        toast.success(c.saved);
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error && err.message ? err.message : c.unknownError);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs">
          {d.changeAssignee}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{d.editAssignee}</DialogTitle>
        </DialogHeader>
        {/* トスアップ / クロージングはそれぞれ独立に所属区分と担当者を選べる。 */}
        <div className="space-y-5">
          <AssigneeFields
            idPrefix="edit-tossup"
            roleLabel={d.fields.tossUpAssignee}
            selection={tossUp}
            onChange={setTossUp}
            users={users}
            dealers={dealers}
          />
          <AssigneeFields
            idPrefix="edit-closing"
            roleLabel={d.fields.closingAssignee}
            selection={closing}
            onChange={setClosing}
            users={users}
            dealers={dealers}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {d.cancel}
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? c.saving : d.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
