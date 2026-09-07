-- 販売員マスタ（イベント管理配下「販売員一覧」）+ イベントへの販売員アサイン
-- + 催事の基本情報（催事種別 / ブース場所 / 商材種別）+ 成果報告の任意集計項目。
--
-- 追加テーブル・追加列・追加 enum のみで、既存列の変更・削除は行わない（§17.10 と同方針）。
-- 適用順序: CREATE TYPE → CREATE TABLE → ALTER TABLE → FK → INDEX → RLS。

-- CreateEnum ---------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "EmploymentType" AS ENUM ('EMPLOYEE', 'CONTRACT', 'PART_TIME', 'SUBCONTRACT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "VenueChain" AS ENUM ('CAINZ_W', 'CAINZ_V', 'SHIMACHU', 'KOMERI', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "BoothArea" AS ENUM ('ENTRANCE', 'REFORM_CORNER', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 太陽光部材の "ProductCategory" とは別概念のため別名にする。
DO $$ BEGIN
  CREATE TYPE "EventProductCategory" AS ENUM ('HOUSING_EQUIPMENT', 'REAL_ESTATE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable — 販売員マスタ -------------------------------------------------
-- 認証 User（自社社員）とは別概念。販売員はログインせず、催事に立つ人員として
-- イベントへアサインされるだけなので専用テーブルにする。
CREATE TABLE IF NOT EXISTS "Salesperson" (
  "id"              TEXT NOT NULL,
  "wholesalerId"    TEXT NOT NULL,
  "franchiseNo"     TEXT,
  "name"            TEXT NOT NULL,
  "kana"            TEXT,
  "gender"          "Gender",
  "birthDate"       TIMESTAMP(3),
  "phone"           TEXT,
  "email"           TEXT,
  "address"         TEXT,
  "residentAddress" TEXT,
  "employmentType"  "EmploymentType",
  "salesExperience" TEXT,
  "note"            TEXT,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Salesperson_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Salesperson_wholesalerId_isActive_idx"
  ON "Salesperson" ("wholesalerId", "isActive");
CREATE INDEX IF NOT EXISTS "Salesperson_wholesalerId_franchiseNo_idx"
  ON "Salesperson" ("wholesalerId", "franchiseNo");

-- CreateTable — イベント × 販売員のアサイン -----------------------------------
-- EventShift は認証 User の勤務シフトで別概念。販売員は専用の中間テーブルで紐づける。
CREATE TABLE IF NOT EXISTS "EventSalesperson" (
  "id"            TEXT NOT NULL,
  "eventId"       TEXT NOT NULL,
  "salespersonId" TEXT NOT NULL,
  "note"          TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventSalesperson_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventSalesperson_eventId_salespersonId_key"
  ON "EventSalesperson" ("eventId", "salespersonId");
CREATE INDEX IF NOT EXISTS "EventSalesperson_salespersonId_idx"
  ON "EventSalesperson" ("salespersonId");

-- CreateTable — 成果報告の任意集計項目 ---------------------------------------
-- 固定項目（声かけ数 / アンケート数 / アポ取得数 …）は EventReport.payload のまま。
-- ここは「カインズPay対応数」のような数え物だけを 1 行 1 項目で持つ。
CREATE TABLE IF NOT EXISTS "EventReportMetric" (
  "id"        TEXT NOT NULL,
  "reportId"  TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "value"     INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventReportMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventReportMetric_reportId_name_key"
  ON "EventReportMetric" ("reportId", "name");
CREATE INDEX IF NOT EXISTS "EventReportMetric_reportId_idx"
  ON "EventReportMetric" ("reportId");

-- AlterTable — 催事の基本情報 -------------------------------------------------
ALTER TABLE "EventCandidate" ADD COLUMN IF NOT EXISTS "venueChain"      "VenueChain";
ALTER TABLE "EventCandidate" ADD COLUMN IF NOT EXISTS "boothArea"       "BoothArea";
ALTER TABLE "EventCandidate" ADD COLUMN IF NOT EXISTS "boothAreaNote"   TEXT;
ALTER TABLE "EventCandidate" ADD COLUMN IF NOT EXISTS "productCategory" "EventProductCategory";

-- AddForeignKey --------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE "EventSalesperson"
    ADD CONSTRAINT "EventSalesperson_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "EventSalesperson"
    ADD CONSTRAINT "EventSalesperson_salespersonId_fkey"
    FOREIGN KEY ("salespersonId") REFERENCES "Salesperson" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "EventReportMetric"
    ADD CONSTRAINT "EventReportMetric_reportId_fkey"
    FOREIGN KEY ("reportId") REFERENCES "EventReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- RLS ------------------------------------------------------------------------
-- Salesperson は wholesalerId を直接持つ（VenueProvider / Installer と同じ形）。
ALTER TABLE "Salesperson"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Salesperson"       FORCE  ROW LEVEL SECURITY;
ALTER TABLE "EventSalesperson"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventSalesperson"  FORCE  ROW LEVEL SECURITY;
ALTER TABLE "EventReportMetric" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventReportMetric" FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Salesperson_isolation" ON "Salesperson";
CREATE POLICY "Salesperson_isolation" ON "Salesperson"
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING (
    "wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
    OR current_setting('app.is_saas_admin', true)::text = 'true'
  )
  WITH CHECK (
    "wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
    OR current_setting('app.is_saas_admin', true)::text = 'true'
  );

-- EventSalesperson は親 Event の wholesalerId 経由で相関 EXISTS 判定する。
DROP POLICY IF EXISTS "EventSalesperson_isolation" ON "EventSalesperson";
CREATE POLICY "EventSalesperson_isolation" ON "EventSalesperson"
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM "Event" e
      WHERE e."id" = "EventSalesperson"."eventId"
        AND (
          e."wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
          OR current_setting('app.is_saas_admin', true)::text = 'true'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Event" e
      WHERE e."id" = "EventSalesperson"."eventId"
        AND (
          e."wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
          OR current_setting('app.is_saas_admin', true)::text = 'true'
        )
    )
  );

-- EventReportMetric は EventReport → Event の wholesalerId 経由。
DROP POLICY IF EXISTS "EventReportMetric_isolation" ON "EventReportMetric";
CREATE POLICY "EventReportMetric_isolation" ON "EventReportMetric"
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM "EventReport" r
      JOIN "Event" e ON e."id" = r."eventId"
      WHERE r."id" = "EventReportMetric"."reportId"
        AND (
          e."wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
          OR current_setting('app.is_saas_admin', true)::text = 'true'
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "EventReport" r
      JOIN "Event" e ON e."id" = r."eventId"
      WHERE r."id" = "EventReportMetric"."reportId"
        AND (
          e."wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
          OR current_setting('app.is_saas_admin', true)::text = 'true'
        )
    )
  );
