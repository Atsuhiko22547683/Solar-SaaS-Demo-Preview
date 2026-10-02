// 二次店のアポイント登録の入力スキーマ。
//
// Google フォーム 2 種を置き換える。1 つの登録画面のタブとして見せるが、
// 項目も保存先も別なのでスキーマは分ける。
//
//   FIRST_VISIT … 「住設事業部/加盟店-①初訪アポフォーム」（21 項目）
//                 保存先: Customer（顧客情報・体制・催事・マエカク）
//                       + Appointment（初回訪問アポ日時・partnerKind）
//   VISIT       … 「住設事業部/加盟店-②訪問アポフォーム」（5 項目）
//                 保存先: DealerVisitAppointment（専用テーブル）
//
// 加盟店番号 / 所属二次店 / 登録者は認証済みユーザーから決まるので入力に含めない。
//
// フォームに無い項目は持たない。初訪アポの「トス部署」は①フォームに存在しない
// ため対象外で、②訪問アポフォームでのみ使う。

import { z } from "zod";

import { partnerOriginFields } from "./partner-origin.js";

/** アポイント区分。Prisma の PartnerAppointmentKind と 1:1。 */
export const PARTNER_APPOINTMENT_KIND_VALUES = ["FIRST_VISIT", "VISIT"] as const;
export type PartnerAppointmentKind = (typeof PARTNER_APPOINTMENT_KIND_VALUES)[number];

/** 対面者区分。Customer.faceToFace（true=主権者 / false=非主権者 / null=未設定）。 */
export const FACE_TO_FACE_VALUES = ["SOVEREIGN", "NON_SOVEREIGN"] as const;
export type FaceToFaceValue = (typeof FACE_TO_FACE_VALUES)[number];

/**
 * 初訪アポフォームの催事種別。カインズ / 島忠 / コメリ の 3 択。
 *
 * 催事日報（ES_日報）が使う CAINZ_W / CAINZ_V とは粒度が違うため、
 * そちらの値域（DEALER_REPORT_CHAIN_VALUES）とは別に持つ。DB の VenueChain は
 * 両方の値を持つ 1 つの enum で、値の統合・置換はしていない。
 */
export const PARTNER_FIRST_VISIT_VENUE_CHAIN_VALUES = ["CAINZ", "SHIMACHU", "KOMERI"] as const;

/** 催事ブース場所。Prisma の BoothArea と 1:1。 */
export const PARTNER_BOOTH_AREA_VALUES = ["ENTRANCE", "REFORM_CORNER", "OTHER"] as const;

/** 販売チャネル。Prisma の SalesChannel と 1:1。両フォーム共通。 */
export const PARTNER_SALES_CHANNEL_VALUES = [
  "VISIT_SALES",
  "INBOUND",
  "EVENT",
  "REFERRAL",
  "OTHER",
] as const;

/** 催事種別を入力する販売チャネル（フォームの注記に合わせる）。 */
export const VENUE_CHAIN_REQUIRED_CHANNEL = "EVENT";
/** 対面者を入力する販売チャネル。 */
export const FACE_TO_FACE_REQUIRED_CHANNEL = "VISIT_SALES";

const optionalText = (max = 255) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

const requiredText = (label: string, max = 255) =>
  z.string().trim().min(1, `${label}を入力してください`).max(max);

const PHONE_PATTERN = /^[0-9０-９+\-() ]+$/;

/** 任意の電話番号（ハイフン・全角も許容して形だけ見る）。 */
const optionalPhone = z
  .string()
  .trim()
  .max(32)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .refine((v) => v === undefined || PHONE_PATTERN.test(v), {
    message: "電話番号は数字とハイフンで入力してください",
  });

