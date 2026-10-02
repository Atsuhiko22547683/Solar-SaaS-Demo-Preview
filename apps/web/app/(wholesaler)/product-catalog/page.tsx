// /product-catalog — 先頭カテゴリ（PV）へ寄せるだけの入口。
//
// カタログは必ずどれか 1 カテゴリを開いた状態で使うので、
// 「カテゴリ未選択」という中間状態の画面は作らない。

import { redirect } from "next/navigation";

import { categoryPath, DEFAULT_CATEGORY } from "./categories";

export const dynamic = "force-dynamic";

export default function ProductCatalogIndexPage() {
  redirect(categoryPath(DEFAULT_CATEGORY));
}
