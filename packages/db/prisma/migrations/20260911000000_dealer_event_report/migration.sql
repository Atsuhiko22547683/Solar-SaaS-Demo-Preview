-- 二次店ポータル（Partner）向けの additive マイグレーション。
--
-- 内容:
--   1. Customer.maekakuOperator — マエカク実施者（自由記述）の列追加
--   2. DealerEventReport        — 二次店が単独提出する催事日報の新規テーブル
--   3. DealerEventReport 用の RLS ポリシー（新規のみ）
--
-- 既存テーブルの列削除・型変更・既存データ変更は一切行わない。
-- 既存 EventReport / EventReportMetric とその RLS ポリシーには触れない。

-- ---------------------------------------------------------------------------
-- 1. Customer.maekakuOperator
-- ---------------------------------------------------------------------------
-- Google フォーム「初訪アポフォーム」準拠の自由記述。User / Salesperson への
-- 外部キーは張らない（実施者が自社社員か二次店販売員か運用未確定のため）。
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "maekakuOperator" TEXT;

-- ---------------------------------------------------------------------------
-- 2. DealerEventReport
-- ---------------------------------------------------------------------------
-- 合計値（抽選数 / 着座数 / アポ数）は保存しない。両面 + 片面から算出する。
CREATE TABLE IF NOT EXISTS "DealerEventReport" (
    "id"              TEXT NOT NULL,
    "wholesalerId"    TEXT NOT NULL,
    "relationshipId"  TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,

    "eventDate"       TIMESTAMP(3) NOT NULL,
    "venuePlace"      TEXT NOT NULL,
    "category"        "EventProductCategory" NOT NULL,
    "venueChain"      "VenueChain" NOT NULL,
    "areaInFacility"  TEXT NOT NULL,
    "startTime"       TEXT NOT NULL,
    "endTime"         TEXT NOT NULL,

    "lotteryBoth"     INTEGER NOT NULL,
    "lotterySingle"   INTEGER NOT NULL,
    "seatedBoth"      INTEGER NOT NULL,
    "seatedSingle"    INTEGER NOT NULL,
    "apptBoth"        INTEGER NOT NULL,
    "apptSingle"      INTEGER NOT NULL,
    "cainzPayCount"   INTEGER,
    "impression"      TEXT,

    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealerEventReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DealerEventReport_wholesalerId_eventDate_idx"
  ON "DealerEventReport"("wholesalerId", "eventDate");
CREATE INDEX IF NOT EXISTS "DealerEventReport_relationshipId_eventDate_idx"
  ON "DealerEventReport"("relationshipId", "eventDate");

-- 参照整合性。提出元の Relationship（卸業者×二次店）が実在することを DB でも保証する。
-- 二次店マスタの行は業務上削除しない運用なので ON DELETE は既定（RESTRICT）。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DealerEventReport_relationshipId_fkey'
  ) THEN
    ALTER TABLE "DealerEventReport"
      ADD CONSTRAINT "DealerEventReport_relationshipId_fkey"
      FOREIGN KEY ("relationshipId") REFERENCES "Relationship"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 3. RLS（新規テーブルにのみ追加。既存ポリシーは変更しない）
-- ---------------------------------------------------------------------------
-- 分岐は既存 "DealerPreference_isolation" と同じ 3 通り:
--   a. SaaS 運営者      … 全件（既存ポリシーと同じ扱い）
--   b. 代理店（卸業者）  … 自社に紐づく Relationship の日報だけ
--   c. 二次店            … 自社の relationshipId の日報だけ
-- b は app.current_dealer_id が空のとき（＝卸業者セッション）にのみ成立させ、
-- 二次店セッションが卸業者経路で他店の行を読むことを防ぐ。
ALTER TABLE "DealerEventReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DealerEventReport" FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DealerEventReport_isolation" ON "DealerEventReport";
CREATE POLICY "DealerEventReport_isolation" ON "DealerEventReport"
  AS PERMISSIVE
  FOR ALL
  TO PUBLIC
  USING (
    current_setting('app.is_saas_admin', true)::text = 'true'
    OR (
      COALESCE(current_setting('app.current_dealer_id', true), '') = ''
      AND EXISTS (
        SELECT 1 FROM "Relationship" r
        WHERE r."id" = "DealerEventReport"."relationshipId"
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
        WHERE r."id" = "DealerEventReport"."relationshipId"
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
