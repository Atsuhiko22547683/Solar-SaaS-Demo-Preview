// 二次店の催事日報（Google フォーム「ES_日報」置き換え）の入力スキーマ。
//
// 項目定義の正本は apps/web/components/reports/result-report-data.ts と
// docs/02-functional-requirements.md F-064。当初指示と差異がある場合は
// フォーム準拠の既存定義を優先する。
//
// 合計値（抽選数 / 着座数 / アポ数）は入力させず保存もしない。両面 + 片面から
// 算出する（保存値と表示値の二重管理による不整合を作らないため）。
//
// wholesalerId / relationshipId / createdByUserId はこのスキーマに含めない。
// 認証済みユーザーからサーバー側で決めるもので、フォームから受け取らない。

import { z } from "zod";

import { partnerOriginFields } from "./partner-origin.js";

/** 種別（住宅設備 / 不動産）。Prisma の EventProductCategory と 1:1。 */
export const DEALER_REPORT_CATEGORY_VALUES = ["HOUSING_EQUIPMENT", "REAL_ESTATE"] as const;
export type DealerReportCategory = (typeof DEALER_REPORT_CATEGORY_VALUES)[number];

/** 催事区分。Prisma の VenueChain と 1:1。 */
export const DEALER_REPORT_CHAIN_VALUES = [
  "CAINZ_W",
  "CAINZ_V",
  "SHIMACHU",
  "KOMERI",
  "OTHER",
] as const;
export type DealerReportChain = (typeof DEALER_REPORT_CHAIN_VALUES)[number];

/** 成果数値。0 以上の整数のみ。 */
const count = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? String(v) : v.trim()))
  .refine((v) => /^\d+$/.test(v), { message: "0 以上の整数で入力してください" })
  .refine((v) => Number(v) <= 1_000_000, { message: "値が大きすぎます" })
  .transform((v) => Number(v));

/** "HH:MM"（24 時間表記）。画面は time input なのでこの形式で届く。 */
const timeOfDay = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "時刻は HH:MM 形式で入力してください");

/** 日付（YYYY-MM-DD もしくは ISO）。 */
const dateOnly = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)))
  .refine((d) => !Number.isNaN(d.getTime()), { message: "日付を入力してください" });

const requiredText = (label: string, max = 255) =>
  z.string().trim().min(1, `${label}を入力してください`).max(max);

/** "HH:MM" を分に直して比較する。 */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** 催事日報の数値が誰の実績か。合計の水増しを防ぐための区別。 */
export const DEALER_REPORT_SCOPE_VALUES = ["PERSON", "COMPANY", "BOOTH", "UNKNOWN"] as const;
export type DealerReportScopeValue = (typeof DEALER_REPORT_SCOPE_VALUES)[number];

const baseFields = {
  // 依頼元代理店（取引先が 1 社なら省略可）。
  ...partnerOriginFields,
  eventDate: dateOnly,
  venuePlace: requiredText("催事場所"),
  category: z.enum(DEALER_REPORT_CATEGORY_VALUES),
  venueChain: z.enum(DEALER_REPORT_CHAIN_VALUES),
  areaInFacility: requiredText("施設内エリア"),
  startTime: timeOfDay,
  endTime: timeOfDay,

  lotteryBoth: count,
  lotterySingle: count,
  seatedBoth: count,
  seatedSingle: count,
  apptBoth: count,
  apptSingle: count,

  // 共通の催事への紐付け。対象を選ばずに提出することも許す（マスタ未登録の場所、
  // 催事が登録される前の提出など）。紐付かない分は代理店側の「未紐付け」から扱う。
  eventId: z.string().min(1).nullable().optional(),
  eventDayId: z.string().min(1).nullable().optional(),
  // 数値の集計単位。既存フォームは聞いていなかったので、未選択は UNKNOWN のまま。
  // 合計に混ぜないための区別で、値を推測して埋めることはしない。
  reportScope: z.enum(DEALER_REPORT_SCOPE_VALUES).optional(),

  cainzPayCount: count.optional(),
  impression: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
};

interface ReportShape {
  startTime?: string;
  endTime?: string;
  lotteryBoth?: number;
  lotterySingle?: number;
  seatedBoth?: number;
  seatedSingle?: number;
  apptBoth?: number;
  apptSingle?: number;
}

/**
 * ファネルの大小関係と稼働時間の前後関係を検証する。
 *
 * 大小関係は合計だけでなく両面・片面それぞれでも見る（docs/02 F-064）。
 * 合計だけ通って内訳が逆転している、という状態を保存させないため。
 */
function applyReportRules<T extends z.ZodTypeAny>(schema: T): T {
  return schema.superRefine((data: unknown, ctx) => {
    const v = data as ReportShape;

    if (v.startTime && v.endTime && toMinutes(v.endTime) < toMinutes(v.startTime)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "稼働終了時間は稼働開始時間以降にしてください",
      });
    }

    // [内訳のキー, 上位のキー, メッセージの主語] の 3 段（抽選 → 着座 → アポ）。
    const chain = [
      {
        lower: ["seatedBoth", "seatedSingle"] as const,
        upper: ["lotteryBoth", "lotterySingle"] as const,
        label: "着座数",
        against: "抽選数",
      },
      {
        lower: ["apptBoth", "apptSingle"] as const,
        upper: ["seatedBoth", "seatedSingle"] as const,
        label: "アポ数",
        against: "着座数",
      },
    ];

    for (const step of chain) {
      const lowerBoth = v[step.lower[0]];
      const lowerSingle = v[step.lower[1]];
      const upperBoth = v[step.upper[0]];
      const upperSingle = v[step.upper[1]];
      if (
        lowerBoth === undefined ||
        lowerSingle === undefined ||
        upperBoth === undefined ||
        upperSingle === undefined
      ) {
        continue;
      }

      if (lowerBoth > upperBoth) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [step.lower[0]],
          message: `${step.label}（両面）は${step.against}（両面）以下にしてください`,
        });
      }
      if (lowerSingle > upperSingle) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [step.lower[1]],
          message: `${step.label}（片面）は${step.against}（片面）以下にしてください`,
        });
      }
      if (lowerBoth + lowerSingle > upperBoth + upperSingle) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [step.lower[0]],
          message: `${step.label}は${step.against}以下にしてください`,
        });
      }
    }
  }) as unknown as T;
}

export const DealerEventReportCreateSchema = applyReportRules(z.object(baseFields));
export type DealerEventReportCreateInput = z.input<typeof DealerEventReportCreateSchema>;
export type DealerEventReportCreateParsed = z.output<typeof DealerEventReportCreateSchema>;

export const DealerEventReportUpdateSchema = applyReportRules(
  z.object({ id: z.string().min(1), ...baseFields }),
);
export type DealerEventReportUpdateInput = z.input<typeof DealerEventReportUpdateSchema>;

/**
 * 合計値。保存しないので、表示・集計はすべてこの関数を通す。
 */
export function dealerReportTotals(r: {
  lotteryBoth: number;
  lotterySingle: number;
  seatedBoth: number;
  seatedSingle: number;
  apptBoth: number;
  apptSingle: number;
}): { lotteryTotal: number; seatedTotal: number; apptTotal: number } {
  return {
    lotteryTotal: r.lotteryBoth + r.lotterySingle,
    seatedTotal: r.seatedBoth + r.seatedSingle,
    apptTotal: r.apptBoth + r.apptSingle,
  };
}
