"use client";

// 詳細画面から一覧へ戻るリンク。
//
// 一覧の検索条件・並べ替え・ページは URL クエリに載っており、一覧画面が
// sessionStorage に控えている（remember-list-query.tsx）。ここではその控えを読み、
// 同じ条件の一覧へ戻す。控えが無ければ素の一覧へ送る。

import Link from "next/link";
import { useRouter } from "next/navigation";

import { LIST_QUERY_STORAGE_PREFIX } from "./remember-list-query";

export function BackToListLink({ href, label }: { href: string; label: string }) {
  const router = useRouter();

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    let search = "";
    try {
      search = window.sessionStorage.getItem(LIST_QUERY_STORAGE_PREFIX + href) ?? "";
    } catch {
      search = "";
    }
    if (search) {
      e.preventDefault();
      router.push(href + search);
    }
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className="text-primary text-sm underline-offset-4 hover:underline"
    >
      {label}
    </Link>
  );
}
