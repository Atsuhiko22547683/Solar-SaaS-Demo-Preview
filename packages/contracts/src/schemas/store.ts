// Zod schemas for the store master (店舗マスタ).
//
// 店舗は「名称必須」「論理停止のみ」のシンプルなマスタ。イベント候補登録時の
// 店舗選択肢として使う。Area マスタと同じく optional フィールドは trim + 空文字
// → undefined に正規化する。物理削除は持たない（Server Action 側で `disable` =
// `isActive=false` フリップ）。

import { z } from "zod";

/** 空文字は「未設定」として null に寄せる（画面の空欄と DB の NULL を一致させる）。 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const baseShape = {
  name: z.string().trim().min(1, "名称を入力してください").max(255),
  // 親チェーン (VenueProvider) への参照。null は「親なし」、undefined は
  // 「変更しない」(StoreUpdate での挙動)。
  venueProviderId: z.string().min(1).nullable().optional(),
  // 店舗の所在地。イベント候補の住所はここが正本になる
  // （親チェーンの本部住所ではなく、実際の開催場所の住所）。
  postalCode: optionalText(16),
  address: optionalText(255),
  // 開催エリア（AreaType.EVENT）。顧客エリアは値域が別なのでここには入らない。
  areaId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
};

export const StoreInputSchema = z.object(baseShape);
export type StoreInput = z.infer<typeof StoreInputSchema>;

export const StoreUpdateSchema = z.object({
  name: baseShape.name.optional(),
  venueProviderId: baseShape.venueProviderId,
  postalCode: baseShape.postalCode,
  address: baseShape.address,
  areaId: baseShape.areaId,
  isActive: baseShape.isActive,
});
export type StoreUpdate = z.infer<typeof StoreUpdateSchema>;
