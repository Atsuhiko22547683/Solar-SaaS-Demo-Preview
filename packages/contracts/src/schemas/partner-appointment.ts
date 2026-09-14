// 二次店のアポイント登録（Google フォーム「住設事業部/加盟店-①初訪アポフォーム」
// の置き換え）の入力スキーマ。
//
// 項目定義の正本は apps/web/components/reports/customer-report-data.ts と
// labels.customerReport。当初指示と差異がある場合はフォーム準拠の既存定義を優先する。
// （「クローズ部署」は正本に存在しないため対象外。）
//
// 加盟店番号 / 所属二次店 / 登録者は認証済みユーザーから決まるのでここに含めない。
// クローズ会社も同様に、提出した二次店を自動設定する。
//
// 保存先:
//   Customer    … 顧客情報・担当・販売チャネル・マエカク関連
//   Appointment … 初回訪問アポ日時・催事場所

import { z } from "zod";

/** 対面者区分。Customer.faceToFace（true=主権者 / false=非主権者 / null=未設定）。 */
export const FACE_TO_FACE_VALUES = ["SOVEREIGN", "NON_SOVEREIGN"] as const;
export type FaceToFaceValue = (typeof FACE_TO_FACE_VALUES)[number];

/** 催事種別。Prisma の VenueChain と 1:1。 */
export const PARTNER_VENUE_CHAIN_VALUES = [
  "CAINZ_W",
  "CAINZ_V",
  "SHIMACHU",
  "KOMERI",
  "OTHER",
] as const;

/** 催事ブース場所。Prisma の BoothArea と 1:1。 */
export const PARTNER_BOOTH_AREA_VALUES = ["ENTRANCE", "REFORM_CORNER", "OTHER"] as const;

/** 販売チャネル。Prisma の SalesChannel と 1:1。 */
export const PARTNER_SALES_CHANNEL_VALUES = [
  "VISIT_SALES",
  "INBOUND",
  "EVENT",
  "REFERRAL",
  "OTHER",
] as const;

const optionalText = (max = 255) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

const requiredText = (label: string, max = 255) =>
  z.string().trim().min(1, `${label}を入力してください`).max(max);

/** 日本の電話番号（ハイフン・全角も許容して数字だけ見る）。 */
const phone = z
  .string()
  .trim()
  .max(32)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .refine((v) => v === undefined || /^[0-9０-９+\-() ]+$/.test(v), {
    message: "電話番号は数字とハイフンで入力してください",
  });

const dateTimeOptional = z
  .union([z.string(), z.date()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "") return undefined;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  });

const dateOptional = dateTimeOptional;

const baseFields = {
  // ── 体制 ──
  /** トス獲得者。自社に登録済みの販売員から選ぶ（Customer.tossUpSalespersonId）。 */
  tossUpSalespersonId: optionalText(),
  /** 営業担当者。同上（Customer.closingSalespersonId）。 */
  closingSalespersonId: optionalText(),
  /** トス部署（自由記述・Customer.tossDept）。 */
  tossDept: optionalText(100),
  salesChannel: z.enum(PARTNER_SALES_CHANNEL_VALUES).optional(),

  // ── 催事 ──
  /**
   * 催事（任意）。自社が担当に割り当てられたイベントを選ぶと、催事実施日・
   * 催事種別・ブース場所がそのイベントから引かれる。選ばない場合は催事場所のみ
   * 自由記述で残す（Appointment.location）。
   */
  sourceEventId: optionalText(),
  /** 催事場所（自由記述）。イベント未選択でも記録できる。 */
  venuePlace: optionalText(),
  /** 催事種別。イベント未選択時に使う。 */
  venueChain: z.enum(PARTNER_VENUE_CHAIN_VALUES).optional(),
  /** 催事ブース場所。イベント未選択時に使う。 */
  boothArea: z.enum(PARTNER_BOOTH_AREA_VALUES).optional(),
  /** ブース場所が「その他」のときだけ使う自由記述。 */
  boothAreaNote: optionalText(),
  /** 対面者区分。 */
  faceToFace: z.enum(FACE_TO_FACE_VALUES).optional(),

  // ── お客様情報 ──
  /** お客様名（正本のラベルは「お客様名」）。 */
  name: requiredText("お客様名"),
  kana: optionalText(),
  /** 固定電話番号。携帯とどちらか一方が必須。 */
  landlinePhone: phone,
  /** 携帯番号。固定電話とどちらか一方が必須。 */
  mobilePhone: phone,
  postalCode: optionalText(16),
  prefecture: optionalText(32),
  /** 市区町村・番地（正本は 1 項目）。 */
  cityAddress: optionalText(),
  note: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),

  // ── アポ・マエカク ──
  maekakuPreferredAt: dateTimeOptional,
  /** マエカク実施者（自由記述。User / Salesperson へは紐付けない）。 */
  maekakuOperator: optionalText(120),
  /** 初回訪問アポ日時。 */
  firstVisitAt: dateTimeOptional,
  /**
   * 催事実施日（イベント未選択時の記録用）。
   * 日付のみ。UTC 0 時で保存し、時刻由来の日付ずれを起こさない。
   */
  eventDate: dateOptional,
};

interface PhoneShape {
  landlinePhone?: string;
  mobilePhone?: string;
  boothArea?: string;
  boothAreaNote?: string;
}

/**
 * 電話番号は固定・携帯のどちらか一方を必須にする。
 *
 * Customer.phone が NOT NULL なので、保存側では入力された方を代表値に入れる。
 * 「両方空」で保存されると連絡手段の無い顧客行ができてしまうため、ここで止める。
 */
function applyPhoneRule<T extends z.ZodTypeAny>(schema: T): T {
  return schema.superRefine((data: unknown, ctx) => {
    const v = data as PhoneShape;
    if (!v.landlinePhone && !v.mobilePhone) {
      for (const path of ["mobilePhone", "landlinePhone"]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [path],
          message: "固定電話番号または携帯番号のいずれかを入力してください",
        });
      }
    }

    // ブース場所の自由記述は「その他」を選んだときだけ意味を持つ。
    // 他の選択肢と併記されると、どちらが正か分からない行ができるため弾く。
    if (v.boothAreaNote && v.boothArea !== "OTHER") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["boothAreaNote"],
        message: "ブース場所の自由記述は「その他」を選んだときだけ入力してください",
      });
    }
  }) as unknown as T;
}

export const PartnerAppointmentCreateSchema = applyPhoneRule(z.object(baseFields));
export type PartnerAppointmentCreateInput = z.input<typeof PartnerAppointmentCreateSchema>;

export const PartnerAppointmentUpdateSchema = applyPhoneRule(
  z.object({ id: z.string().min(1), ...baseFields }),
);
export type PartnerAppointmentUpdateInput = z.input<typeof PartnerAppointmentUpdateSchema>;

/** Customer.faceToFace（3 状態）への変換。未選択は null（未設定）。 */
export function toFaceToFaceBoolean(v: FaceToFaceValue | undefined): boolean | null {
  if (v === undefined) return null;
  return v === "SOVEREIGN";
}

/** Customer.faceToFace から画面の選択値へ。 */
export function fromFaceToFaceBoolean(v: boolean | null): FaceToFaceValue | undefined {
  if (v === null) return undefined;
  return v ? "SOVEREIGN" : "NON_SOVEREIGN";
}
