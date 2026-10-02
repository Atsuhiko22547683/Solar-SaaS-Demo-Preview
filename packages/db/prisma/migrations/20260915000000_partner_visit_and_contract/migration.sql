-- 二次店ポータル（Partner）向けの additive マイグレーション（第 2 弾）。
--
-- 内容:
--   1. VenueChain に 'CAINZ' を追加（既存値の統合・置換・データ更新は一切しない）
--   2. PartnerAppointmentKind enum の新設
--   3. Appointment.partnerKind 列の追加（nullable）
--   4. DealerVisitAppointment  — 訪問アポフォームの新規テーブル
--   5. DealerContractReport    — 成約フォームの新規テーブル
--   6. 新規 2 テーブル用の RLS ポリシー（新規のみ。既存ポリシーには触れない）
--
-- 既存テーブルの列削除・名称変更・型変更・既存データ更新は一切行わない。
--
-- ロールバック手順（本番未適用。ローカルで戻す場合）:
--   DROP TABLE IF EXISTS "DealerContractReport";
--   DROP TABLE IF EXISTS "DealerVisitAppointment";
--   DROP TYPE  IF EXISTS "DealerContractChannel";
--   DROP TYPE  IF EXISTS "DealerContractAffiliation";
--   ALTER TABLE "Appointment" DROP COLUMN IF EXISTS "partnerKind";
--   DROP TYPE  IF EXISTS "PartnerAppointmentKind";
--   -- VenueChain の 'CAINZ' は PostgreSQL では単独削除できない。値を戻す必要が
--   -- 生じた場合は enum の作り直しが必要になるため、意図的に追加のみとしている。

-- ---------------------------------------------------------------------------
-- 1. VenueChain += CAINZ
-- ---------------------------------------------------------------------------
-- 初訪アポフォームの「催事種別」は カインズ / 島忠 / コメリ の 3 択で、
-- W / V の区別を持たない。既存の CAINZ_W / CAINZ_V は催事日報（ES_日報）が
-- 使い続けるため、統合せずに粒度の粗い値を 1 つ追加する。
ALTER TYPE "VenueChain" ADD VALUE IF NOT EXISTS 'CAINZ';

-- ---------------------------------------------------------------------------
-- 2. PartnerAppointmentKind
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PartnerAppointmentKind') THEN
    CREATE TYPE "PartnerAppointmentKind" AS ENUM ('FIRST_VISIT', 'VISIT');
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 3. Appointment.partnerKind
-- ---------------------------------------------------------------------------
-- 既存 Appointment.appointmentType（「初回訪問」「現地調査同行」等の自由記述で
-- アポイントの内容・段階を表す代理店側の項目）とは別概念なので流用しない。
-- 代理店が直接登録した既存行は null のまま（必須化はアプリ層の二次店ポータルのみ）。
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "partnerKind" "PartnerAppointmentKind";

-- ---------------------------------------------------------------------------
-- 4. DealerVisitAppointment（訪問アポ）
-- ---------------------------------------------------------------------------
-- Google フォーム「②訪問アポフォーム」の 5 項目だけを持つ。顧客情報も訪問日時も
-- 無いフォームなので、customerId / scheduledAt が NOT NULL の既存 Appointment には
-- 相乗りさせない（ダミー顧客・架空日時を作らないため）。
CREATE TABLE IF NOT EXISTS "DealerVisitAppointment" (
    "id"              TEXT NOT NULL,
    "wholesalerId"    TEXT NOT NULL,
    "relationshipId"  TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,

    "tossDept"        TEXT NOT NULL,
    "maekakuOperator" TEXT NOT NULL,
    "closeDept"       TEXT NOT NULL,
    "salespersonId"   TEXT NOT NULL,
    "salesChannel"    "SalesChannel" NOT NULL,

    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealerVisitAppointment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DealerVisitAppointment_wholesalerId_createdAt_idx"
  ON "DealerVisitAppointment"("wholesalerId", "createdAt");
CREATE INDEX IF NOT EXISTS "DealerVisitAppointment_relationshipId_createdAt_idx"
  ON "DealerVisitAppointment"("relationshipId", "createdAt");
CREATE INDEX IF NOT EXISTS "DealerVisitAppointment_salespersonId_idx"
  ON "DealerVisitAppointment"("salespersonId");

-- 複合外部キー。relationshipId 単独ではなく (relationshipId, wholesalerId) で参照し、
-- 「自社の relationship なのに wholesalerId は別代理店」という不整合を DB で塞ぐ。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'DealerVisitAppointment_relationshipId_wholesalerId_fkey'
  ) THEN
    ALTER TABLE "DealerVisitAppointment"
      ADD CONSTRAINT "DealerVisitAppointment_relationshipId_wholesalerId_fkey"
      FOREIGN KEY ("relationshipId", "wholesalerId")
      REFERENCES "Relationship"("id", "wholesalerId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DealerVisitAppointment_salespersonId_fkey'
  ) THEN
    ALTER TABLE "DealerVisitAppointment"
      ADD CONSTRAINT "DealerVisitAppointment_salespersonId_fkey"
      FOREIGN KEY ("salespersonId") REFERENCES "Salesperson"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 5. DealerContractReport（成約）
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DealerContractAffiliation') THEN
    CREATE TYPE "DealerContractAffiliation" AS ENUM ('VE', 'PS');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DealerContractChannel') THEN
    CREATE TYPE "DealerContractChannel" AS ENUM
      ('VISIT_SALES', 'TELE_APPOINTMENT', 'REFERRAL', 'EVENT', 'INBOUND');
  END IF;
