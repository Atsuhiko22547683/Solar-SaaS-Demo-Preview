// パートナーポータルの「出店希望の提出」フォーム入力。
//
// 業務の形（メッセージアプリでのやり取りをそのまま写した形）:
//
//   対象月：7月 / 希望レーン数：2
//   1レーン目：第一希望 前橋みなみモール店 / 第二希望 伊勢崎店 / 第三希望 羽生店
//     希望日程：7/4〜5, 7/11〜12, 7/18〜20, 7/25〜26
//     個別条件：コメリ蒲原は、上記日程のいずれか 2 日間を希望
//   2レーン目：…（同様に複数の希望日程）
//
// 構造の決めごと:
//   - レーンは「枠」で、レーンごとに独立した希望順位（第一〜第n希望）を持つ。
//     laneNo × priority で位置が決まる。
//   - 希望日程はレーン単位。保存時はそのレーンの各明細へ同じ日付配列を書く
//     （店舗ごとに日程を変えたいときは明細側で差し替えられる）。
//   - 個別条件は店舗単位。「いずれか 2 日間を希望」のような条件は希望順位とは
//     別の軸なので、順位へ読み替えず conditionNote に持つ。
//
// relationshipId（依頼先代理店）は取引先が複数あるときだけ必須。サーバー側で
// 自社の取引関係に属するかを必ず検証する。

import { z } from "zod";

import { partnerOriginFields } from "./partner-origin.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const TARGET_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** 改行・カンマ・読点区切りの自由記述を 'YYYY-MM-DD' の配列にする。 */
const desiredDates = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .transform((v) =>
    (v ?? "")
      .split(/[\n,、\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  )
  .refine((arr) => arr.every((d) => DATE_RE.test(d)), {
    // 形式が違う行は落とさずエラーにする（黙って無視すると提出漏れに気付けない）。
    message: "希望日程は YYYY-MM-DD 形式で入力してください（複数は改行またはカンマ区切り）",
  });

const optionalNote = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

/** レーン内の 1 つの希望店舗。 */
export const PartnerLaneItemSchema = z.object({
  /**
   * 希望する店舗（店舗マスタの id）。保存値はこれ。
   *
   * 以前は venueLabel の自由記述だけだったため、「カインズ 大宮店」がマスタのどの行を
   * 指すのか決まらず、同じチェーンの別支店に結び付いてしまっていた。店舗名・住所・
   * 場所提供元はサーバーがこの id からマスタを引いて確定する。
   */
  storeId: z.string().min(1, "希望店舗を選択してください"),
  /** 表示用の名称。サーバーがマスタから埋めるので、画面からは送らせない。 */
  venueLabel: z.string().trim().max(255).optional(),
  /** この店舗だけの個別条件（例「上記日程のいずれか 2 日間を希望」）。 */
  conditionNote: optionalNote(500),
  /** 店舗ごとの補足メモ。 */
  memo: optionalNote(500),
});
export type PartnerLaneItemInput = z.input<typeof PartnerLaneItemSchema>;

/** 1 レーンぶんの希望。 */
export const PartnerLaneSchema = z.object({
  /** 何レーン目か（1 以上）。 */
  laneNo: z.coerce.number().int().min(1).max(20),
  /** 希望日程（レーン単位。複数指定できる）。 */
  desiredDates,
  /** 希望順位の順に並んだ店舗。先頭が第一希望。 */
  items: z.array(PartnerLaneItemSchema).min(1, "希望店舗を 1 件以上入力してください").max(10),
});
export type PartnerLaneInput = z.input<typeof PartnerLaneSchema>;

export const PartnerLanePreferenceSubmitSchema = z.object({
  ...partnerOriginFields,
  targetMonth: z.string().regex(TARGET_MONTH_RE, "対象月の指定が正しくありません"),
  /**
   * 希望レーン数（申告値）。明細から導出せず申告をそのまま残す
   * （「2 レーン希望だが 1 レーンぶんしか店舗が決まっていない」を表せるようにする）。
   */
  laneCount: z.coerce.number().int().min(1).max(20),
  /** 自由コメント（全体）。 */
  note: optionalNote(2000),
  lanes: z.array(PartnerLaneSchema).min(1, "レーンを 1 つ以上入力してください").max(20),
});
export type PartnerLanePreferenceSubmitInput = z.input<typeof PartnerLanePreferenceSubmitSchema>;

/** 提出・相談スレッドへの投稿。 */
export const PartnerThreadPostSchema = z.object({
  /** 対象の提出 / 相談。 */
  targetId: z.string().trim().min(1).max(64),
  body: z.string().trim().min(1, "内容を入力してください").max(4000),
});
export type PartnerThreadPostInput = z.input<typeof PartnerThreadPostSchema>;

/** 場所確保の相談（通常の希望提出とは別建て）。 */
export const VenueConsultationCreateSchema = z.object({
  ...partnerOriginFields,
  /** 対象月（任意。月をまたぐ相談もある）。 */
  targetMonth: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .refine((v) => v === undefined || TARGET_MONTH_RE.test(v), {
      message: "対象月の指定が正しくありません",
    }),
  /** 希望エリア（自由記述）。 */
  area: optionalNote(120),
  title: z.string().trim().min(1, "件名を入力してください").max(200),
  /** 相談内容（地域特性・確保してほしい場所など）。 */
  body: z.string().trim().min(1, "相談内容を入力してください").max(4000),
});
export type VenueConsultationCreateInput = z.input<typeof VenueConsultationCreateSchema>;
