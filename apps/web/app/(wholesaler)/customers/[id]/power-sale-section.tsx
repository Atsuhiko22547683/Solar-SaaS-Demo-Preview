"use client";

// 顧客詳細「売電状況」タブ（設置申請タブとコールタブの間）。
//
// 顧客ごとの現在値 1 セット（売電開始日 + 備考）だけを扱う。履歴は持たない。
// 申請 ID のような補足情報は独立項目を作らず、備考へ自由記述する運用。
//
// 保存は既存の updateCustomerAction をそのまま使う（customer.update 権限 +
// withServerActionContext のテナント境界をそのまま引き継ぐ）。保存後は
// router.refresh() で最新値を取り直す — 他タブへ移動して戻っても、リロード後も残る。
//
// 項目が 2 つだけなので 2 カラムにはせず、既存の Label + 入力欄と同じトークンで縦に並べる。

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { labels } from "@/lib/i18n/labels";

import { updateCustomerAction } from "../actions";

// 既存の案件情報インライン編集（project-info-edit.tsx の FIELD）と同一トークン。
const FIELD =
  "h-9 w-full rounded-sm border border-hairline-light bg-white px-3 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

// 備考用。改行をそのまま扱うので textarea（高さのみ FIELD と変える）。
const TEXTAREA =
  "min-h-[9rem] w-full rounded-sm border border-hairline-light bg-white px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

/**
 * ISO → <input type="date"> 用 YYYY-MM-DD（ローカル日付）。
 * project-info-edit.tsx の toDateInput と同じ変換で、既存の日付のみ項目と挙動を揃える
 * （JST 運用前提。保存側の new Date("YYYY-MM-DD") と対で日付がずれない）。
 */
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

export interface PowerSaleInitial {
  customerId: string;
  /** 売電開始日（ISO 文字列 / 未設定は null）。 */
  powerSaleStartDate: string | null;
  /** 売電備考（改行を含む自由記述 / 未設定は null）。 */
  powerSaleNote: string | null;
}

export function PowerSaleSection({ initial }: { initial: PowerSaleInitial }) {
  const t = labels.customer.detail.powerSaleTab;
  const c = labels.common;
  const router = useRouter();

  const [startDate, setStartDate] = useState(toDateInput(initial.powerSaleStartDate));
  const [note, setNote] = useState(initial.powerSaleNote ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        await updateCustomerAction({
          id: initial.customerId,
          // 空欄は null で送る = 入力済みの値を消して未設定へ戻せる。
          powerSaleStartDate: startDate || null,
          powerSaleNote: note.length > 0 ? note : null,
        });
        toast.success(c.saved);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error && err.message ? err.message : c.unknownError);
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-mute-light text-sm">{t.hint}</p>

      <div className="space-y-1.5">
        <Label htmlFor="power-sale-start">{t.startDate}</Label>
        <input
          id="power-sale-start"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          // block を明示する: max-w で幅を絞ると inline-block のままラベルと同じ行に
          // 並んでしまい、備考（w-full で折り返す）と見出しの位置が揃わなくなる。
          className={`${FIELD} block max-w-xs`}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="power-sale-note">{t.note}</Label>
        <textarea
          id="power-sale-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t.notePlaceholder}
          rows={6}
          className={TEXTAREA}
        />
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={isPending}>
          {isPending ? t.saving : t.save}
        </Button>
      </div>
    </div>
  );
}
