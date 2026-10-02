"use client";

// 提出・相談に紐づくやり取りの表示と投稿。
//
// 独立した汎用チャットではなく「対象（出店希望 / 場所確保の相談）に紐づく往復」だけを扱う。
// 提出の記録（SUBMISSION）と代理店からの回答（ANSWER）も同じ並びに出すので、
// 何を出して何と言われたかが 1 か所で追える。

import { useState } from "react";

import { TEXTAREA_CLASS } from "@/components/partner/partner-form";
import { formatDateTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

const t = labels.partner.lanePreference;
const c = labels.partner.common;

export interface ThreadEntryView {
  id: string;
  side: "DEALER" | "WHOLESALER";
  kind: "MESSAGE" | "SUBMISSION" | "ANSWER";
  body: string;
  authorName: string | null;
  createdAt: string;
}

function kindLabel(kind: ThreadEntryView["kind"]): string {
  if (kind === "SUBMISSION") return t.threadKindSubmission;
  if (kind === "ANSWER") return t.threadKindAnswer;
  return t.threadKindMessage;
}

export function ThreadPanel({
  targetId,
  entries,
  post,
  /** 投稿できない場合（閲覧のみ）は false。 */
  canPost = true,
}: {
  targetId: string;
  entries: ThreadEntryView[];
  post: (input: { targetId: string; body: string }) => Promise<{ ok: true }>;
  canPost?: boolean;
}) {
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim().length === 0) return;
    setPending(true);
    setError(null);
    try {
      await post({ targetId, body });
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t.errors.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-mute-light text-[13px]">{t.threadHint}</p>

      {entries.length === 0 ? (
        <p className="text-mute-light text-sm">{t.threadEmpty}</p>
      ) : (
        <ol className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={[
                "rounded-md border p-3",
                entry.side === "WHOLESALER"
                  ? "border-primary/30 bg-primary/5"
                  : "border-hairline-light bg-surface-soft/40",
              ].join(" ")}
            >
              <p className="text-mute-light mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span className="text-ink font-semibold">
                  {entry.side === "WHOLESALER" ? t.threadSideWholesaler : t.threadSideDealer}
                </span>
                <span>{kindLabel(entry.kind)}</span>
                <span>{entry.authorName ?? c.dash}</span>
                <span className="tabular-nums">{formatDateTime(entry.createdAt)}</span>
              </p>
              {/* 提出の記録は改行で組み立てているので、そのまま折り返して見せる。 */}
              <p className="text-body-light whitespace-pre-wrap break-words text-sm">
                {entry.body}
              </p>
            </li>
          ))}
        </ol>
      )}

      {canPost ? (
        <form onSubmit={onSubmit} className="space-y-2">
          <label htmlFor="thread-body" className="text-ink block text-sm font-medium">
            {t.threadBody}
          </label>
          <textarea
            id="thread-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className={TEXTAREA_CLASS}
          />
          {error ? (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending || body.trim().length === 0}
              className="bg-primary focus-visible:ring-primary/40 inline-flex h-11 w-full items-center justify-center rounded-md px-4 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 disabled:opacity-60 sm:w-auto"
            >
              {pending ? c.saving : t.threadPost}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
