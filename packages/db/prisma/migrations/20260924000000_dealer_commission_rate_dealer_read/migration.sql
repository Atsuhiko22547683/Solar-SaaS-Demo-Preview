-- 二次店が「自社に適用されている手数料率」を読めるようにする（二次店ポータルの手数料管理）。
--
-- 背景:
--   DealerCommissionRate_isolation は wholesalerId だけで絞っている（作成時は
--   代理店の設定画面からしか触らない前提だった）。二次店セッションでは
--   app.current_wholesaler_id が空のことがあり、自社の行も 1 件も見えない。
--
-- 方針:
--   既存ポリシー（FOR ALL）は一切変えず、SELECT 専用のポリシーを 1 本足す。
--   PERMISSIVE ポリシーは OR で合成されるので、代理店側の挙動は変わらない。
--   FOR SELECT にすることで、二次店からの UPDATE / DELETE は許可されない
--   （率を決めるのは代理店の業務。二次店側に write 権限はアプリ層にも無い）。
--
-- ロールバック:
--   DROP POLICY IF EXISTS "DealerCommissionRate_dealer_read" ON "DealerCommissionRate";

DROP POLICY IF EXISTS "DealerCommissionRate_dealer_read" ON "DealerCommissionRate";
CREATE POLICY "DealerCommissionRate_dealer_read" ON "DealerCommissionRate"
  AS PERMISSIVE
  FOR SELECT
  TO PUBLIC
  USING (
    "relationshipId" = ANY (
      string_to_array(
        COALESCE(current_setting('app.current_relationship_ids', true), ''),
        ','
      )
    )
  );
