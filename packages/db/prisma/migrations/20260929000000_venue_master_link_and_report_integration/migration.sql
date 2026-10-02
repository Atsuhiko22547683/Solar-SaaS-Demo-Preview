-- 代理店-01 / 02 / 03 の構造整理。
--
--  02  店舗マスタに所在地と開催エリアを持たせ、イベント候補から店舗マスタを参照する。
--      既存の storeName / address / area は「開催当時の記録」として残す（上書きしない）。
--  03  出店希望の明細と、採用して確定したイベントの対応を中間テーブルで持つ。
--  01  パートナー会社の報告（催事日報 / 訪問アポ / 成約）を、共通の催事・顧客・商談・
--      契約へ関連付ける。すべて NULL 許容で、紐付け不能な既存行は「未紐付け」のまま残す。
--
-- 既存行の破棄・ダミー値での穴埋めはしない。追加列はすべて NULL 許容か既定値付き。

-- ---------------------------------------------------------------------------
-- 02-1. 店舗マスタ: 所在地 + 開催エリア
-- ---------------------------------------------------------------------------
ALTER TABLE "Store"
  ADD COLUMN IF NOT EXISTS "postalCode" TEXT,
  ADD COLUMN IF NOT EXISTS "address"    TEXT,
  ADD COLUMN IF NOT EXISTS "areaId"     TEXT;

DO $$ BEGIN
  ALTER TABLE "Store" ADD CONSTRAINT "Store_areaId_fkey"
    FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Store_areaId_idx" ON "Store" ("areaId");

-- ---------------------------------------------------------------------------
-- 02-2. イベント候補 → 店舗マスタ参照
-- ---------------------------------------------------------------------------
ALTER TABLE "EventCandidate"
  ADD COLUMN IF NOT EXISTS "storeId" TEXT;

DO $$ BEGIN
  ALTER TABLE "EventCandidate" ADD CONSTRAINT "EventCandidate_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "EventCandidate_storeId_idx" ON "EventCandidate" ("storeId");

-- 既存候補のうち、店舗名が店舗マスタと「完全一致」し、かつ同一卸業者で
-- 候補が 1 件に絞れるものだけ紐付ける。推測での統合はしない
-- （接頭辞つきの表示名や別表記は未紐付けのまま残す）。
UPDATE "EventCandidate" ec
SET "storeId" = s."id"
FROM "Store" s
WHERE ec."storeId" IS NULL
  AND s."wholesalerId" = ec."wholesalerId"
  AND btrim(s."name") = btrim(ec."storeName")
  AND (
    SELECT count(*) FROM "Store" s2
    WHERE s2."wholesalerId" = ec."wholesalerId" AND btrim(s2."name") = btrim(ec."storeName")
  ) = 1;

