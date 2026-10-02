-- パートナー会社が複数の代理店から依頼を受けられるようにする RLS 拡張。
--
-- 背景:
--   Event / EventCandidate / EventShift / EventSalesperson / EventChange / Salesperson /
--   Customer のポリシーは wholesalerId 一本（または親 Event の wholesalerId）で判定していた。
--   パートナー側セッションは wholesalerId を持たない（AppRole が DEALER のとき
--   session.user.wholesalerId は null）ため、これらのポリシーはパートナー側では常に偽になる。
--   ローカル開発では DB ロールが BYPASSRLS なので表面化していなかったが、
--   RLS が効く環境ではパートナーポータルの一覧が 0 件になる。
--
-- 変更:
--   「自社の取引関係（app.current_relationship_ids）経由」の枝を追加する。
--   代理店側セッションの判定は一切変えない（relationship_ids は空なので新しい枝は成立しない）。
--   これは閲覧範囲の枝であり、操作権限は can.ts と requirePartnerContext が別に判定する。
--
-- 他社データは引き続き見えない: 枝が成立するのは自社が当事者の Relationship に
-- 紐づく行だけで、代理店 A のセッションから代理店 B の案件は見えない。
--
-- ロールバック: 各ポリシーを OR 枝を除いた元の述語で CREATE し直す。

-- ---------------------------------------------------------------------------
-- 1. Event — 自社が担当会社として割り当てられている催事
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Event_isolation" ON "Event";
CREATE POLICY "Event_isolation" ON "Event"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    "wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
    OR current_setting('app.is_saas_admin', true)::text = 'true'
    OR EXISTS (
      SELECT 1 FROM "EventDealer" ed
      WHERE ed."eventId" = "Event"."id"
        AND ed."relationshipId" = ANY (
          string_to_array(COALESCE(current_setting('app.current_relationship_ids', true), ''), ',')
        )
    )
  )
  WITH CHECK (
    "wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
    OR current_setting('app.is_saas_admin', true)::text = 'true'
  );

-- ---------------------------------------------------------------------------
-- 2. EventCandidate — 自社へ公開された候補、または自社担当で確定した催事の候補
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "EventCandidate_isolation" ON "EventCandidate";
CREATE POLICY "EventCandidate_isolation" ON "EventCandidate"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    "wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
    OR current_setting('app.is_saas_admin', true)::text = 'true'
    OR EXISTS (
      SELECT 1 FROM "EventCandidateVisibility" v
      WHERE v."eventCandidateId" = "EventCandidate"."id"
        AND v."isVisible" = true
        AND v."relationshipId" = ANY (
          string_to_array(COALESCE(current_setting('app.current_relationship_ids', true), ''), ',')
        )
    )
    OR EXISTS (
      SELECT 1 FROM "Event" e
      JOIN "EventDealer" ed ON ed."eventId" = e."id"
      WHERE e."eventCandidateId" = "EventCandidate"."id"
        AND ed."relationshipId" = ANY (
          string_to_array(COALESCE(current_setting('app.current_relationship_ids', true), ''), ',')
        )
    )
  )
  WITH CHECK (
    "wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
    OR current_setting('app.is_saas_admin', true)::text = 'true'
  );

-- ---------------------------------------------------------------------------
-- 3. EventShift — 自社担当催事のシフト
--    自社スタッフが別代理店の催事に入っている場合も、その催事は自社担当なので見える。
--    これが「他の依頼元代理店の催事との重複判定」を成り立たせる根拠になる。
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "EventShift_isolation" ON "EventShift";
CREATE POLICY "EventShift_isolation" ON "EventShift"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM "Event" e
      WHERE e."id" = "EventShift"."eventId"
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
      WHERE e."id" = "EventShift"."eventId"
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
-- 4. EventSalesperson — 同じ形
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "EventSalesperson_isolation" ON "EventSalesperson";
CREATE POLICY "EventSalesperson_isolation" ON "EventSalesperson"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM "Event" e
      WHERE e."id" = "EventSalesperson"."eventId"
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
      WHERE e."id" = "EventSalesperson"."eventId"
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
-- 5. EventChange — 閲覧のみ広げる（書き込みは代理店側の操作）
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "EventChange_isolation" ON "EventChange";
CREATE POLICY "EventChange_isolation" ON "EventChange"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM "Event" e
      WHERE e."id" = "EventChange"."eventId"
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
      WHERE e."id" = "EventChange"."eventId"
        AND (
          e."wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
          OR current_setting('app.is_saas_admin', true)::text = 'true'
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Salesperson — 自社（= 自社の取引関係）に所属するスタッフ
--    relationshipId IS NULL は代理店の自社スタッフなので、パートナー側には見せない。
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Salesperson_isolation" ON "Salesperson";
CREATE POLICY "Salesperson_isolation" ON "Salesperson"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    "wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
    OR current_setting('app.is_saas_admin', true)::text = 'true'
    OR "relationshipId" = ANY (
      string_to_array(COALESCE(current_setting('app.current_relationship_ids', true), ''), ',')
    )
  )
  WITH CHECK (
    "wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
    OR current_setting('app.is_saas_admin', true)::text = 'true'
    OR "relationshipId" = ANY (
      string_to_array(COALESCE(current_setting('app.current_relationship_ids', true), ''), ',')
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Customer — 自社が取り扱う顧客（保有 or 登録元が自社の取引関係）
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customer_isolation" ON "Customer";
CREATE POLICY "Customer_isolation" ON "Customer"
  AS PERMISSIVE FOR ALL TO PUBLIC
  USING (
    "wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
    OR current_setting('app.is_saas_admin', true)::text = 'true'
    OR "ownerRelationshipId" = ANY (
      string_to_array(COALESCE(current_setting('app.current_relationship_ids', true), ''), ',')
    )
    OR "registeredByRelationshipId" = ANY (
      string_to_array(COALESCE(current_setting('app.current_relationship_ids', true), ''), ',')
    )
  )
  WITH CHECK (
    "wholesalerId" = current_setting('app.current_wholesaler_id', true)::text
    OR current_setting('app.is_saas_admin', true)::text = 'true'
    OR "ownerRelationshipId" = ANY (
      string_to_array(COALESCE(current_setting('app.current_relationship_ids', true), ''), ',')
    )
    OR "registeredByRelationshipId" = ANY (
      string_to_array(COALESCE(current_setting('app.current_relationship_ids', true), ''), ',')
    )
  );
