-- パートナー業務の一気通貫化に伴う構造変更。
--
-- 1. 催事の開催日を行として持つ（EventDay）。複数日催事の日別開催時間を扱えるようにし、
--    「月間の希望枠 = 1 件の連続催事」という扱いを避ける。
-- 2. EventShift の重複防止を、開始時刻の UNIQUE から予定時間帯の EXCLUDE 制約へ置き換える。
--    旧制約は「開始時刻がずれた重複」を通し、複数管理者の同時操作を止められなかった。
-- 3. 出店希望にレーン番号・個別条件・提出状態を足し、代理店からの回答スレッドを追加する。
--    明細は再提出で入れ替わるが、回答は別テーブルなので失われない。
-- 4. 場所確保の相談（VenueConsultation）を追加する。汎用チャットではなく相談単位のスレッド。
-- 5. Salesperson にゲストスタッフ区分を足す。
--
-- 既存データ: 破壊的変更なし。EventDay は既存 Event の EventCandidate.scheduledDate から
-- 1 日分を backfill し、既存 EventShift をその日へ紐づける（開催時間は元データに無いので NULL）。
--
-- ロールバック: EXCLUDE 制約と新テーブルを DROP し、重複行が無いことを確認してから
-- EventShift_userId_startPlanned_key を再作成する。
--
-- RLS ポリシーの拡張（パートナー会社の複数代理店対応）は次のマイグレーションで行う。

-- ---------------------------------------------------------------------------
-- 0. 拡張（EXCLUDE 制約で text の等価と範囲の重複を 1 つの GiST 索引に入れるため）
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- 1. 列挙
-- ---------------------------------------------------------------------------
ALTER TYPE "ShiftRole" ADD VALUE IF NOT EXISTS 'TOSS';

