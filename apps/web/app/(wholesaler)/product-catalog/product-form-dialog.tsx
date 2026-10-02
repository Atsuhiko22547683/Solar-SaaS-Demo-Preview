"use client";

// 商品の登録 / 編集ダイアログ。
//
// 入力欄はカテゴリごとに出し分ける（@solar/contracts の CATALOG_FIELDS が唯一の
// 情報源。サーバー側の検証も同じ表を見るので、画面に無い項目で弾かれることはない）。
// 全カテゴリ共通の入力欄を並べて大半を空欄のまま出す、という形にはしない。
//
// 登録時のカテゴリ初期値は「いま開いているタブ」。編集時はカテゴリを変えられない
// （カテゴリが変わると必須項目も同一性も変わり、既存の参照の意味が揺れるため）。

import {
  BATTERY_FUNCTION_TYPE_VALUES,
  CATALOG_CATEGORY_VALUES,
  CATALOG_FIELDS,
  type CatalogCategory,
  type CatalogFieldSpec,
} from "@solar/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
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
import { Label } from "@/components/ui/label";
import { labels } from "@/lib/i18n/labels";

import { createCatalogProductAction, updateCatalogProductAction } from "./actions";

import type { CatalogProductListItem } from "./data";

const t = labels.productCatalog;

const FIELD =
  "border-ash-light text-ink focus:border-primary focus:ring-primary/40 h-9 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2";

const TEXTAREA =
  "border-ash-light text-ink focus:border-primary focus:ring-primary/40 min-h-16 w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2";

/** 入力欄の状態。数値も文字列で持ち、送信時にそのまま Server Action へ渡す。 */
interface FormState {
  name: string;
  maker: string;
  series: string;
  modelNo: string;
  capacityKwh: string;
  batteryFunctionType: string;
  warrantyYears: string;
  purchasePrice: string;
  dealerPrice: string;
  note: string;
}

const EMPTY: FormState = {
  name: "",
  maker: "",
  series: "",
  modelNo: "",
  capacityKwh: "",
  batteryFunctionType: "",
  warrantyYears: "",
  purchasePrice: "",
  dealerPrice: "",
  note: "",
};

function fromProduct(product: CatalogProductListItem): FormState {
  return {
    name: product.name,
    maker: product.maker,
    series: product.series ?? "",
    modelNo: product.modelNo ?? "",
    capacityKwh: product.capacity ?? "",
    batteryFunctionType: product.batteryFunctionType ?? "",
    warrantyYears: product.warrantyYears === null ? "" : String(product.warrantyYears),
    purchasePrice: product.purchasePrice,
    dealerPrice: product.dealerPrice,
    note: product.note ?? "",
  };
}

type TextFieldKey = Extract<keyof CatalogFieldSpec, "name" | "maker" | "series" | "modelNo">;

const TEXT_FIELD_ORDER: TextFieldKey[] = ["name", "maker", "series", "modelNo"];