-- ---------------------------------------------------------------------------
-- 03. 出店希望の採用 → 確定イベント
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "LanePreferenceAdoption" (
  "id"                   TEXT NOT NULL,
  "wholesalerId"         TEXT NOT NULL,
  "lanePreferenceItemId" TEXT NOT NULL,
  "eventId"              TEXT NOT NULL,
  "decidedBy"            TEXT NOT NULL,
  "decidedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note"                 TEXT,
  CONSTRAINT "LanePreferenceAdoption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LanePreferenceAdoption_item_event_key"
  ON "LanePreferenceAdoption" ("lanePreferenceItemId", "eventId");
CREATE INDEX IF NOT EXISTS "LanePreferenceAdoption_eventId_idx"
  ON "LanePreferenceAdoption" ("eventId");
CREATE INDEX IF NOT EXISTS "LanePreferenceAdoption_wholesalerId_idx"
  ON "LanePreferenceAdoption" ("wholesalerId");

DO $$ BEGIN
  ALTER TABLE "LanePreferenceAdoption" ADD CONSTRAINT "LanePreferenceAdoption_item_fkey"
    FOREIGN KEY ("lanePreferenceItemId") REFERENCES "LanePreferenceItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LanePreferenceAdoption" ADD CONSTRAINT "LanePreferenceAdoption_event_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "LanePreferenceAdoption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LanePreferenceAdoption" FORCE ROW LEVEL SECURITY;

-- 読み取りは親 LanePreference と同じ三分岐（代理店 / 自社の取引関係 / SaaS 運営）。
-- 書き込みは採用を決める代理店だけ（パートナー側の分岐を WITH CHECK から外す）。
DROP POLICY IF EXISTS "LanePreferenceAdoption_isolation" ON "LanePreferenceAdoption";
CREATE POLICY "LanePreferenceAdoption_isolation" ON "LanePreferenceAdoption"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    EXISTS (
      SELECT 1
      FROM "LanePreferenceItem" li
      JOIN "LanePreference" lp ON lp."id" = li."lanePreferenceId"
      WHERE li."id" = "LanePreferenceAdoption"."lanePreferenceItemId"
        AND (
          current_setting('app.is_saas_admin', true)::text = 'true'
          OR (
            COALESCE(current_setting('app.current_dealer_id', true), '') = ''
            AND EXISTS (
              SELECT 1 FROM "Relationship" r
              WHERE r."id" = lp."relationshipId"
                AND r."wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
            )
          )
          OR lp."relationshipId" = ANY (
            string_to_array(
              COALESCE(current_setting('app.current_relationship_ids', true), ''),
              ','
            )
          )
        )
    )
  )
  WITH CHECK (
    current_setting('app.is_saas_admin', true)::text = 'true'
    OR (
      COALESCE(current_setting('app.current_dealer_id', true), '') = ''
      AND "LanePreferenceAdoption"."wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
      AND EXISTS (
        SELECT 1
        FROM "LanePreferenceItem" li
        JOIN "LanePreference" lp ON lp."id" = li."lanePreferenceId"
        JOIN "Relationship" r ON r."id" = lp."relationshipId"
        WHERE li."id" = "LanePreferenceAdoption"."lanePreferenceItemId"
          AND r."wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
      )
      AND EXISTS (
        SELECT 1 FROM "Event" e
        WHERE e."id" = "LanePreferenceAdoption"."eventId"
          AND e."wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 01-1. パートナー催事日報 → 催事 / 開催日、集計単位、訂正チェーン
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "DealerReportScope" AS ENUM ('PERSON', 'COMPANY', 'BOOTH', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "DealerEventReport"
  ADD COLUMN IF NOT EXISTS "eventId"            TEXT,
  ADD COLUMN IF NOT EXISTS "eventDayId"         TEXT,
  ADD COLUMN IF NOT EXISTS "reportScope"        "DealerReportScope" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS "supersedesReportId" TEXT;

DO $$ BEGIN
  ALTER TABLE "DealerEventReport" ADD CONSTRAINT "DealerEventReport_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DealerEventReport" ADD CONSTRAINT "DealerEventReport_eventDayId_fkey"
    FOREIGN KEY ("eventDayId") REFERENCES "EventDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DealerEventReport" ADD CONSTRAINT "DealerEventReport_supersedes_fkey"
    FOREIGN KEY ("supersedesReportId") REFERENCES "DealerEventReport"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "DealerEventReport_supersedesReportId_key"
  ON "DealerEventReport" ("supersedesReportId");
CREATE INDEX IF NOT EXISTS "DealerEventReport_eventId_idx" ON "DealerEventReport" ("eventId");
CREATE INDEX IF NOT EXISTS "DealerEventReport_eventDayId_idx" ON "DealerEventReport" ("eventDayId");

-- ---------------------------------------------------------------------------
-- 01-2. パートナー訪問アポ報告 → 顧客 / アポイント
-- ---------------------------------------------------------------------------
ALTER TABLE "DealerVisitAppointment"
  ADD COLUMN IF NOT EXISTS "customerId"    TEXT,
  ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;

DO $$ BEGIN
  ALTER TABLE "DealerVisitAppointment" ADD CONSTRAINT "DealerVisitAppointment_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DealerVisitAppointment" ADD CONSTRAINT "DealerVisitAppointment_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "DealerVisitAppointment_customerId_idx"
  ON "DealerVisitAppointment" ("customerId");
CREATE INDEX IF NOT EXISTS "DealerVisitAppointment_appointmentId_idx"
  ON "DealerVisitAppointment" ("appointmentId");

-- ---------------------------------------------------------------------------
-- 01-3. パートナー成約報告 → 顧客 / 商談 / 正式契約
-- ---------------------------------------------------------------------------
ALTER TABLE "DealerContractReport"
  ADD COLUMN IF NOT EXISTS "customerId" TEXT,
  ADD COLUMN IF NOT EXISTS "dealId"     TEXT,
  ADD COLUMN IF NOT EXISTS "contractId" TEXT;

DO $$ BEGIN
  ALTER TABLE "DealerContractReport" ADD CONSTRAINT "DealerContractReport_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DealerContractReport" ADD CONSTRAINT "DealerContractReport_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DealerContractReport" ADD CONSTRAINT "DealerContractReport_contractId_fkey"
    FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "DealerContractReport_customerId_idx"
  ON "DealerContractReport" ("customerId");
CREATE INDEX IF NOT EXISTS "DealerContractReport_dealId_idx"
  ON "DealerContractReport" ("dealId");
CREATE INDEX IF NOT EXISTS "DealerContractReport_contractId_idx"
  ON "DealerContractReport" ("contractId");
