-- 顧客担当者の「個人スタッフ」参照。
--
-- 目的: トスアップ / クロージング担当を、会社（Relationship）だけでなく
--       個人（Salesperson）まで特定できるようにする。
--
-- 既存 4 列（tossUpUserId / tossUpRelationshipId / closingUserId /
-- closingRelationshipId）は互換のためそのまま残す。保存時はサーバ側で
-- Salesperson を読み、userId / relationshipId を導出して 3 列を整合させる。
--
-- 既存データのバックフィルは行わない:
--   二次店担当は Relationship（会社）までしか記録が無く、「同じ二次店に所属する
--   Salesperson の誰か」を担当者と推測するのは誤りになるため。既存行は
--   *SalespersonId が null のまま =「所属二次店は判るが個人スタッフは未登録」。
--   自社担当は Salesperson.userId = Customer.tossUpUserId / closingUserId から
--   安全に導出できるので、列を書き換えずに参照側で解決する。
--
-- 追加する nullable 列 2 本と索引・FK のみで、既存列の変更・削除は一切行わない。
-- 既存 migration（20260828000000 / 20260828120000 / 20260901000000）は編集していない。

-- AlterTable ------------------------------------------------------------------
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "tossUpSalespersonId"  TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "closingSalespersonId" TEXT;

-- Index -----------------------------------------------------------------------
-- スタッフ詳細の担当実績集計（担当件数）で使う。
CREATE INDEX IF NOT EXISTS "Customer_tossUpSalespersonId_idx"
  ON "Customer" ("tossUpSalespersonId");
CREATE INDEX IF NOT EXISTS "Customer_closingSalespersonId_idx"
  ON "Customer" ("closingSalespersonId");

-- AddForeignKey ---------------------------------------------------------------
-- スタッフが消えても顧客行は残し、担当リンクだけ外す。
DO $$ BEGIN
  ALTER TABLE "Customer"
    ADD CONSTRAINT "Customer_tossUpSalespersonId_fkey"
    FOREIGN KEY ("tossUpSalespersonId") REFERENCES "Salesperson" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Customer"
    ADD CONSTRAINT "Customer_closingSalespersonId_fkey"
    FOREIGN KEY ("closingSalespersonId") REFERENCES "Salesperson" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