export function ProductFormDialog({
  mode,
  open,
  onOpenChange,
  category: fixedCategory,
  product,
  makerOptions,
}: {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 登録時は開いているカテゴリが初期値、編集時は固定値。 */
  category: CatalogCategory;
  product?: CatalogProductListItem;
  /**
   * メーカー入力の候補（テナント内の既存メーカー）。
   * 候補は入力補助でしかなく、ここに無い名前もそのまま登録できる
   * （メーカー専用のマスタは持たない）。
   */
  makerOptions: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState<CatalogCategory>(fixedCategory);
  const [form, setForm] = useState<FormState>(product ? fromProduct(product) : EMPTY);
  const [error, setError] = useState<string | null>(null);

  // 開くたびに初期値へ戻す。閉じたときの入力が次の登録に残らないようにする。
  useEffect(() => {
    if (!open) return;
    setCategory(fixedCategory);
    setForm(product ? fromProduct(product) : EMPTY);
    setError(null);
  }, [open, fixedCategory, product]);

  const spec = CATALOG_FIELDS[category];
  const idPrefix = `catalog-form-${mode}`;
  const makerListId = `${idPrefix}-maker-options`;

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        // 表示していない項目は送らない（サーバー側でも hidden は捨てるが、
        // 送らないほうが「見えない値が保存される」経路そのものが無い）。
        const payload = {
          category,
          ...(spec.name !== "hidden" ? { name: form.name } : {}),
          ...(spec.maker !== "hidden" ? { maker: form.maker } : {}),
          ...(spec.series !== "hidden" ? { series: form.series } : {}),
          ...(spec.modelNo !== "hidden" ? { modelNo: form.modelNo } : {}),
          ...(spec.capacityKwh !== "hidden" && form.capacityKwh
            ? { capacityKwh: form.capacityKwh }
            : {}),
          ...(spec.batteryFunctionType !== "hidden" && form.batteryFunctionType
            ? {
                batteryFunctionType:
                  form.batteryFunctionType as (typeof BATTERY_FUNCTION_TYPE_VALUES)[number],
              }
            : {}),
          ...(spec.warrantyYears !== "hidden" && form.warrantyYears
            ? { warrantyYears: form.warrantyYears }
            : {}),
          ...(spec.note !== "hidden" ? { note: form.note } : {}),
          purchasePrice: form.purchasePrice,
          dealerPrice: form.dealerPrice,
        };

        if (mode === "edit" && product) {
          await updateCatalogProductAction({ ...payload, id: product.id });
          toast.success(labels.common.saved);
        } else {
          await createCatalogProductAction(payload);
          toast.success(t.create.done);
        }
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        const message =
          err instanceof Error && err.message ? err.message : labels.common.unknownError;
        setError(message);
        toast.error(message);
      }
    });
  }

  const copy = mode === "create" ? t.create : t.edit;

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3 text-left">
          {/* カテゴリ。登録時のみ変更できる。 */}
          <div className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-category`}>{t.create.category}</Label>
            <select
              id={`${idPrefix}-category`}
              value={category}
              disabled={pending || mode === "edit"}
              className={`${FIELD} disabled:bg-surface-soft disabled:text-mute-light`}
              onChange={(e) => setCategory(e.target.value as CatalogCategory)}
            >
              {CATALOG_CATEGORY_VALUES.map((c) => (
                <option key={c} value={c}>
                  {t.categories[c]}
                </option>
              ))}
            </select>
          </div>

          {TEXT_FIELD_ORDER.filter((key) => spec[key] !== "hidden").map((key) => {
            // メーカーだけは既存の候補から選べるようにする（combobox）。
            // 専用マスタは作らないので、候補は既存商品から集めた名前で、
            // 一覧に無いメーカーはそのまま打ち込めば新しい名前として保存される。
            const isMaker = key === "maker";
            return (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`${idPrefix}-${key}`}>
                  {t.fields[key]}
                  {spec[key] === "optional" ? (
                    <span className="text-mute-light ml-1 text-xs">{labels.common.optional}</span>
                  ) : null}
                </Label>
                <input
                  id={`${idPrefix}-${key}`}
                  type="text"
                  value={form[key]}
                  autoComplete="off"
                  disabled={pending}
                  className={FIELD}
                  {...(isMaker
                    ? {
                        list: makerListId,
                        placeholder: labels.productCatalog.makerInput.placeholder,
                      }
                    : {})}
                  onChange={(e) => set(key, e.target.value)}
                />
                {isMaker ? (
                  <>
                    <datalist id={makerListId}>
                      {makerOptions.map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                    <p className="text-mute-light text-xs">
                      {labels.productCatalog.makerInput.hint}
                    </p>
                  </>
                ) : null}
              </div>
            );
          })}

          {spec.capacityKwh !== "hidden" ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-capacity`}>
                {t.fields.capacity}
                <span className="text-mute-light ml-1 text-xs">({t.capacitySuffix})</span>
              </Label>
              <input
                id={`${idPrefix}-capacity`}
                // 数値キーボードを出しつつ、小数点付きの入力も許す。
                type="text"
                inputMode="decimal"
                value={form.capacityKwh}
                placeholder="6.3"
                disabled={pending}
                className={FIELD}
                onChange={(e) => set("capacityKwh", e.target.value)}
              />
            </div>
          ) : null}

          {spec.batteryFunctionType !== "hidden" ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-function`}>{t.fields.batteryFunctionType}</Label>
              <select
                id={`${idPrefix}-function`}
                value={form.batteryFunctionType}
                disabled={pending}
                className={FIELD}
                onChange={(e) => set("batteryFunctionType", e.target.value)}
              >
                <option value="">{labels.common.notSet}</option>
                {BATTERY_FUNCTION_TYPE_VALUES.map((v) => (
                  <option key={v} value={v}>
                    {t.batteryFunctionTypes[v]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {spec.warrantyYears !== "hidden" ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-warranty`}>
                {t.fields.warranty}
                <span className="text-mute-light ml-1 text-xs">({t.warrantySuffix})</span>
              </Label>
              <input
                id={`${idPrefix}-warranty`}
                type="text"
                inputMode="numeric"
                value={form.warrantyYears}
                placeholder="20"
                disabled={pending}
                className={FIELD}
                onChange={(e) => set("warrantyYears", e.target.value)}
              />
            </div>
          ) : null}

          {/* 仕入れ値 / 卸値は全カテゴリ共通。名称は言い換えない。 */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-purchase`}>{t.fields.purchasePrice}</Label>
              <input
                id={`${idPrefix}-purchase`}
                type="text"
                inputMode="numeric"
                value={form.purchasePrice}
                placeholder="0"
                disabled={pending}
                className={`${FIELD} text-right tabular-nums`}
                onChange={(e) => set("purchasePrice", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-dealer`}>{t.fields.dealerPrice}</Label>
              <input
                id={`${idPrefix}-dealer`}
                type="text"
                inputMode="numeric"
                value={form.dealerPrice}
                placeholder="0"
                disabled={pending}
                className={`${FIELD} text-right tabular-nums`}
                onChange={(e) => set("dealerPrice", e.target.value)}
              />
            </div>
          </div>

          {spec.note !== "hidden" ? (
            <div className="space-y-1.5">
              <Label htmlFor={`${idPrefix}-note`}>
                {t.fields.note}
                <span className="text-mute-light ml-1 text-xs">{labels.common.optional}</span>
              </Label>
              <textarea
                id={`${idPrefix}-note`}
                value={form.note}
                disabled={pending}
                className={TEXTAREA}
                onChange={(e) => set("note", e.target.value)}
              />
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {copy.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? copy.submitting : copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
