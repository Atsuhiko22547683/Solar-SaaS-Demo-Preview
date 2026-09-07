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

/** 担当者に指定できるスタッフ。relationshipId が null なら自社スタッフ。 */
export interface StaffChoice {
  id: string;
  name: string;
  relationshipId: string | null;
  userId: string | null;
}

interface EditAssigneeDialogProps {
  customerId: string;
  currentTossUpUserId: string | null;
  currentTossUpRelationshipId: string | null;
  currentClosingUserId: string | null;
  currentClosingRelationshipId: string | null;
  users: UserChoice[];
  dealers: DealerChoice[];
  staff: StaffChoice[];
  currentTossUpSalespersonId: string | null;
  currentClosingSalespersonId: string | null;
}

/** 所属区分。"unset" は担当者そのものが未設定（担当者 select は disabled）。 */
const KINDS = ["unset", "user", "dealer"] as const;
type AssigneeKind = (typeof KINDS)[number];

/**
 * 1 役割ぶんの選択状態。
 *
 * - kind "user"（自社）: staffId にスタッフ、または userId に素の User
 *   （スタッフ未登録のログインユーザーも従来どおり選べるようにするため両方持つ）
 * - kind "dealer"（二次店）: relationshipId に会社、staffId にその所属スタッフ。
 *   staffId が空なら「所属二次店は判るが個人スタッフは未登録」を表す。
 */
interface AssigneeSelection {
  kind: AssigneeKind;
  staffId: string;
  userId: string;
  relationshipId: string;
}

/**
 * 保存済みの値 → 初期選択。どちらの列に値が入っているかで所属区分を判定する
 * （所属区分は DB に持たないので、既存データからの復元はここだけで完結する）。
 */
function toSelection(
  userId: string | null,
  relationshipId: string | null,
  salespersonId: string | null,
): AssigneeSelection {
  const empty = { kind: "unset" as AssigneeKind, staffId: "", userId: "", relationshipId: "" };
  if (relationshipId) {
    // 既存の二次店担当は会社までしか記録が無いことがある。その場合 staffId は
    // 空のまま = 「未登録」として復元し、勝手にスタッフを選択しない。
    return { ...empty, kind: "dealer", relationshipId, staffId: salespersonId ?? "" };
  }
  if (salespersonId) return { ...empty, kind: "user", staffId: salespersonId };
  if (userId) return { ...empty, kind: "user", userId };
  return empty;
}

/**
 * 選択状態 → Server Action へ送る値。
 *
 * スタッフを選んだ場合は salespersonId だけを送り、userId / relationshipId は
 * サーバ側が Salesperson から導出する（クライアント値を信用させない）。
 * スタッフ未選択のときだけ、従来どおり userId / relationshipId を直接送る。
 */
