// 製品カタログ（/product-catalog）の入力スキーマとカテゴリ定義。
//
// 既存の商品マスタ（schemas/product.ts）は「適用期間つきの価格版管理」を担う
// 別の面で、そちらは触らない。ここが担うのはカタログ画面が扱う 6 カテゴリと、
// カテゴリごとに必須になる項目の違いだけ。
//
// カテゴリの内部名は既存の ProductCategory をできる限り再利用する:
//
//   PV          -> PANEL      (既存)
//   BT          -> BATTERY    (既存)
//   エコキュート -> ECO_CUTE   (追加)
//   IH          -> IH         (追加)
//   プレゼント品 -> GIFT       (追加)
//   その他       -> OTHER_PART (既存)
//
// 表示順は PV → BT → エコキュート → IH → プレゼント品 → その他 で固定。
// タブ・サイドバー・登録フォームのセレクトは全てこの配列の順に従う。

import { z } from "zod";

import { type ProductCategory } from "./product.js";

/** カタログのカテゴリ。配列の順序がそのまま画面上の表示順になる。 */
export const CATALOG_CATEGORY_VALUES = ["PV", "BT", "ECO_CUTE", "IH", "GIFT", "OTHER"] as const;
export type CatalogCategory = (typeof CATALOG_CATEGORY_VALUES)[number];

export const CatalogCategorySchema = z.enum(CATALOG_CATEGORY_VALUES);

/** BT（蓄電池）の機能区分。同一シリーズ・同一容量でも区分が違えば別商品。 */
export const BATTERY_FUNCTION_TYPE_VALUES = ["SINGLE", "SPECIFIC_LOAD", "FULL_LOAD"] as const;
export type BatteryFunctionType = (typeof BATTERY_FUNCTION_TYPE_VALUES)[number];

export const BatteryFunctionTypeSchema = z.enum(BATTERY_FUNCTION_TYPE_VALUES);

/** 新規登録時に保存する ProductCategory。 */
export const CATALOG_TO_DB_CATEGORY: Record<CatalogCategory, ProductCategory> = {
  PV: "PANEL",
  BT: "BATTERY",
  ECO_CUTE: "ECO_CUTE",
  IH: "IH",
  GIFT: "GIFT",
  OTHER: "OTHER_PART",
};

/**
 * 一覧の絞り込みに使う ProductCategory の集合。
 *
 * 「その他」だけは、カタログ 6 分類が無かった頃の旧値
 * （POWER_CONDITIONER / MOUNT / SET）も拾う。拾わないと、過去に登録された
 * 商品がどのタブにも出ず画面から消えてしまうため。
 */
export const CATALOG_DB_CATEGORIES: Record<CatalogCategory, ProductCategory[]> = {
  PV: ["PANEL"],
  BT: ["BATTERY"],
  ECO_CUTE: ["ECO_CUTE"],
  IH: ["IH"],
  GIFT: ["GIFT"],
  OTHER: ["OTHER_PART", "POWER_CONDITIONER", "MOUNT", "SET"],
};

/** ProductCategory から、その商品が属するカタログカテゴリを引く。 */
export function toCatalogCategory(category: ProductCategory): CatalogCategory {
  for (const key of CATALOG_CATEGORY_VALUES) {
    if (CATALOG_DB_CATEGORIES[key].includes(category)) return key;
  }
  return "OTHER";
}

// ---------------------------------------------------------------------------
// カテゴリごとの項目要否
// ---------------------------------------------------------------------------
//
// 登録フォームは、この表で "hidden" の項目を描かない。全カテゴリで同じ入力欄を
// 並べて大半を空のまま出す、という状態を作らないための単一の情報源。
// サーバー側の検証（CatalogProductInputSchema）も同じ表を参照するので、
// 「画面には出ないのに必須で弾かれる」といったズレが起きない。

export type FieldRequirement = "required" | "optional" | "hidden";

