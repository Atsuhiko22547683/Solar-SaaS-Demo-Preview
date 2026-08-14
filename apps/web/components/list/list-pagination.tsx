// 横断一覧画面で共有する数値ページネーション。
//
// マークアップ・サイズ・variant は S-032 顧客一覧（customers/page.tsx の
// ページャ部）と同一。1 ページに収まるときは何も描画しない。
// server component 前提（buildUrl はサーバ側で URL 文字列を組み立てる関数）。

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { labels } from "@/lib/i18n/labels";

/** 現在ページを中心とした最大 5 個の数値ボタン（顧客一覧の pageWindow と同一）。 */
function pageWindow(current: number, totalPages: number): number[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
  let start = Math.max(1, current - 2);
  const end = Math.min(totalPages, start + 4);
  start = Math.max(1, end - 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

interface ListPaginationProps {
  page: number;
  totalPages: number;
  /** ページ番号 → 遷移先 URL。呼び出し側で他の検索条件を保持する。 */
  buildUrl: (page: number) => string;
}

export function ListPagination({ page, totalPages, buildUrl }: ListPaginationProps) {
  if (totalPages <= 1) return null;

  const t = labels.customer.pagination;
  const pageText = t.pageOf
    .replace("{page}", String(page))
    .replace("{total}", String(Math.max(1, totalPages)));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        <Button
          asChild={page > 1}
          variant="outline"
          size="icon"
          className="h-9 w-9"
          disabled={page <= 1}
          aria-label={t.first}
        >
          {page > 1 ? (
            <Link href={buildUrl(1)}>
              <ChevronsLeft />
            </Link>
          ) : (
            <ChevronsLeft />
          )}
        </Button>

        <Button
          asChild={page > 1}
          variant="outline"
          size="icon"
          className="h-9 w-9"
          disabled={page <= 1}
          aria-label={t.prev}
        >
          {page > 1 ? (
            <Link href={buildUrl(page - 1)}>
              <ChevronLeft />
            </Link>
          ) : (
            <ChevronLeft />
          )}
        </Button>

        {pageWindow(page, totalPages).map((p) => (
          <Button
            key={p}
            asChild={p !== page}
            variant={p === page ? "default" : "outline"}
            size="icon"
            className="h-9 w-9 tabular-nums"
          >
            {p === page ? <span>{p}</span> : <Link href={buildUrl(p)}>{p}</Link>}
          </Button>
        ))}

        <Button
          asChild={page < totalPages}
          variant="outline"
          size="icon"
          className="h-9 w-9"
          disabled={page >= totalPages}
          aria-label={t.next}
        >
          {page < totalPages ? (
            <Link href={buildUrl(page + 1)}>
              <ChevronRight />
            </Link>
          ) : (
            <ChevronRight />
          )}
        </Button>

        <Button
          asChild={page < totalPages}
          variant="outline"
          size="icon"
          className="h-9 w-9"
          disabled={page >= totalPages}
          aria-label={t.last}
        >
          {page < totalPages ? (
            <Link href={buildUrl(totalPages)}>
              <ChevronsRight />
            </Link>
          ) : (
            <ChevronsRight />
          )}
        </Button>
      </div>

      <span className="text-mute-light text-sm tabular-nums">{pageText}</span>
    </div>
  );
}
