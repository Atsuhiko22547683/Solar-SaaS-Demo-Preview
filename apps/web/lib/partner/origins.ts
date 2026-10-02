// 提出フォームに渡す「依頼先代理店」の選択肢。
//
// 値そのものは PartnerContext（認証情報）から作る。DB へ問い合わせないので、
// フォームの描画のために余分なトランザクションを開かない。

import "server-only";

import { requirePartnerContext } from "./context";

import type { PermissionAction } from "@/lib/permissions/can";

export interface PartnerOrigins {
  options: { id: string; name: string }[];
  /** 取引先が 1 社に確定しているときだけ id（画面で選ばせない）。 */
  soleId: string | null;
}

/**
 * 呼び出し側の画面が要求するアクションで解決する。
 * （画面ごとに権限が違うので、アクションを受け取って使い回す）
 */
export async function listPartnerOrigins(action: PermissionAction): Promise<PartnerOrigins> {
  const partner = await requirePartnerContext(action);
  return {
    options: partner.relationships.map((r) => ({ id: r.id, name: r.wholesalerName })),
    soleId: partner.soleRelationshipId,
  };
}
