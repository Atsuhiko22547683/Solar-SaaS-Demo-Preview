"use client";

// 二次店ポータルのフォーム部品。
//
// 3 つの登録画面（アポイント / 催事日報 / 販売員）で同じ見た目・同じ検証表示に
// なるよう、入力欄の枠とエラー表示をここにまとめる。
//
// サーバー側の Zod が返すフィールド単位のエラーを受け取って各欄の下に出す。
// 画面の必須表示とサーバーの検証規則は同じスキーマ由来なのでズレない。

import { labels } from "@/lib/i18n/labels";

import type { ReactNode } from "react";

// 狭い画面では高さ 44px・文字 16px。16px 未満だと iOS が focus 時に自動拡大し、
// 画面がずれて「保存」まで届かなくなる。広い画面は従来どおりの高さ・文字。
// scroll-mt-28 は追従ヘッダ（2 段で最大 92px 程度）の分。必須エラーでブラウザが
// 入力欄へ自動スクロールしたとき、対象がヘッダの裏に隠れないようにする。
export const FIELD_CLASS =
  "border-ash-light text-ink focus:border-primary focus:ring-primary/40 h-11 w-full scroll-mt-28 rounded-md border bg-white px-3 text-base focus:outline-none focus:ring-2 sm:h-9 sm:text-sm";

export const TEXTAREA_CLASS =
  "border-ash-light text-ink focus:border-primary focus:ring-primary/40 min-h-24 w-full scroll-mt-28 rounded-md border bg-white px-3 py-2 text-base focus:outline-none focus:ring-2 sm:min-h-20 sm:text-sm";

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
      <label htmlFor={htmlFor} className="text-ink block break-words text-sm font-medium">
        {label}
        {/* 必須マークは見た目だけ。アクセシブル名に「*」を混ぜると項目名が
            「催事ブース場所 *」のように変わってしまうので支援技術からは隠し、
            必須であることは入力要素側の required / aria-required で伝える。 */}
        {required ? (
          <span aria-hidden="true" className="text-danger ml-1 text-xs">
            *
          </span>
        ) : null}
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
          className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 items-center justify-center rounded-md border px-4 text-sm"
        >
          {cancelLabel}
        </a>
        <button
          type="submit"
          disabled={pending}
          className="bg-primary focus-visible:ring-primary/40 inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 disabled:opacity-60"
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
interface ValidationIssue {
  path?: (string | number)[];
  message?: string;
}

/** 検証の指摘を「項目名 → メッセージ」に畳む。最初の指摘だけを欄の近くに出す。 */
export function issuesToFieldErrors(issues: ValidationIssue[]): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path?.[0];
    if (typeof key === "string" && issue.message && !fields[key]) {
      fields[key] = issue.message;
    }
  }
  return fields;
}

/** 文字列が検証エラーの JSON 配列なら、その指摘を返す。 */
function parseIssuesJson(message: string): ValidationIssue[] | null {
  const text = message.trim();
  if (!text.startsWith("[")) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return null;
    const issues = parsed.filter(
      (x): x is ValidationIssue => typeof x === "object" && x !== null && "message" in x,
    );
    return issues.length > 0 ? issues : null;
  } catch {
    return null;
  }
}

export function extractFieldErrors(err: unknown): { fields: FieldErrors; message: string | null } {
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (err as { issues?: ValidationIssue[] }).issues;
    if (Array.isArray(issues)) {
      const fields = issuesToFieldErrors(issues);
      if (Object.keys(fields).length > 0) return { fields, message: null };
    }
  }

  const raw = err instanceof Error && err.message ? err.message : null;
  if (raw) {
    // Server Action をまたぐと ZodError の issues は失われ、message だけが残る。
    // その message は指摘の JSON なので、生のまま画面に出さず項目別に畳む。
    const issues = parseIssuesJson(raw);
    if (issues) {
      const fields = issuesToFieldErrors(issues);
      if (Object.keys(fields).length > 0) return { fields, message: null };
      return { fields: {}, message: labels.partner.common.validationFailed };
    }
  }

  return { fields: {}, message: raw };
}
