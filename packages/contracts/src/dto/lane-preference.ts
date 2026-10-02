// F-060「二次店レーン希望」ボトムアップ構造の DTO / zod schema（docs/05 §3.4.4）。
//
// 二次店が月単位で「希望するレーン（＝希望場所 venueLabel × 希望開催日 desiredDates）」を
// 希望順位付きで複数件提出する。venueLabel が一次ソース（必須）。venueProviderId /
// storeId / lineEventId はマスタ・確定レーンへの任意リンク（FK なし）で、loader 層が
// 同一 withTenant tx 内で findMany → Map により name を解決する。
//
// 卸非公開項目（固定費/成果報酬率/仕入値）は希望明細がスキーマ上そもそも保持しない。
// 任意リンク先を結合する際も name のみ select し、原価系を Object.keys に出さない
// （CLAUDE.md #5 / DEALER_OMITTED_LANE_PREFERENCE_KEYS で将来結合拡張のリグレッション防止）。

import { z } from "zod";

// 希望開催日: 'YYYY-MM-DD' 配列（§3.4.1-(4)）。LineEvent.scheduledDates と同方式。
export const DesiredDatesSchema = z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));
export type DesiredDates = z.infer<typeof DesiredDatesSchema>;

// destructure-and-rest の対象キー集合（Object.keys に出さない / CLAUDE.md #5・F-060 受入）。
export const DEALER_OMITTED_LANE_PREFERENCE_KEYS = [
  "fixedFee", // 場所提供元固定費（LineEvent / VenueProvider 由来。希望明細には載せない）
  "performanceRate", // 場所提供元成果報酬率
  "purchasePrice", // 仕入値（理論上ここに現れないが防御的に列挙）
] as const;

// 明細 DTO（一覧確認ビュー用。任意リンク名は loader が解決して name を埋める）。
export const LanePreferenceItemDtoSchema = z.object({
  // 何レーン目か。レーンごとに独立した希望順位を持つので、順位とは別の軸。
  // 表示順から推測せず、保存されている laneNo をそのまま使う。
  laneNo: z.number().int().positive(),
  priority: z.number().int().positive(), // 1=希望①（レーン内の順位）
  venueLabel: z.string(), // 一次ソース（必須）
  venueProviderId: z.string().nullable(),
  // 場所提供元の名称は「店舗マスタ経由で確かめられたとき」だけ入れる。
  // 旧データは店舗と無関係な提供元 id がぶら下がっていることがあり、
  // そのまま出すと「カインズ 大宮店 / 場所提供元: スーパービバホーム」になる。
  venueProviderName: z.string().nullable(),
  storeId: z.string().nullable(),
  storeName: z.string().nullable(), // loader 解決値
  lineEventId: z.string().nullable(),
  lineName: z.string().nullable(), // loader 解決値（確定レーン突合時）
  desiredDates: DesiredDatesSchema, // 既定 [] にフォールバック
  memo: z.string().nullable(),
  /** この店舗だけの個別条件（例「いずれか 2 日間を希望」）。順位へ読み替えない。 */
  conditionNote: z.string().nullable(),
  /** 採用されて確定したイベント。1 明細が複数イベントになりうる。 */
  adoptions: z.array(
    z.object({
      eventId: z.string(),
      eventCandidateId: z.string(),
      storeNameAtEvent: z.string(),
      scheduledDate: z.string(),
      decidedAt: z.string(),
    }),
  ),
});
export type LanePreferenceItemDto = z.infer<typeof LanePreferenceItemDtoSchema>;

export const LanePreferenceDtoSchema = z.object({
  id: z.string(),
  relationshipId: z.string(),
  dealerName: z.string(),
  targetMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  note: z.string().nullable(), // 旧 comment
  /**
   * 希望レーン数（提出時の申告値）。**明細数ではない。**
   * 以前は items.length を入れていたため「希望レーン 2 件」が候補店舗 2 件を指し、
   * レーン番号と希望順位の区別が画面から消えていた。申告の無い旧データは null。
   */
  laneCount: z.number().int().nonnegative().nullable(),
  /** 明細から数えた実レーン数（申告値との突き合わせ用）。 */
  laneCountFromItems: z.number().int().nonnegative(),
  /** 候補店舗の総数（＝明細数）。 */
  itemCount: z.number().int().nonnegative(),
  status: z.enum(["DRAFT", "SUBMITTED", "ANSWERED", "CONFIRMED"]),
  submittedAt: z.string(), // ISO
  items: z.array(LanePreferenceItemDtoSchema), // (laneNo, priority) 昇順
});
export type LanePreferenceDto = z.infer<typeof LanePreferenceDtoSchema>;

// 二次店提出フォーム入力（§3.4.5 saveLanePreference の payload）。
export const LanePreferenceItemInputSchema = z.object({
  venueLabel: z.string().min(1), // 必須
  venueProviderId: z.string().nullable().optional(),
  storeId: z.string().nullable().optional(),
  lineEventId: z.string().nullable().optional(),
  desiredDates: DesiredDatesSchema.default([]),
  memo: z.string().nullable().optional(),
  // priority はフォーム行順で自動採番（クライアント送信値は無視 / サーバ再採番）。
});
export type LanePreferenceItemInput = z.infer<typeof LanePreferenceItemInputSchema>;

export const SaveLanePreferenceInputSchema = z.object({
  targetMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  note: z.string().nullable().optional(),
  items: z.array(LanePreferenceItemInputSchema).min(1), // 希望レーン ≥ 1 件
});
export type SaveLanePreferenceInput = z.infer<typeof SaveLanePreferenceInputSchema>;

// 任意リンク先 (LineEvent / VenueProvider 等) を結合する際の防御ガード。原価系キー
// (DEALER_OMITTED_LANE_PREFERENCE_KEYS) を destructure-and-rest で物理除去し、戻り値の
// Object.keys に一切出さない（CLAUDE.md #5）。loader は本来 name のみ select するが、
// 将来 select を拡張した際のリグレッション防止に本ヘルパを通す。
export function stripDealerOmittedLaneKeys<T extends Record<string, unknown>>(
  link: T,
): Omit<T, (typeof DEALER_OMITTED_LANE_PREFERENCE_KEYS)[number]> {
  const {
    fixedFee: _fixedFee,
    performanceRate: _performanceRate,
    purchasePrice: _purchasePrice,
    ...rest
  } = link;
  void _fixedFee;
  void _performanceRate;
  void _purchasePrice;
  return rest;
}
