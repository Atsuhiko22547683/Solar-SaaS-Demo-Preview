"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { formatEventDateTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import type { HistoryCategory, HistoryEntry } from "./data";

const INITIAL_VISIBLE = 5;

function formatDate(iso: string): string {
  return formatEventDateTime(iso);
}

function chipClass(category: HistoryCategory): string {
  switch (category) {
    case "tossup":
      return "bg-indigo-50 text-indigo-700";
    case "event":
      return "bg-teal-50 text-teal-700";
    case "appointment":
      return "bg-emerald-50 text-emerald-700";
    case "visit":
      return "bg-blue-50 text-blue-700";
    case "quote":
      return "bg-amber-50 text-amber-700";
    case "phone":
    case "email":
    case "other":
      return "bg-slate-100 text-slate-600";
  }
}

function dotClass(category: HistoryCategory): string {
  switch (category) {
    case "tossup":
      return "bg-indigo-500";
    case "event":
      return "bg-teal-500";
    case "appointment":
      return "bg-emerald-500";
    case "visit":
      return "bg-blue-500";
    case "quote":
      return "bg-amber-500";
    case "phone":
    case "email":
    case "other":
      return "bg-slate-400";
  }
}

function yen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

interface CustomerHistoryProps {
  entries: HistoryEntry[];
}

export function CustomerHistory({ entries }: CustomerHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const h = labels.customer.detail.history;

  if (entries.length === 0) {
    return <p className="text-mute-light text-sm">{h.empty}</p>;
  }

  const visible = expanded ? entries : entries.slice(0, INITIAL_VISIBLE);
  const hasMore = entries.length > INITIAL_VISIBLE;

  return (
    <div>
      <ol className="relative space-y-6">
        {/* thread spine */}
        <span className="bg-hairline-light absolute bottom-2 left-[5px] top-2 w-px" aria-hidden />
        {visible.map((e) => (
          <li key={e.id} className="relative pl-7">
            <span
              className={[
                "absolute left-0 top-1.5 size-3 rounded-full ring-4 ring-white",
                dotClass(e.category),
              ].join(" ")}
              aria-hidden
            />
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <div className="flex items-center gap-2">
                <span className="text-mute-light text-xs tabular-nums">{formatDate(e.date)}</span>
                <span
                  className={[
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    chipClass(e.category),
                  ].join(" ")}
                >
                  {h.kinds[e.category]}
                </span>
              </div>
              <span className="text-mute-light text-xs">
                {h.assignee}：{e.assignee}
              </span>
            </div>
            {e.category === "quote" && e.amount != null ? (
              <p className="mt-1 text-sm font-semibold tabular-nums text-amber-700">
                {h.amountLabel}: {yen(e.amount)}
              </p>
            ) : null}
            {e.body ? (
              <p className="text-body-light mt-1 whitespace-pre-wrap text-sm">{e.body}</p>
            ) : null}
          </li>
        ))}
      </ol>

      {hasMore && !expanded ? (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-link-light inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
          >
            {h.showAll}
            <ChevronDown size={14} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
