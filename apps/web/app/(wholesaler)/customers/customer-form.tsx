"use client";

// Shared customer registration / edit form (T-04-06 / S-033 / S-065).
//
// Used by both wholesaler new/edit pages and dealer new page.
// The `onSubmit` prop allows each caller to supply its own action
// (wholesaler vs. dealer variant differ in ownerRelationshipId handling).

import { zodResolver } from "@hookform/resolvers/zod";
import { SALES_CHANNEL_VALUES } from "@solar/contracts";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { labels } from "@/lib/i18n/labels";

import type { SalesChannel } from "@solar/contracts";

// 対面者の select トークン。true=主権者 / false=非主権者 / ""=未設定。
const FACE_SOVEREIGN = "sovereign";
const FACE_NON_SOVEREIGN = "nonSovereign";

function boolToSelect(v: boolean | null): "" | typeof FACE_SOVEREIGN | typeof FACE_NON_SOVEREIGN {
  if (v === null) return "";
  return v ? FACE_SOVEREIGN : FACE_NON_SOVEREIGN;
}

function selectToBool(v: string): boolean | null {
  if (v === FACE_SOVEREIGN) return true;
  if (v === FACE_NON_SOVEREIGN) return false;
  return null;
}

// 既存の獲得チャネル select と同じ見た目（このフォームはトークン直書きで統一されている）。
const SELECT_CLASS =
  "border border-ash-light bg-white text-ink rounded-md px-3 py-2 text-sm h-9 w-full focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors";

export interface CustomerActionResult {
  id: string;
  duplicatePhoneWarning: boolean;
}

const FormSchema = z
  .object({
    name: z.string().trim().min(1, "氏名を入力してください").max(255),
    kana: z.string().max(255).optional().default(""),
    phone: z.string().trim().min(1, "電話番号を入力してください").max(50),
    email: z
      .string()
      .max(255)
      .optional()
      .default("")
      .refine((v) => v === "" || /.+@.+\..+/.test(v), "メールアドレスの形式が正しくありません"),
    postalCode: z.string().max(20).optional().default(""),
    address: z.string().max(500).optional().default(""),
    channel: z.enum(["EVENT", "WALK_IN", "TELE", "REFERRAL", "OTHER"]),
    sourceEventId: z.string().max(255).optional().default(""),
    // 販売関連。select は "" を未設定として扱う（送信時に null 化）。
    salesChannel: z
      .enum(["", ...SALES_CHANNEL_VALUES])
      .optional()
      .default(""),
    faceToFace: z.enum(["", FACE_SOVEREIGN, FACE_NON_SOVEREIGN]).optional().default(""),
    tossDept: z.string().max(100).optional().default(""),
    tossUpSalespersonId: z.string().max(64).optional().default(""),
    note: z.string().max(2000).optional().default(""),
  })
  .superRefine((data, ctx) => {
    if (data.channel === "EVENT" && !data.sourceEventId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceEventId"],
        message: "催事チャネルでは催事 ID を指定してください",
      });
    }
  });

type FormValues = z.infer<typeof FormSchema>;

export interface CustomerFormInitial {
  name: string;
  kana?: string;
  phone: string;
  email?: string;
  postalCode?: string;
  address?: string;
  channel: "EVENT" | "WALK_IN" | "TELE" | "REFERRAL" | "OTHER";
  sourceEventId?: string;
  salesChannel?: SalesChannel | null;
  faceToFace?: boolean | null;
  tossDept?: string | null;
  tossUpSalespersonId?: string | null;
  note?: string;
}

type Mode =
  // create でも initial を渡せる（イベント経由の登録で催事 ID / 販売チャネルを前埋めする）。
  | { kind: "create"; initial?: CustomerFormInitial }
  | { kind: "edit"; id: string; initial: CustomerFormInitial };

export interface CustomerFormValues {
  name: string;
  kana?: string;
  phone: string;
  email?: string;
  postalCode?: string;
  address?: string;
  channel: "EVENT" | "WALK_IN" | "TELE" | "REFERRAL" | "OTHER";
  sourceEventId?: string;
  salesChannel?: SalesChannel | null;
  faceToFace?: boolean | null;
  tossDept?: string | null;
  tossUpSalespersonId?: string | null;
  note?: string;
  id?: string;
}

