-- 商談履歴（接点）に「どこで」「誰が直したか」を持たせる。
--
-- 1. CustomerActivity.eventId — 接点を持った催事。店舗名の文字列一致ではなく id で結ぶ。
--    催事外の接点（電話・訪問など）は NULL のまま。
-- 2. CustomerActivity.updatedByUserId — 直近に更新した利用者。引継ぎ・共同対応で
--    「誰が何を直したか」を追えるようにする。createdByUserId（作成者）は書き換えない。
-- 3. ExistingEquipmentCategory に IH / エアコン / 蓄電池 を追加。
--    既存 3 値（GAS_WATER_HEATER / ECO_CUTE / PV）の意味は変えない。
--
-- 既存データ: 追加列はすべて NULL 許容。既存行は変更しない。
-- ロールバック: 追加列を DROP する（列挙の値は削除できないので残す）。

ALTER TABLE "CustomerActivity" ADD COLUMN IF NOT EXISTS "eventId" TEXT;
ALTER TABLE "CustomerActivity" ADD COLUMN IF NOT EXISTS "updatedByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "CustomerActivity_eventId_idx" ON "CustomerActivity" ("eventId");

DO $$ BEGIN
  ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "ExistingEquipmentCategory" ADD VALUE IF NOT EXISTS 'IH';
ALTER TYPE "ExistingEquipmentCategory" ADD VALUE IF NOT EXISTS 'AIR_CONDITIONER';
ALTER TYPE "ExistingEquipmentCategory" ADD VALUE IF NOT EXISTS 'BATTERY';
