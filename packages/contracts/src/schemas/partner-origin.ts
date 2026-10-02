// パートナー会社の提出物に共通する「依頼元代理店」の入力。
//
// 1 つのパートナー会社は複数の代理店（代理店 A・B）から依頼を受けられるため、提出物は
// どの代理店に対するものかを持つ必要がある。取引先が 1 社しか無いときは画面で選ばせず
// 省略でき、サーバー側（resolveRelationship）がその 1 社に決める。
//
// この id は「候補の中から選ばれたか」をサーバーで必ず検証する。送信された値を
// そのまま書き込み先には使わない。

import { z } from "zod";

/**
 * 依頼元代理店（Relationship.id）。任意。
 *
 * 空文字は「未選択」として扱い undefined に倒す（select の初期値が "" になるため）。
 */
export const RelationshipOriginSchema = z
  .string()
  .trim()
  .max(64)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

/** 提出フォームに混ぜるためのフィールド定義。 */
export const partnerOriginFields = {
  relationshipId: RelationshipOriginSchema,
};

export type PartnerOriginInput = z.infer<z.ZodObject<typeof partnerOriginFields>>;
