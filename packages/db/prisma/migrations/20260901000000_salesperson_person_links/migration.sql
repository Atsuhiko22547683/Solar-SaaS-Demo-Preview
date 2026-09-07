-- スタッフ（Salesperson）と既存人物・所属会社の任意リンク。
--
-- 目的: 既に登録されている人物（自社ログイン User / 二次店 Relationship）を
--       スタッフとして二重登録しなくて済むようにする。
--
-- 追加するのは nullable な参照列 2 本だけで、既存列の変更・削除は一切行わない:
--   relationshipId … 所属二次店。null なら自社スタッフ（所属の唯一の判定材料）。
--   userId         … 同一人物の自社ログイン User への任意リンク。
--                    卸業者は RLS で二次店の User を参照できないため、
--                    二次店スタッフでは常に null になる。
--
-- 会社名（加盟店名）は文字列で複製せず、常に Relationship → Tenant から導出する。
-- そのため franchiseNo / residentAddress / salesExperience は UI から使わなくなるが、
-- 既存データを壊さないよう DROP COLUMN はしない。
--
-- 既存 migration（20260828000000_salesperson_and_event_basics /
-- 20260828120000_customer_sales_channel）は適用済みのため一切編集していない。

-- AlterTable ------------------------------------------------------------------
ALTER TABLE "Salesperson" ADD COLUMN IF NOT EXISTS "relationshipId" TEXT;
ALTER TABLE "Salesperson" ADD COLUMN IF NOT EXISTS "userId"         TEXT;

-- Index -----------------------------------------------------------------------
-- 1 User につきスタッフ行は最大 1 件（NULL は複数可 = 未リンクを許す）。
CREATE UNIQUE INDEX IF NOT EXISTS "Salesperson_userId_key"
  ON "Salesperson" ("userId");
-- 二次店スタッフタブの絞り込み用。
CREATE INDEX IF NOT EXISTS "Salesperson_wholesalerId_relationshipId_idx"
  ON "Salesperson" ("wholesalerId", "relationshipId");

-- AddForeignKey ---------------------------------------------------------------
-- 参照先が消えたらリンクだけ外す（スタッフ行自体は業務データとして残す）。
DO $$ BEGIN
  ALTER TABLE "Salesperson"
    ADD CONSTRAINT "Salesperson_relationshipId_fkey"
    FOREIGN KEY ("relationshipId") REFERENCES "Relationship" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Salesperson"
    ADD CONSTRAINT "Salesperson_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
