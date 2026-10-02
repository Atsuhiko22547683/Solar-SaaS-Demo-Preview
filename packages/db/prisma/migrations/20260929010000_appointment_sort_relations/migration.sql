-- 代理店-05: アポイント一覧の並べ替えを DB 側で組めるようにする。
--
-- acquiredByUserId / acquiredRelationshipId は id 文字列だけを持っていたので、
-- 「担当者名順」「担当会社順」を SQL で並べられなかった（取得済みの 1 ページだけを
-- JS で並べ替えると、ページ分割と件数が合わなくなる）。外部キーを張って関連にする。
--
-- 適用前に既存 116 行すべてが User / Relationship に実在することを確認済み。
-- 万一不整合があればこの ALTER が失敗するので、黙って壊れることはない。

DO $$ BEGIN
  ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_acquiredByUserId_fkey"
    FOREIGN KEY ("acquiredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_acquiredRelationshipId_fkey"
    FOREIGN KEY ("acquiredRelationshipId") REFERENCES "Relationship"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Appointment_acquiredByUserId_idx" ON "Appointment" ("acquiredByUserId");
-- acquiredRelationshipId の索引は既存（Appointment_acquiredRelationshipId_idx）。

-- 並べ替えでよく使う列の索引。既定の並び（アポ日時）と登録日時。
CREATE INDEX IF NOT EXISTS "Appointment_createdAt_idx" ON "Appointment" ("createdAt");