DO $$ BEGIN
  CREATE TYPE "LanePreferenceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ANSWERED', 'CONFIRMED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PartnerThreadSide" AS ENUM ('DEALER', 'WHOLESALER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PartnerThreadEntryKind" AS ENUM ('MESSAGE', 'SUBMISSION', 'ANSWER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "VenueConsultationStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2. EventDay（催事の開催日）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "EventDay" (
  "id"        TEXT NOT NULL,
  "eventId"   TEXT NOT NULL,
  "eventDate" TIMESTAMP(3) NOT NULL,
  "startAt"   TIMESTAMP(3),
  "endAt"     TIMESTAMP(3),
  "note"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventDay_eventId_eventDate_key" ON "EventDay" ("eventId", "eventDate");
CREATE INDEX IF NOT EXISTS "EventDay_eventDate_idx" ON "EventDay" ("eventDate");

DO $$ BEGIN
  ALTER TABLE "EventDay" ADD CONSTRAINT "EventDay_eventId_fkey" FOREIGN KEY ("eventId")
    REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "EventDay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventDay" FORCE ROW LEVEL SECURITY;

-- 親 Event の閲覧範囲に従う（EventShift / EventChange と同じ形）。
DROP POLICY IF EXISTS "EventDay_isolation" ON "EventDay";
CREATE POLICY "EventDay_isolation" ON "EventDay"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM "Event" e
      WHERE e."id" = "EventDay"."eventId"
        AND (
          e."wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
          OR current_setting('app.is_saas_admin', true)::text = 'true'
          OR EXISTS (
            SELECT 1 FROM "EventDealer" ed
            WHERE ed."eventId" = e."id"
              AND ed."relationshipId" = ANY (
                string_to_array(COALESCE(current_setting('app.current_relationship_ids', true), ''), ',')
              )
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Event" e
      WHERE e."id" = "EventDay"."eventId"
        AND (
          e."wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
          OR current_setting('app.is_saas_admin', true)::text = 'true'
          OR EXISTS (
            SELECT 1 FROM "EventDealer" ed
            WHERE ed."eventId" = e."id"
              AND ed."relationshipId" = ANY (
                string_to_array(COALESCE(current_setting('app.current_relationship_ids', true), ''), ',')
              )
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 3. EventShift — 開催日への紐付けと区間重複の DB 制約
-- ---------------------------------------------------------------------------
ALTER TABLE "EventShift" ADD COLUMN IF NOT EXISTS "eventDayId" TEXT;

CREATE INDEX IF NOT EXISTS "EventShift_eventDayId_idx" ON "EventShift" ("eventDayId");

DO $$ BEGIN
  ALTER TABLE "EventShift" ADD CONSTRAINT "EventShift_eventDayId_fkey" FOREIGN KEY ("eventDayId")
    REFERENCES "EventDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 旧ガード（開始時刻の UNIQUE）を外し、予定時間帯の重複そのものを禁止する。
-- 半開区間 [) なので「前の催事が 18:00 終了・次が 18:00 開始」は重複扱いにしない。
-- 依頼元代理店をまたいだ重複もここで止まる（EventShift は代理店で分割されていないため）。
-- EXCLUDE 制約は RLS より下で効くので、別代理店の催事にいるスタッフの重複も成立しない。
DROP INDEX IF EXISTS "EventShift_userId_startPlanned_key";

DO $$ BEGIN
  ALTER TABLE "EventShift" ADD CONSTRAINT "EventShift_user_no_overlap"
    EXCLUDE USING gist ("userId" WITH =, tsrange("startPlanned", "endPlanned", '[)') WITH &&);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 4. 既存 Event の開催日を backfill し、既存シフトを紐づける
-- ---------------------------------------------------------------------------
INSERT INTO "EventDay" ("id", "eventId", "eventDate", "createdAt", "updatedAt")
SELECT 'evd_bf_' || e."id", e."id", date_trunc('day', ec."scheduledDate"),
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Event" e
JOIN "EventCandidate" ec ON ec."id" = e."eventCandidateId"
WHERE NOT EXISTS (SELECT 1 FROM "EventDay" d WHERE d."eventId" = e."id");

UPDATE "EventShift" s SET "eventDayId" = d."id"
FROM "EventDay" d
WHERE d."eventId" = s."eventId" AND s."eventDayId" IS NULL
  AND date_trunc('day', s."startPlanned") = d."eventDate";

-- ---------------------------------------------------------------------------
-- 5. 出店希望（レーン番号 / 個別条件 / 提出状態 / 回答スレッド）
-- ---------------------------------------------------------------------------
ALTER TABLE "LanePreference"
  ADD COLUMN IF NOT EXISTS "status" "LanePreferenceStatus" NOT NULL DEFAULT 'SUBMITTED',
  ADD COLUMN IF NOT EXISTS "laneCount" INTEGER;

ALTER TABLE "LanePreferenceItem"
  ADD COLUMN IF NOT EXISTS "laneNo" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "conditionNote" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "LanePreferenceItem_lanePreferenceId_laneNo_priority_key"
  ON "LanePreferenceItem" ("lanePreferenceId", "laneNo", "priority");
CREATE INDEX IF NOT EXISTS "LanePreferenceItem_lanePreferenceId_laneNo_priority_idx"
  ON "LanePreferenceItem" ("lanePreferenceId", "laneNo", "priority");

CREATE TABLE IF NOT EXISTS "LanePreferenceMessage" (
  "id"               TEXT NOT NULL,
  "lanePreferenceId" TEXT NOT NULL,
  "side"             "PartnerThreadSide" NOT NULL,
  "kind"             "PartnerThreadEntryKind" NOT NULL DEFAULT 'MESSAGE',
  "body"             TEXT NOT NULL,
  "authorUserId"     TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LanePreferenceMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LanePreferenceMessage_lanePreferenceId_createdAt_idx"
  ON "LanePreferenceMessage" ("lanePreferenceId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "LanePreferenceMessage" ADD CONSTRAINT "LanePreferenceMessage_lanePreferenceId_fkey"
    FOREIGN KEY ("lanePreferenceId") REFERENCES "LanePreference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "LanePreferenceMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LanePreferenceMessage" FORCE ROW LEVEL SECURITY;

-- 親 LanePreference と同じ三分岐（LanePreferenceItem と同じ形）。
DROP POLICY IF EXISTS "LanePreferenceMessage_isolation" ON "LanePreferenceMessage";
CREATE POLICY "LanePreferenceMessage_isolation" ON "LanePreferenceMessage"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM "LanePreference" lp
      WHERE lp."id" = "LanePreferenceMessage"."lanePreferenceId"
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
            string_to_array(COALESCE(current_setting('app.current_relationship_ids', true), ''), ',')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "LanePreference" lp
      WHERE lp."id" = "LanePreferenceMessage"."lanePreferenceId"
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
            string_to_array(COALESCE(current_setting('app.current_relationship_ids', true), ''), ',')
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 6. 場所確保の相談
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "VenueConsultation" (
  "id"              TEXT NOT NULL,
  "wholesalerId"    TEXT NOT NULL,
  "relationshipId"  TEXT NOT NULL,
  "targetMonth"     TEXT,
  "area"            TEXT,
  "title"           TEXT NOT NULL,
  "body"            TEXT NOT NULL,
  "status"          "VenueConsultationStatus" NOT NULL DEFAULT 'OPEN',
  "createdByUserId" TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VenueConsultation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VenueConsultation_relationshipId_createdAt_idx"
  ON "VenueConsultation" ("relationshipId", "createdAt");
CREATE INDEX IF NOT EXISTS "VenueConsultation_wholesalerId_status_idx"
  ON "VenueConsultation" ("wholesalerId", "status");

DO $$ BEGIN
  ALTER TABLE "VenueConsultation" ADD CONSTRAINT "VenueConsultation_relationshipId_fkey"
    FOREIGN KEY ("relationshipId") REFERENCES "Relationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "VenueConsultation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VenueConsultation" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "VenueConsultation_isolation" ON "VenueConsultation";
CREATE POLICY "VenueConsultation_isolation" ON "VenueConsultation"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    current_setting('app.is_saas_admin', true)::text = 'true'
    OR (
      COALESCE(current_setting('app.current_dealer_id', true), '') = ''
      AND EXISTS (
        SELECT 1 FROM "Relationship" r
        WHERE r."id" = "VenueConsultation"."relationshipId"
          AND r."wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
      )
    )
    OR "relationshipId" = ANY (
      string_to_array(COALESCE(current_setting('app.current_relationship_ids', true), ''), ',')
    )
  )
  WITH CHECK (
    current_setting('app.is_saas_admin', true)::text = 'true'
    OR (
      COALESCE(current_setting('app.current_dealer_id', true), '') = ''
      AND EXISTS (
        SELECT 1 FROM "Relationship" r
        WHERE r."id" = "VenueConsultation"."relationshipId"
          AND r."wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
      )
    )
    OR "relationshipId" = ANY (
      string_to_array(COALESCE(current_setting('app.current_relationship_ids', true), ''), ',')
    )
  );

CREATE TABLE IF NOT EXISTS "VenueConsultationMessage" (
  "id"                  TEXT NOT NULL,
  "venueConsultationId" TEXT NOT NULL,
  "side"                "PartnerThreadSide" NOT NULL,
  "kind"                "PartnerThreadEntryKind" NOT NULL DEFAULT 'MESSAGE',
  "body"                TEXT NOT NULL,
  "authorUserId"        TEXT NOT NULL,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VenueConsultationMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VenueConsultationMessage_venueConsultationId_createdAt_idx"
  ON "VenueConsultationMessage" ("venueConsultationId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "VenueConsultationMessage" ADD CONSTRAINT "VenueConsultationMessage_venueConsultationId_fkey"
    FOREIGN KEY ("venueConsultationId") REFERENCES "VenueConsultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "VenueConsultationMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VenueConsultationMessage" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "VenueConsultationMessage_isolation" ON "VenueConsultationMessage";
CREATE POLICY "VenueConsultationMessage_isolation" ON "VenueConsultationMessage"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM "VenueConsultation" vc
      WHERE vc."id" = "VenueConsultationMessage"."venueConsultationId"
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "VenueConsultation" vc
      WHERE vc."id" = "VenueConsultationMessage"."venueConsultationId"
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Salesperson — ゲストスタッフ区分
-- ---------------------------------------------------------------------------
ALTER TABLE "Salesperson" ADD COLUMN IF NOT EXISTS "isGuest" BOOLEAN NOT NULL DEFAULT false;
