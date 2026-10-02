"use client";

// 一覧の検索条件の控え（sessionStorage）を、ログイン利用者・利用区分ごとに分ける。
//
// RememberListQuery はタブ内で条件を控え、BackToListLink がそれを読む。
// 同じタブで利用者を切り替えたり、利用区分が変わったりすると、前の利用者の条件
// （管理者だけが使える「提出スタッフ」など）が残ってしまう。データはサーバー側で
// 役割ごとに絞るので漏れはないが、意味の通らない条件で一覧へ戻ることになる。
//
// そこで「いまの利用者 + 区分」を控えておき、変わったら控えを捨てる。

import { useEffect } from "react";

import { LIST_QUERY_STORAGE_PREFIX } from "./remember-list-query";

const SCOPE_KEY = "partner:list-query-scope";

export function ListQueryScope({ scope }: { scope: string }) {
  useEffect(() => {
    try {
      const store = window.sessionStorage;
      if (store.getItem(SCOPE_KEY) === scope) return;
      // 後ろから消す（removeItem で添字が詰まるため）。
      for (let i = store.length - 1; i >= 0; i--) {
        const key = store.key(i);
        if (key && key.startsWith(LIST_QUERY_STORAGE_PREFIX)) store.removeItem(key);
      }
      store.setItem(SCOPE_KEY, scope);
    } catch {
      // storage が使えない環境（プライベートモード等）では何もしない。
    }
  }, [scope]);
  return null;
}