export interface CatalogFieldSpec {
  /** 商品名。型番を持たないカテゴリ（プレゼント品 / その他）で必須。 */
  name: FieldRequirement;
  maker: FieldRequirement;
  series: FieldRequirement;
  modelNo: FieldRequirement;
  capacityKwh: FieldRequirement;
  batteryFunctionType: FieldRequirement;
  warrantyYears: FieldRequirement;
  note: FieldRequirement;
}

export const CATALOG_FIELDS: Record<CatalogCategory, CatalogFieldSpec> = {
  // PV: メーカー + 型番で識別する。シリーズは既存データが持っていれば残す。
  PV: {
    name: "hidden",
    maker: "required",
    series: "optional",
    modelNo: "required",
    capacityKwh: "hidden",
    batteryFunctionType: "hidden",
    warrantyYears: "hidden",
    note: "optional",
  },
  // BT: 型番ではなく「シリーズ × 容量 × 機能区分」で商品を区別する。
  BT: {
    name: "hidden",
    maker: "required",
    series: "required",
    modelNo: "optional",
    capacityKwh: "required",
    batteryFunctionType: "required",
    warrantyYears: "required",
    note: "optional",
  },
  ECO_CUTE: {
    name: "hidden",
    maker: "required",
    series: "required",
    modelNo: "required",
    capacityKwh: "hidden",
    batteryFunctionType: "hidden",
    warrantyYears: "hidden",
    note: "optional",
  },
  IH: {
    name: "hidden",
    maker: "required",
    series: "optional",
    modelNo: "required",
    capacityKwh: "hidden",
    batteryFunctionType: "hidden",
    warrantyYears: "hidden",
    note: "optional",
  },
  // プレゼント品 / その他は特定の製品スキーマを強制しない。商品名だけが必須。
  GIFT: {
    name: "required",
    maker: "optional",
    series: "hidden",
    modelNo: "optional",
    capacityKwh: "hidden",
    batteryFunctionType: "hidden",
    warrantyYears: "hidden",
    note: "optional",
  },
  OTHER: {
    name: "required",
    maker: "optional",
    series: "optional",
    modelNo: "optional",
    capacityKwh: "hidden",
    batteryFunctionType: "hidden",
    warrantyYears: "hidden",
    note: "optional",
  },
};

// ---------------------------------------------------------------------------
// 値の正規化
// ---------------------------------------------------------------------------

/**
 * 金額（仕入れ値 / 卸値）。整数円のみ・負数禁止。
 *
 * 全角数字とカンマは打ち間違いではなく入力習慣なので、弾かずに落として受ける。
 * Prisma には文字列のまま渡し、Number 経由の丸め誤差を通さない。
 */
const yen = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? String(v) : v))
  .transform((v) =>
    v
      .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      .replace(/[,\s¥￥]/g, "")
      .trim(),
  )
  .refine((v) => /^\d+$/.test(v), { message: "金額は 0 以上の整数で入力してください" })
  .refine((v) => v.length <= 12, { message: "金額が大きすぎます" });

/** 容量（kWh）。小数第 2 位まで・0 より大きい値。 */
const capacityKwh = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? String(v) : v.trim()))
  .refine((v) => /^\d{1,5}(\.\d{1,2})?$/.test(v), {
    message: "容量は数値（小数第 2 位まで）で入力してください",
  })
  .refine((v) => Number(v) > 0, { message: "容量は 0 より大きい値を入力してください" });

const warrantyYears = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? String(v) : v.trim()))
  .refine((v) => /^\d{1,2}$/.test(v), { message: "保証年数は 0〜99 の整数で入力してください" })
  .transform((v) => Number(v));

/** 空文字は「未入力」として undefined に寄せる（DB では null）。 */
const optionalText = z
  .string()
  .trim()
  .max(255)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const optionalNote = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

// ---------------------------------------------------------------------------
// 入力スキーマ
// ---------------------------------------------------------------------------

