// 催事シフトの配置・勤務時間の入力。
//
// 役割（キャッチ / トス）:
//   キャッチ … ブースへお客様を呼び込む
//   トス     … 説明、ヒアリング、訪問日時の調整
//   既存の ShiftRole には LEAD / RECEPTION / PITCH / OTHER という旧値もあるが、
//   それらは別の意味を持つので キャッチ / トス へ読み替えない。新規の配置では
//   この 2 値だけを選べるようにし、旧値の行はそのまま表示する。
//
// 勤務時間:
//   予定（startPlanned / endPlanned）の初期値は催事の開催時間。
//   遅刻・早退・体調不良などで実際が違ったときは実績（startActual / endActual）へ記録し、
//   予定はそのまま残す。実績の修正で配置や重複判定が変わってはいけないので、
//   重複判定は予定時間だけを見る。

import { z } from "zod";

/** 新規配置で選べる役割。 */
export const PARTNER_SHIFT_ROLE_VALUES = ["CATCH", "TOSS"] as const;
export type PartnerShiftRole = (typeof PARTNER_SHIFT_ROLE_VALUES)[number];

const toDate = (v: string | Date): Date => (v instanceof Date ? v : new Date(v));

const dateTime = (label: string) =>
  z
    .union([z.string(), z.date()])
    .refine((v) => v !== "" && !Number.isNaN(toDate(v).getTime()), {
      message: `${label}を入力してください`,
    })
    .transform((v) => toDate(v));

const dateTimeOptional = z
  .union([z.string(), z.date()])
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : toDate(v)))
  .refine((v) => v === undefined || !Number.isNaN(v.getTime()), {
    message: "日時の形式が正しくありません",
  });

/** まとめて配置する 1 つの対象（催事の開催日 1 日ぶん）。 */
export const ShiftAssignTargetSchema = z.object({
  eventId: z.string().trim().min(1).max(64),
  /** 開催日。開催日レコードが無い催事では省略できる。 */
  eventDayId: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  /** 予定開始。既定は開催日の開催時間（画面で初期入力する）。 */
  startPlanned: dateTime("予定開始"),
  endPlanned: dateTime("予定終了"),
});
export type ShiftAssignTargetInput = z.input<typeof ShiftAssignTargetSchema>;

/**
 * 一括配置。月内の対象催事・開催日をまとめて選び、複数スタッフを同じ役割で入れる。
 * 対象 × スタッフ の組み合わせぶんのシフトを作る。
 */
export const PartnerShiftAssignSchema = z
  .object({
    targets: z.array(ShiftAssignTargetSchema).min(1, "配置する催事を選択してください").max(60),
    userIds: z.array(z.string().trim().min(1).max(64)).min(1, "スタッフを選択してください").max(50),
    role: z.enum(PARTNER_SHIFT_ROLE_VALUES, {
      required_error: "役割を選択してください",
      invalid_type_error: "役割を選択してください",
    }),
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
  })
  .superRefine((v, ctx) => {
    v.targets.forEach((t, i) => {
      if (t.startPlanned.getTime() >= t.endPlanned.getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["targets", i, "endPlanned"],
          message: "予定終了は予定開始より後にしてください",
        });
      }
    });
  });
export type PartnerShiftAssignInput = z.input<typeof PartnerShiftAssignSchema>;

/** 予定時間・役割の変更（1 行ぶん）。 */
export const PartnerShiftUpdateSchema = z
  .object({
    shiftId: z.string().trim().min(1).max(64),
    role: z.enum(PARTNER_SHIFT_ROLE_VALUES).optional(),
    startPlanned: dateTime("予定開始"),
    endPlanned: dateTime("予定終了"),
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
  })
  .superRefine((v, ctx) => {
    if (v.startPlanned.getTime() >= v.endPlanned.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endPlanned"],
        message: "予定終了は予定開始より後にしてください",
      });
    }
  });
export type PartnerShiftUpdateInput = z.input<typeof PartnerShiftUpdateSchema>;

/**
 * 実績時間の記録。予定は上書きしない。
 * 片方だけの記録（出勤したが退勤未記録など）も許す。
 */
export const PartnerShiftActualSchema = z
  .object({
    shiftId: z.string().trim().min(1).max(64),
    startActual: dateTimeOptional,
    endActual: dateTimeOptional,
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
  })
  .superRefine((v, ctx) => {
    if (v.startActual && v.endActual && v.startActual.getTime() >= v.endActual.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endActual"],
        message: "実績終了は実績開始より後にしてください",
      });
    }
  });
export type PartnerShiftActualInput = z.input<typeof PartnerShiftActualSchema>;

/** 配置の取り消し。 */
export const PartnerShiftUnassignSchema = z.object({
  shiftId: z.string().trim().min(1).max(64),
});
export type PartnerShiftUnassignInput = z.input<typeof PartnerShiftUnassignSchema>;

/** 催事の開催日（開催時間）の登録・更新。代理店側で使う。 */
export const EventDayUpsertSchema = z
  .object({
    eventId: z.string().trim().min(1).max(64),
    /** 'YYYY-MM-DD'。 */
    eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "開催日の形式が正しくありません"),
    /** 'HH:MM'。未入力なら開催時間なしで登録する（架空の時間で埋めない）。 */
    startTime: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "開始時刻の形式が正しくありません")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    endTime: z
      .string()
      .trim()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "終了時刻の形式が正しくありません")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
  })
  .superRefine((v, ctx) => {
    if (v.startTime && v.endTime && v.startTime >= v.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endTime"],
        message: "終了時刻は開始時刻より後にしてください",
      });
    }
  });
export type EventDayUpsertInput = z.input<typeof EventDayUpsertSchema>;

export const EventDayDeleteSchema = z.object({
  eventDayId: z.string().trim().min(1).max(64),
});
export type EventDayDeleteInput = z.input<typeof EventDayDeleteSchema>;