function toPayload(sel: AssigneeSelection): {
  salespersonId: string | null;
  userId: string | null;
  relationshipId: string | null;
} {
  if (sel.staffId) return { salespersonId: sel.staffId, userId: null, relationshipId: null };
  if (sel.kind === "user") {
    return { salespersonId: null, userId: sel.userId || null, relationshipId: null };
  }
  if (sel.kind === "dealer") {
    return { salespersonId: null, userId: null, relationshipId: sel.relationshipId || null };
  }
  return { salespersonId: null, userId: null, relationshipId: null };
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
  staff,
}: {
  idPrefix: string;
  roleLabel: string;
  selection: AssigneeSelection;
  onChange: (next: AssigneeSelection) => void;
  users: UserChoice[];
  dealers: DealerChoice[];
  staff: StaffChoice[];
}) {
  const d = labels.customer.detail;
  const selfStaff = staff.filter((s) => s.relationshipId === null);
  // 二次店スタッフは「選択中の二次店に所属する人」だけに絞る。
  const dealerStaff = staff.filter(
    (s) => s.relationshipId !== null && s.relationshipId === selection.relationshipId,
  );
  // 新規の担当者候補は Salesperson だけ。システムユーザー（User）は候補に出さない。
  // ただし *UserId しか持たない過去データは「今なんと表示されているか」を保つため、
  // 現在保存されている 1 件だけを選択肢として残す（新規候補ではなく現在値の復元用）。
  const legacyUser = selection.userId ? users.find((u) => u.id === selection.userId) : undefined;
  const kindLabel: Record<AssigneeKind, string> = {
    unset: d.unassigned,
    user: d.ownStaffGroup,
    dealer: d.dealerGroup,
  };

  // 所属区分を変えたら担当者は必ず未選択に戻す（区分と担当者の不整合を作らない）。
  function onKindChange(kind: AssigneeKind) {
    onChange({ kind, staffId: "", userId: "", relationshipId: "" });
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

      {/* 二次店のときは 会社 → 所属スタッフ の 2 段。会社を変えたらスタッフは外す。 */}
      {selection.kind === "dealer" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-dealer`}>{d.dealerGroup}</Label>
          <select
            id={`${idPrefix}-dealer`}
            value={selection.relationshipId}
            onChange={(e) =>
              onChange({
                kind: "dealer",
                relationshipId: e.target.value,
                staffId: "",
                userId: "",
              })
            }
            className={SELECT_CLASS}
          >
            <option value="">{d.unassigned}</option>
            {dealers.map((dl) => (
              <option key={dl.relationshipId} value={dl.relationshipId}>
                {dl.dealerName}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-select`}>
          {selection.kind === "dealer" ? d.assigneeStaffLabel : d.assigneeLabel}
        </Label>
        <select
          id={`${idPrefix}-select`}
          value={selection.staffId || selection.userId}
          // 所属区分が未設定 / 二次店未選択のときは選ぶものが無いので無効化する。
          disabled={
            selection.kind === "unset" ||
            (selection.kind === "dealer" && selection.relationshipId === "")
          }
          onChange={(e) => {
            const value = e.target.value;
            const isStaff = staff.some((s) => s.id === value);
            onChange({
              ...selection,
              staffId: isStaff ? value : "",
              // スタッフ未登録の素の User を選んだときだけ userId を持つ。
              userId: !isStaff && selection.kind === "user" ? value : "",
            });
          }}
          className={SELECT_CLASS}
        >
          {/* 二次店で会社だけ判っている既存データは、ここが「未登録」のまま復元される。 */}
          <option value="">
            {selection.kind === "dealer" ? d.assigneeStaffUnset : d.unassigned}
          </option>
          {selection.kind === "user" && (
            <>
              {selfStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              {/* 過去データ（*UserId のみ）の現在値。新規候補としては出さない。 */}
              {legacyUser ? (
                <option key={legacyUser.id} value={legacyUser.id}>
                  {d.assigneeLegacyUserOption(legacyUser.name)}
                </option>
              ) : null}
            </>
          )}
          {selection.kind === "dealer" &&
            dealerStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
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
  staff,
  currentTossUpSalespersonId,
  currentClosingSalespersonId,
}: EditAssigneeDialogProps) {
  const d = labels.customer.detail;
  const c = labels.common;
  const router = useRouter();

  const tossUpInitial = toSelection(
    currentTossUpUserId,
    currentTossUpRelationshipId,
    currentTossUpSalespersonId,
  );
  const closingInitial = toSelection(
    currentClosingUserId,
    currentClosingRelationshipId,
    currentClosingSalespersonId,
  );

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
          // スタッフを選んだときは salespersonId のみ送り、サーバ側が
          // Salesperson から userId / relationshipId を導出する。
          tossUpSalespersonId: tu.salespersonId,
          tossUpUserId: tu.userId,
          tossUpRelationshipId: tu.relationshipId,
          closingSalespersonId: cl.salespersonId,
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
            staff={staff}
          />
          <AssigneeFields
            idPrefix="edit-closing"
            roleLabel={d.fields.closingAssignee}
            selection={closing}
            onChange={setClosing}
            users={users}
            dealers={dealers}
            staff={staff}
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