/** トス獲得者の候補（自社スタッフ）。空配列なら選択欄自体を描画しない。 */
/** トスアップ担当の候補（スタッフマスタ = Salesperson の自社スタッフ）。 */
export interface TossUpStaffOption {
  id: string;
  name: string;
}

export interface CustomerFormProps {
  mode: Mode;
  /** トス獲得者の選択肢（卸業者側のみ。二次店側は空でよい）。 */
  tossUpStaff?: TossUpStaffOption[];
  /**
   * 実在イベント由来の登録で、販売チャネルを催事に固定するか。
   * 表示上の固定であって強制ではない — 実際の確定は createCustomerAction 側が行う。
   */
  lockEventSalesChannel?: boolean;
  /** Server action to invoke on submit. */
  onSubmitAction: (values: CustomerFormValues) => Promise<CustomerActionResult>;
  redirectTo?: string;
}

function toFormValues(initial?: CustomerFormInitial): FormValues {
  return {
    name: initial?.name ?? "",
    kana: initial?.kana ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    postalCode: initial?.postalCode ?? "",
    address: initial?.address ?? "",
    channel: initial?.channel ?? "EVENT",
    sourceEventId: initial?.sourceEventId ?? "",
    // 催事チャネルが既定なので、販売チャネルの初期値も催事（EVENT）に揃える。
    salesChannel:
      initial?.salesChannel ?? ((initial?.channel ?? "EVENT") === "EVENT" ? "EVENT" : ""),
    faceToFace: boolToSelect(initial?.faceToFace ?? null),
    tossDept: initial?.tossDept ?? "",
    tossUpSalespersonId: initial?.tossUpSalespersonId ?? "",
    note: initial?.note ?? "",
  };
}

