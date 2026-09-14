"use client";

// 二次店ポータルのフォーム部品。
//
// 3 つの登録画面（アポイント / 催事日報 / 販売員）で同じ見た目・同じ検証表示に
// なるよう、入力欄の枠とエラー表示をここにまとめる。
//
// サーバー側の Zod が返すフィールド単位のエラーを受け取って各欄の下に出す。
// 画面の必須表示とサーバーの検証規則は同じスキーマ由来なのでズレない。

import type { ReactNode } from "react";

export const FIELD_CLASS =
  "border-ash-light text-ink focus:border-primary focus:ring-primary/40 h-9 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2";

export const TEXTAREA_CLASS =
  "border-ash-light text-ink focus:border-primary focus:ring-primary/40 min-h-20 w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2";

/** フィールド単位のエラー（Zod の issue path → メッセージ）。 */
export type FieldErrors = Record<string, string>;

export function PartnerFormField({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-ink block text-sm font-medium">
        {label}
        {required ? <span className="text-danger ml-1 text-xs">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-mute-light text-xs">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PartnerFormActions({
  submitLabel,
  pending,
  pendingLabel,
  cancelHref,
  cancelLabel,
  error,
}: {
  submitLabel: string;
  pending: boolean;
  pendingLabel: string;
  cancelHref: string;
  cancelLabel: string;
  error?: string | null;
}) {
  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : null}
      {/* 390px では縦に積む。保存・キャンセルが必ず画面内に収まるようにする。 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <a
          href={cancelHref}
          className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm"
        >
          {cancelLabel}
        </a>
        <button
          type="submit"
          disabled={pending}
          className="bg-primary focus-visible:ring-primary/40 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 disabled:opacity-60"
        >
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * Server Action が投げた例外からフィールド単位のエラーを取り出す。
 *
 * Zod のエラーは Server Action 境界を越えると message 文字列になるため、
 * 形が合わないときは全体エラーとして扱う（握りつぶさない）。
 */
export function extractFieldErrors(err: unknown): { fields: FieldErrors; message: string | null } {
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues?: { path?: (string | number)[]; message?: string }[] }).issues;
    if (Array.isArray(issues)) {
      const fields: FieldErrors = {};
      for (const issue of issues) {
        const key = issue.path?.[0];
        if (typeof key === "string" && issue.message && !fields[key]) {
          fields[key] = issue.message;
        }
      }
      if (Object.keys(fields).length > 0) return { fields, message: null };
    }
  }
  return {
    fields: {},
    message: err instanceof Error && err.message ? err.message : null,
  };
}
