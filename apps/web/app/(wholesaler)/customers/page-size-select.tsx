"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { labels } from "@/lib/i18n/labels";

import { PAGE_SIZE_OPTIONS } from "./constants";

interface PageSizeSelectProps {
  pageSize: number;
  /**
   * 遷移先のパス。既定は顧客一覧。マエカク一覧など同じ表示件数セレクトを使う
   * 一覧画面が自分のパスを渡す（他の検索条件はそのまま維持される）。
   */
  basePath?: string;
}

export function PageSizeSelect({ pageSize, basePath = "/customers" }: PageSizeSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = labels.customer;

  const onChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("pageSize", value);
      // Changing page size resets to page 1.
      params.delete("page");
      router.push(`${basePath}?${params.toString()}`);
    },
    [searchParams, router, basePath],
  );

  return (
    <select
      value={String(pageSize)}
      onChange={(e) => onChange(e.target.value)}
      aria-label={t.pageSize.label.replace("{n}", String(pageSize))}
      className="border-hairline-light text-body-light focus:ring-primary/20 focus:border-primary h-9 rounded-md border bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2"
    >
      {PAGE_SIZE_OPTIONS.map((n) => (
        <option key={n} value={n}>
          {t.pageSize.label.replace("{n}", String(n))}
        </option>
      ))}
    </select>
  );
}
