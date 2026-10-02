-- 製品カタログ（/product-catalog）の 6 カテゴリ対応。すべて additive。
--
-- 既存の ProductCategory 値は一切変更・削除しない。PV は既存の PANEL、
-- BT は既存の BATTERY、その他は既存の OTHER_PART をそのまま使い、
-- 語彙が無い 3 カテゴリだけ値を追加する。
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'ECO_CUTE';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'IH';
ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'GIFT';

-- BT の機能区分（単機能 / 特定負荷 / 全負荷）。
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BatteryFunctionType') THEN
    CREATE TYPE "BatteryFunctionType" AS ENUM ('SINGLE', 'SPECIFIC_LOAD', 'FULL_LOAD');
  END IF;
END
$$;

-- 追加列はすべて NULL 許容。既存行は変更しない。
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "series" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "batteryFunctionType" "BatteryFunctionType";
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "warrantyYears" INTEGER;