const baseFields = {
  category: CatalogCategorySchema,
  name: optionalText,
  maker: optionalText,
  series: optionalText,
  modelNo: optionalText,
  capacityKwh: capacityKwh.optional(),
  batteryFunctionType: BatteryFunctionTypeSchema.optional(),
  warrantyYears: warrantyYears.optional(),
  note: optionalNote,
  purchasePrice: yen,
  dealerPrice: yen,
};

/** 必須チェックの日本語見出し。zod の issue message に使う。 */
const FIELD_LABELS: Record<keyof CatalogFieldSpec, string> = {
  name: "商品名",
  maker: "メーカー",
  series: "シリーズ",
  modelNo: "型番",
  capacityKwh: "容量",
  batteryFunctionType: "機能区分",
  warrantyYears: "保証",
  note: "備考",
};

type CatalogShape = {
  category?: CatalogCategory;
} & Partial<Record<keyof CatalogFieldSpec, unknown>>;

/**
 * カテゴリごとの required / hidden をまとめて検証する。
 *
 *   required … 未入力なら issue
 *   hidden   … 値が来ていても無視される（issue にはしない。カテゴリを
 *              切り替えたときに前のカテゴリの値が残っても保存を止めないため。
 *              捨てるのは Server Action 側の責務）
 */
function applyCategoryRules<T extends z.ZodTypeAny>(schema: T): T {
  return schema.superRefine((data: unknown, ctx) => {
    const v = data as CatalogShape;
    if (!v.category) return;
    const spec = CATALOG_FIELDS[v.category];
    for (const key of Object.keys(spec) as (keyof CatalogFieldSpec)[]) {
      if (spec[key] !== "required") continue;
      const value = v[key];
      if (value === undefined || value === null || value === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${FIELD_LABELS[key]}を入力してください`,
        });
      }
    }
  }) as unknown as T;
}

export const CatalogProductInputSchema = applyCategoryRules(z.object(baseFields));
// 入力型は z.input。フォームは金額・容量・保証年数を文字列で渡し、
// 数値化・正規化は schema の transform に任せる。
export type CatalogProductInput = z.input<typeof CatalogProductInputSchema>;
export type CatalogProductParsed = z.output<typeof CatalogProductInputSchema>;

export const CatalogProductUpdateSchema = applyCategoryRules(
  z.object({ id: z.string().min(1), ...baseFields }),
);
export type CatalogProductUpdate = z.input<typeof CatalogProductUpdateSchema>;

/**
 * 商品の同一性キー。
 *
 * 型番はメーカーをまたぐと同じ文字列があり得るので、型番単独では判定しない。
 * 型番を持つカテゴリは（カテゴリ + メーカー + 型番）、BT は型番の代わりに
 * （シリーズ + 容量 + 機能区分）で区別する。DB のユニーク制約にはしない —
 * 既存の価格改定（同一タプルの後継行を作る運用）を壊すため、アプリ側の
 * 重複チェックにのみ使う。
 */
export function catalogIdentityKey(input: {
  category: CatalogCategory;
  maker?: string | null;
  series?: string | null;
  modelNo?: string | null;
  capacityKwh?: string | null;
  batteryFunctionType?: string | null;
  name?: string | null;
}): string {
  const norm = (v: string | null | undefined): string => (v ?? "").trim().toLowerCase();
  const parts: string[] =
    input.category === "BT"
      ? [
          norm(input.maker),
          norm(input.series),
          // 6.30 と 6.3 は同じ容量。数値に寄せてから比較する。
          input.capacityKwh ? String(Number(input.capacityKwh)) : "",
          norm(input.batteryFunctionType),
        ]
      : input.category === "GIFT" || input.category === "OTHER"
        ? [norm(input.maker), norm(input.name)]
        : [norm(input.maker), norm(input.modelNo)];
  // 連結ではなく JSON 配列にする。区切り文字が値に現れて別商品が同一視される、
  // という事故が起きない。
  return JSON.stringify([input.category, ...parts]);
}