/** 必須の電話番号。 */
const requiredPhone = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label}を入力してください`)
    .max(32)
    .refine((v) => PHONE_PATTERN.test(v), {
      message: "電話番号は数字とハイフンで入力してください",
    });

/**
 * 必須の選択欄（enum）。
 *
 * 画面の select は未選択のとき "" を送る。Zod の required_error /
 * invalid_type_error は undefined・型違いにしか効かないので、"" は
 * invalid_enum_value になり既定の英文メッセージ（Invalid enum value. Expected …）
 * が出る。errorMap で「未選択」も「値域外」も同じ日本語メッセージに揃える。
 */
const requiredEnum = <T extends readonly [string, ...string[]]>(values: T, message: string) =>
  z.enum(values, { errorMap: () => ({ message }) });

const toDate = (v: string | Date) => (v instanceof Date ? v : new Date(v));

const dateTimeOptional = z
  .union([z.string(), z.date()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "") return undefined;
    const d = toDate(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  });

/** 必須の日付 / 日時。空文字・不正値は明示的に弾く（既定値を作らない）。 */
const dateTimeRequired = (label: string) =>
  z
    .union([z.string(), z.date()])
    .refine((v) => v !== "" && !Number.isNaN(toDate(v).getTime()), {
      message: `${label}を入力してください`,
    })
    .transform((v) => toDate(v));

// ---------------------------------------------------------------------------
// 初訪アポ（①初訪アポフォーム）
// ---------------------------------------------------------------------------

const firstVisitFields = {
  // ── 依頼元・催事の紐付け ──
  // 依頼元代理店（取引先が 1 社なら省略可）。
  ...partnerOriginFields,
  /**
   * 登録元の催事（Event.id）。トップの「この催事からアポ登録」から来たときに入る。
   * 店舗名の文字列一致ではなく id で結ぶ。催事外からの登録では省略。
   */
  eventId: optionalText(64),
  /** 催事の開催日（EventDay.id）。複数日催事でどの日の来場かを残す。 */
  eventDayId: optionalText(64),

  // ── 体制 ──
  /** トス獲得者（任意）。自社に登録済みの販売員から選ぶ。 */
  tossUpSalespersonId: optionalText(),
  /** クローズ会社（必須）。参照が許された Relationship から選ぶ。 */
  closingRelationshipId: requiredText("クローズ会社"),
  /** 営業担当者（必須）。自社に登録済みの販売員から選ぶ。 */
  closingSalespersonId: requiredText("営業担当者"),
  /** 販売チャネル（必須）。 */
  salesChannel: requiredEnum(PARTNER_SALES_CHANNEL_VALUES, "販売チャネルを選択してください"),

  // ── 催事 ──
  /** 催事実施日（訪販は訪問日・必須）。日付のみ。 */
  eventDate: dateTimeRequired("催事実施日"),
  /** 催事場所（必須）。 */
  venuePlace: requiredText("催事場所"),
  /** 催事種別（販売チャネルが「催事」のときだけ入力対象）。 */
  venueChain: z.enum(PARTNER_FIRST_VISIT_VENUE_CHAIN_VALUES).optional(),
  /** 催事ブース場所（必須）。未選択（""）も同じメッセージで弾く。 */
  boothArea: requiredEnum(PARTNER_BOOTH_AREA_VALUES, "ブース場所を選択してください"),
  /** ブース場所が「その他」のときだけ使う自由記述。 */
  boothAreaNote: optionalText(),
  /** 対面者（販売チャネルが「訪問販売」のときだけ入力対象）。 */
  faceToFace: z.enum(FACE_TO_FACE_VALUES).optional(),

  // ── お客様情報 ──
  name: requiredText("お客様名"),
  kana: requiredText("フリガナ"),
  /** 固定電話番号（任意）。 */
  landlinePhone: optionalPhone,
  /** 携帯番号（必須）。 */
  mobilePhone: requiredPhone("携帯番号"),
  postalCode: requiredText("郵便番号", 16),
  prefecture: requiredText("都道府県", 32),
  /** 市区町村・番地（正本は 1 項目）。 */
  cityAddress: requiredText("市区町村・番地"),
  note: optionalText(2000),

  // ── アポ・マエカク ──
  /** マエカク電話希望日時（任意）。 */
  maekakuPreferredAt: dateTimeOptional,
  /** マエカク実施者（必須・自由記述）。 */
  maekakuOperator: requiredText("マエカク実施者", 120),
  /** 初回訪問アポ日時（必須）。 */
  firstVisitAt: dateTimeRequired("初回訪問アポ日時"),
};

interface FirstVisitShape {
  salesChannel?: string;
  venueChain?: string;
  faceToFace?: string;
  boothArea?: string;
  boothAreaNote?: string;
}

/**
 * 条件付き項目の相互検証。
 *
 * フォームの注記どおり、催事種別は販売チャネルが「催事」のとき、対面者は
 * 「訪問販売」のときだけ入力対象。対象外チャネルで値が付いていると、
 * どちらが正か判らない行になるので保存前に弾く（画面側でも切替時に消す）。
 */
function applyFirstVisitRules<T extends z.ZodTypeAny>(schema: T): T {
  return schema.superRefine((data: unknown, ctx) => {
    const v = data as FirstVisitShape;

    if (v.salesChannel === VENUE_CHAIN_REQUIRED_CHANNEL) {
      if (!v.venueChain) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["venueChain"],
          message: "催事種別を選択してください",
        });
      }
    } else if (v.venueChain) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["venueChain"],
        message: "催事種別は販売チャネルが「催事」のときだけ入力してください",
      });
    }

    if (v.salesChannel === FACE_TO_FACE_REQUIRED_CHANNEL) {
      if (!v.faceToFace) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["faceToFace"],
          message: "対面者を選択してください",
        });
      }
    } else if (v.faceToFace) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["faceToFace"],
        message: "対面者は販売チャネルが「訪問販売」のときだけ入力してください",
      });
    }

    // ブース場所の自由記述は「その他」を選んだときだけ意味を持つ。
    if (v.boothAreaNote && v.boothArea !== "OTHER") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["boothAreaNote"],
        message: "ブース場所の自由記述は「その他」を選んだときだけ入力してください",
      });
    }
  }) as unknown as T;
}

export const PartnerFirstVisitCreateSchema = applyFirstVisitRules(z.object(firstVisitFields));
export type PartnerFirstVisitCreateInput = z.input<typeof PartnerFirstVisitCreateSchema>;

export const PartnerFirstVisitUpdateSchema = applyFirstVisitRules(
  z.object({ id: z.string().min(1), ...firstVisitFields }),
);
export type PartnerFirstVisitUpdateInput = z.input<typeof PartnerFirstVisitUpdateSchema>;

// ---------------------------------------------------------------------------
// 訪問アポ（②訪問アポフォーム）
// ---------------------------------------------------------------------------

const visitFields = {
  // 依頼元代理店（取引先が 1 社なら省略可）。
  ...partnerOriginFields,
  /**
   * 対象の顧客（任意）。
   *
   * このフォームは顧客名を聞かないので、提出者が自社の顧客から選んだときだけ入る。
   * 選ばれていれば代理店の顧客詳細からこの提出を辿れる。空なら紐付けない
   * （名前や日付が近いというだけで後から機械的に結び付けない）。
   */
  customerId: z.string().trim().min(1).optional(),
  /** トス部署（必須）。 */
  tossDept: requiredText("トス部署", 100),
  /** マエカク実施者（必須・自由記述）。 */
  maekakuOperator: requiredText("マエカク実施者", 120),
  /** クローズ部署（必須）。既存の「所属部署」とは別概念。 */
  closeDept: requiredText("クローズ部署", 100),
  /** 営業担当者（必須）。自社に登録済みの販売員から選ぶ。 */
  salespersonId: requiredText("営業担当者"),
  /** 販売チャネル（必須）。 */
  salesChannel: z.enum(PARTNER_SALES_CHANNEL_VALUES, {
    required_error: "販売チャネルを選択してください",
    invalid_type_error: "販売チャネルを選択してください",
  }),
};

export const PartnerVisitCreateSchema = z.object(visitFields);
export type PartnerVisitCreateInput = z.input<typeof PartnerVisitCreateSchema>;

export const PartnerVisitUpdateSchema = z.object({ id: z.string().min(1), ...visitFields });
export type PartnerVisitUpdateInput = z.input<typeof PartnerVisitUpdateSchema>;

// ---------------------------------------------------------------------------
// 変換ヘルパ
// ---------------------------------------------------------------------------

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
