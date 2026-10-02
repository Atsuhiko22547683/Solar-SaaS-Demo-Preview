"use client";

// 一覧の検索条件・並べ替え・ページ（URL クエリ）を sessionStorage に控える。
//
// 詳細画面の「一覧へ戻る」がこれを読み、直前の条件の一覧へ戻す。クライアント遷移では
// document.referrer が更新されないため、履歴ではなくこの控えを根拠にする。
// タブを閉じれば消える（sessionStorage）。

import { useEffect } from "react";

export const LIST_QUERY_STORAGE_PREFIX = "partner:list-query:";

export function RememberListQuery({ basePath }: { basePath: string }) {
  useEffect(() => {
    try {
      window.sessionStorage.setItem(LIST_QUERY_STORAGE_PREFIX + basePath, window.location.search);
    } catch {
      // storage が使えない環境（プライベートモード等）では単に控えない。
    }
  });
  return null;
}