END
$$;

-- 既存 Contract（dealId @unique / customerId / contractAmount / cancelDeadline が必須で、
-- 粗利・インセンティブ計算の起点）には相乗りさせない。成約フォームにはそれらの項目が
-- 無く、埋めるにはダミー値の生成が必要になるため。
CREATE TABLE IF NOT EXISTS "DealerContractReport" (
    "id"                 TEXT NOT NULL,
    "wholesalerId"       TEXT NOT NULL,
    "relationshipId"     TEXT NOT NULL,
    "createdByUserId"    TEXT NOT NULL,

    "contractDate"       TIMESTAMP(3) NOT NULL,
    "tossDate"           TIMESTAMP(3) NOT NULL,
    "tossDept"           TEXT NOT NULL,
    "apptGetter"         TEXT NOT NULL,
    "salesRep"           TEXT NOT NULL,
    "referralBranch"     TEXT NOT NULL,
    "affiliation"        "DealerContractAffiliation" NOT NULL,
    "affiliationDept"    TEXT NOT NULL,
    "acquisitionChannel" "DealerContractChannel" NOT NULL,

    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealerContractReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DealerContractReport_wholesalerId_contractDate_idx"
  ON "DealerContractReport"("wholesalerId", "contractDate");
CREATE INDEX IF NOT EXISTS "DealerContractReport_relationshipId_contractDate_idx"
  ON "DealerContractReport"("relationshipId", "contractDate");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'DealerContractReport_relationshipId_wholesalerId_fkey'
  ) THEN
    ALTER TABLE "DealerContractReport"
      ADD CONSTRAINT "DealerContractReport_relationshipId_wholesalerId_fkey"
      FOREIGN KEY ("relationshipId", "wholesalerId")
      REFERENCES "Relationship"("id", "wholesalerId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 6. RLS（新規 2 テーブルにのみ追加。既存ポリシーは DROP も置換もしない）
-- ---------------------------------------------------------------------------
-- 分岐は既存 "DealerEventReport_isolation" と同一の 3 通り:
--   a. SaaS 運営者      … 全件（既存ポリシーと同じ扱い）
--   b. 代理店（卸業者）  … 自社に紐づく Relationship の行だけ
--   c. 二次店            … 自社の relationshipId の行だけ
-- b は app.current_dealer_id が空のとき（＝卸業者セッション）にのみ成立させ、
-- 二次店セッションが卸業者経路で他店の行を読むことを防ぐ。
ALTER TABLE "DealerVisitAppointment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DealerVisitAppointment" FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DealerVisitAppointment_isolation" ON "DealerVisitAppointment";
CREATE POLICY "DealerVisitAppointment_isolation" ON "DealerVisitAppointment"
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING (
    current_setting('app.is_saas_admin', true)::text = 'true'
    OR (
      COALESCE(current_setting('app.current_dealer_id', true), '') = ''
      AND EXISTS (
        SELECT 1 FROM "Relationship" r
        WHERE r."id" = "DealerVisitAppointment"."relationshipId"
          AND r."wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
      )
    )
    OR "relationshipId" = ANY (
      string_to_array(
        COALESCE(current_setting('app.current_relationship_ids', true), ''),
        ','
      )
    )
  )
  WITH CHECK (
    current_setting('app.is_saas_admin', true)::text = 'true'
    OR (
      COALESCE(current_setting('app.current_dealer_id', true), '') = ''
      AND EXISTS (
        SELECT 1 FROM "Relationship" r
        WHERE r."id" = "DealerVisitAppointment"."relationshipId"
          AND r."wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
      )
    )
    OR "relationshipId" = ANY (
      string_to_array(
        COALESCE(current_setting('app.current_relationship_ids', true), ''),
        ','
      )
    )
  );

ALTER TABLE "DealerContractReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DealerContractReport" FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DealerContractReport_isolation" ON "DealerContractReport";
CREATE POLICY "DealerContractReport_isolation" ON "DealerContractReport"
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING (
    current_setting('app.is_saas_admin', true)::text = 'true'
    OR (
      COALESCE(current_setting('app.current_dealer_id', true), '') = ''
      AND EXISTS (
        SELECT 1 FROM "Relationship" r
        WHERE r."id" = "DealerContractReport"."relationshipId"
          AND r."wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
      )
    )
    OR "relationshipId" = ANY (
      string_to_array(
        COALESCE(current_setting('app.current_relationship_ids', true), ''),
        ','
      )
    )
  )
  WITH CHECK (
    current_setting('app.is_saas_admin', true)::text = 'true'
    OR (
      COALESCE(current_setting('app.current_dealer_id', true), '') = ''
      AND EXISTS (
        SELECT 1 FROM "Relationship" r
        WHERE r."id" = "DealerContractReport"."relationshipId"
          AND r."wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
      )
    )
    OR "relationshipId" = ANY (
      string_to_array(
        COALESCE(current_setting('app.current_relationship_ids', true), ''),
        ','
      )
    )
  );
