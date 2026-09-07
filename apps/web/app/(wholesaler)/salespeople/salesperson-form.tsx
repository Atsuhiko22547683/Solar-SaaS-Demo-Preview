"use client";

// 販売員の新規登録 / 編集フォーム。
//
// 新規は createSalespersonAction、編集は updateSalespersonAction を呼ぶ
// （いずれも三段ガード付きの既存 Server Action パターン）。
// 生年月日は date input（日付のみ）、それ以外は自由記述 / select。
// PII を含むが、このフォームは salesperson.update 権限が要る画面でのみ描画される。

import { EMPLOYMENT_TYPE_VALUES, GENDER_VALUES } from "@solar/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { labels } from "@/lib/i18n/labels";

import { createSalespersonAction, updateSalespersonAction } from "./actions";

const FIELD =
  "h-9 w-full rounded-sm border border-hairline-light bg-white px-3 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-surface-soft";
const TEXTAREA =
  "min-h-[5rem] w-full rounded-sm border border-hairline-light bg-white px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

/** ISO → <input type="date"> 用 YYYY-MM-DD（ローカル日付）。既存の日付項目と同じ変換。 */
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface SalespersonFormInitial {
  id: string;
  name: string;
  kana: string | null;
  relationshipId: string | null;
  userId: string | null;
  gender: string | null;
  birthDate: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  employmentType: string | null;
  note: string | null;
  isActive: boolean;
}

/** 所属二次店の選択肢（加盟店名は Relationship 由来）。 */
export interface RelationshipChoice {
  id: string;
  dealerName: string;
}

/** 同一人物リンク用の自社ログイン User 候補。 */
export interface LinkableUserChoice {
  id: string;
  name: string;
  email: string;
  linkedToStaffName: string | null;
}

export function SalespersonForm({
  initial,
  relationships,
  selfCompanyName,
}: {
  initial?: SalespersonFormInitial;
  relationships: RelationshipChoice[];
  selfCompanyName: string;
}) {
  const t = labels.salespersonList;
  const f = t.fields;
  const c = labels.common;
  const router = useRouter();

  const [name, setName] = useState(initial?.name ?? "");
  const [kana, setKana] = useState(initial?.kana ?? "");
  // 所属二次店。"" は自社スタッフ（relationshipId = null）。
  const [relationshipId, setRelationshipId] = useState(initial?.relationshipId ?? "");
  // スタッフとシステムユーザーは別管理なので、この画面から User を紐付けることは
  // しない。既存データ（過去に紐付けた userId）は保持だけして触らない。
  const userId = initial?.userId ?? "";
  const [gender, setGender] = useState(initial?.gender ?? "");
  const [birthDate, setBirthDate] = useState(toDateInput(initial?.birthDate ?? null));
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [employmentType, setEmploymentType] = useState(initial?.employmentType ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // 空欄は null で送る = 未設定へ戻せる（Action 側で trim + null 化）。
    const payload = {
      name,
      kana: kana || null,
      gender: (gender || null) as never,
      // 生年月日は任意。未入力は null（空文字やダミー日付を送らない）。
      birthDate: birthDate || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
      employmentType: (employmentType || null) as never,
      note: note || null,
      isActive,
      // "" は「二次店に所属しない = 自社スタッフ」。
      relationshipId: relationshipId || null,
      // 二次店スタッフには User を紐付けない（Server Action 側でも拒否する）。
      userId: relationshipId ? null : userId || null,
    };

    startTransition(async () => {
      try {
        // initial.id が空のときは「既存 User を初期値として新規登録」なので作成に回す
        // （スタッフ一覧の『スタッフ情報未登録』行からの導線）。
        if (initial?.id) {
          await updateSalespersonAction({ id: initial.id, ...payload });
        } else {
          await createSalespersonAction(payload);
        }
        toast.success(c.saved);
        router.push("/salespeople");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error && err.message ? err.message : c.unknownError);
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="sp-name">{f.name}</Label>
          <input
            id="sp-name"
            required
            value={name}
            disabled={isPending}
            onChange={(e) => setName(e.target.value)}
            className={FIELD}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sp-kana">{f.kana}</Label>
          <input
            id="sp-kana"
            value={kana}
            disabled={isPending}
            onChange={(e) => setKana(e.target.value)}
            className={FIELD}
          />
        </div>

        {/* 所属二次店。加盟店名は Relationship 由来なので、ここでは会社を選ぶだけ。
            未選択 = 自社スタッフで、所属会社名は自テナント名を表示する。 */}
        <div className="space-y-1.5">
          <Label htmlFor="sp-relationship">{f.relationship}</Label>
          <select
            id="sp-relationship"
            value={relationshipId}
            disabled={isPending}
            onChange={(e) => setRelationshipId(e.target.value)}
            className={FIELD}
          >
            <option value="">{t.relationshipUnset}</option>
            {relationships.map((r) => (
              <option key={r.id} value={r.id}>
                {r.dealerName}
              </option>
            ))}
          </select>
          <p className="text-mute-light text-xs">
            {relationshipId ? t.selfCompanyHint : `${f.companyName}: ${selfCompanyName}`}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sp-gender">{f.gender}</Label>
          <select
            id="sp-gender"
            value={gender}
            disabled={isPending}
            onChange={(e) => setGender(e.target.value)}
            className={FIELD}
          >
            <option value="">{labels.customer.detail.projectInfo.edit.unset}</option>
            {GENDER_VALUES.map((v) => (
              <option key={v} value={v}>
                {t.genderLabels[v] ?? v}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sp-birth-date">{f.birthDate}</Label>
          <input
            id="sp-birth-date"
            type="date"
            value={birthDate}
            disabled={isPending}
            onChange={(e) => setBirthDate(e.target.value)}
            className={FIELD}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sp-employment-type">{f.employmentType}</Label>
          <select
            id="sp-employment-type"
            value={employmentType}
            disabled={isPending}
            onChange={(e) => setEmploymentType(e.target.value)}
            className={FIELD}
          >
            <option value="">{labels.customer.detail.projectInfo.edit.unset}</option>
            {EMPLOYMENT_TYPE_VALUES.map((v) => (
              <option key={v} value={v}>
                {t.employmentTypeLabels[v] ?? v}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sp-phone">{f.phone}</Label>
          <input
            id="sp-phone"
            value={phone}
            disabled={isPending}
            onChange={(e) => setPhone(e.target.value)}
            className={FIELD}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sp-email">{f.email}</Label>
          <input
            id="sp-email"
            type="email"
            value={email}
            disabled={isPending}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <Label htmlFor="sp-address">{f.address}</Label>
          <input
            id="sp-address"
            value={address}
            disabled={isPending}
            onChange={(e) => setAddress(e.target.value)}
            className={FIELD}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <Label htmlFor="sp-note">{f.note}</Label>
          <textarea
            id="sp-note"
            value={note}
            disabled={isPending}
            rows={3}
            onChange={(e) => setNote(e.target.value)}
            className={TEXTAREA}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isActive}
          disabled={isPending}
          onChange={(e) => setIsActive(e.target.checked)}
          className="size-4"
        />
        {f.isActive}
      </label>

      <div className="flex justify-end gap-3">
        <Button asChild type="button" variant="outline" disabled={isPending}>
          <Link href="/salespeople">{c.cancel}</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? c.saving : c.save}
        </Button>
      </div>
    </form>
  );
}