export function CustomerForm({
  mode,
  tossUpStaff = [],
  lockEventSalesChannel = false,
  onSubmitAction,
  redirectTo,
}: CustomerFormProps) {
  const router = useRouter();
  const t = labels.customer;
  const d = t.detail;
  const c = labels.common;

  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(FormSchema) as any,
    defaultValues: toFormValues(mode.initial),
  });

  function onSubmit(values: FormValues) {
    setServerError(null);
    const blank = (s: string | undefined) => (s?.trim() ? s.trim() : undefined);

    startTransition(async () => {
      try {
        const result = await onSubmitAction({
          ...(mode.kind === "edit" ? { id: mode.id } : {}),
          name: values.name.trim(),
          kana: blank(values.kana),
          phone: values.phone.trim(),
          email: blank(values.email),
          postalCode: blank(values.postalCode),
          address: blank(values.address),
          channel: values.channel,
          sourceEventId: blank(values.sourceEventId),
          salesChannel: values.salesChannel === "" ? null : values.salesChannel,
          faceToFace: selectToBool(values.faceToFace),
          tossDept: blank(values.tossDept) ?? null,
          tossUpSalespersonId: blank(values.tossUpSalespersonId) ?? null,
          note: blank(values.note),
        });

        if (result.duplicatePhoneWarning) {
          toast.warning(t.feedback.duplicatePhone);
        }

        if (mode.kind === "create") {
          toast.success(c.saved);
          router.push(redirectTo ?? `/customers/${result.id}`);
        } else {
          toast.success(c.saved);
          router.refresh();
        }
      } catch (err) {
        const message = err instanceof Error && err.message ? err.message : c.unknownError;
        setServerError(message);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl space-y-4" noValidate>
        <Card className="space-y-5 p-5">
          {/* 基本情報 */}
          <section className="space-y-3">
            <h2 className="text-mute-light border-hairline-light border-b pb-1.5 text-xs font-semibold">
              {t.sections.basic}
            </h2>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t.fields.name} <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input autoComplete="off" aria-required="true" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="kana"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.fields.kana}</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* 連絡先 */}
          <section className="space-y-3">
            <h2 className="text-mute-light border-hairline-light border-b pb-1.5 text-xs font-semibold">
              {t.sections.contact}
            </h2>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t.fields.phone} <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="tel" autoComplete="tel" aria-required="true" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.fields.email}</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* 住所 */}
          <section className="space-y-3">
            <h2 className="text-mute-light border-hairline-light border-b pb-1.5 text-xs font-semibold">
              {t.sections.address}
            </h2>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="postalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.fields.postalCode}</FormLabel>
                    <FormControl>
                      <Input autoComplete="postal-code" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t.fields.address}</FormLabel>
                    <FormControl>
                      <Input autoComplete="street-address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          {/* 獲得チャネル */}
          <section className="space-y-3">
            <h2 className="text-mute-light border-hairline-light border-b pb-1.5 text-xs font-semibold">
              {t.sections.acquisition}
            </h2>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="channel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t.fields.channel} <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <select {...field} className={SELECT_CLASS}>
                        <option value="EVENT">{t.channels.EVENT}</option>
                        <option value="WALK_IN">{t.channels.WALK_IN}</option>
                        <option value="TELE">{t.channels.TELE}</option>
                        <option value="REFERRAL">{t.channels.REFERRAL}</option>
                        <option value="OTHER">{t.channels.OTHER}</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sourceEventId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.fields.sourceEventId}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        readOnly={lockEventSalesChannel}
                        aria-readonly={lockEventSalesChannel || undefined}
                        className={
                          lockEventSalesChannel ? "bg-surface-soft text-mute-light" : undefined
                        }
                        {...field}
                      />
                    </FormControl>
                    <p className="text-mute-light text-xs">
                      {lockEventSalesChannel ? t.sourceEventIdFromEvent : t.sourceEventIdHint}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 販売関連 — 催事で獲った情報をそのまま顧客へ引き継ぐ。
              販売チャネルの既定は催事（獲得チャネル EVENT と揃えている）。 */}
              <FormField
                control={form.control}
                name="salesChannel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{d.fields.salesChannel}</FormLabel>
                    <FormControl>
                      <select {...field} disabled={lockEventSalesChannel} className={SELECT_CLASS}>
                        <option value="">{d.unassigned}</option>
                        {SALES_CHANNEL_VALUES.map((v) => (
                          <option key={v} value={v}>
                            {d.salesChannelLabels[v]}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    {lockEventSalesChannel ? (
                      <p className="text-mute-light text-xs">{t.eventSalesChannelLocked}</p>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="faceToFace"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{d.fields.faceToFace}</FormLabel>
                    <FormControl>
                      <select {...field} className={SELECT_CLASS}>
                        <option value="">{d.unassigned}</option>
                        <option value={FACE_SOVEREIGN}>{d.faceToFaceLabels.sovereign}</option>
                        <option value={FACE_NON_SOVEREIGN}>
                          {d.faceToFaceLabels.nonSovereign}
                        </option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tossDept"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{d.fields.tossDept}</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {tossUpStaff.length > 0 ? (
                <FormField
                  control={form.control}
                  name="tossUpSalespersonId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{d.fields.tossUpAssignee}</FormLabel>
                      <FormControl>
                        <select {...field} className={SELECT_CLASS}>
                          <option value="">{d.unassigned}</option>
                          {tossUpStaff.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
            </div>
          </section>

          {/* 備考 */}
          <section className="space-y-3">
            <h2 className="text-mute-light border-hairline-light border-b pb-1.5 text-xs font-semibold">
              {t.sections.note}
            </h2>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t.fields.note}</FormLabel>
                    <FormControl>
                      <textarea
                        rows={4}
                        className="border-ash-light text-ink focus:ring-primary/40 focus:border-primary w-full rounded-md border bg-white px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>
        </Card>

        {serverError ? (
          <p role="alert" className="text-destructive text-sm font-medium">
            {serverError}
          </p>
        ) : null}

        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {c.back}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending
              ? c.saving
              : mode.kind === "create"
                ? t.actions.createSubmit
                : t.actions.updateSubmit}
          </Button>
        </div>
      </form>
    </Form>
  );
}
