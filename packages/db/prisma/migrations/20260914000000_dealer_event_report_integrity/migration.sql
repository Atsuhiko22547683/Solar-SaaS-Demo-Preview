-- DealerEventReport の (relationshipId, wholesalerId) 整合性を DB で保証する。
--
-- 背景:
--   RLS ポリシー "DealerEventReport_isolation" は relationshipId だけを見るため、
--   「自社の relationshipId だが wholesalerId は別の代理店」という行が書き込めてしまう
--   （RLS の直接テストで検出）。代理店側の一覧は Relationship 経由で絞るので行自体は
--   見えるが、wholesalerId をキーにした集計が別代理店の値を拾う状態になる。
--
--   アプリ層（requirePartnerContext）でも組を決めているが、要件どおり
--   「アプリ側の検証だけに依存しない」ため、DB でも拒否する。
--
-- 方法:
--   単一列の外部キーを (relationshipId, wholesalerId) の複合外部キーへ置き換える。
--   参照先を一意にするため Relationship に UNIQUE(id, wholesalerId) を足す。
--   id は既に主キーなので実質的な制約強化は無く、既存行は必ず条件を満たす。
--
-- 影響範囲:
--   - 既存カラムの削除・型変更・既存データの変更なし
--   - 既存 RLS ポリシーの変更なし
--   - 差し替える外部キーは 20260911000000 で本マイグレーション系列が作ったものだけで、
--     既存テーブルの制約には触れない

-- 1. 参照先の一意宣言（既存 PK と重複するため既存行はすべて適合する）。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Relationship_id_wholesalerId_key'
  ) THEN
    ALTER TABLE "Relationship"
      ADD CONSTRAINT "Relationship_id_wholesalerId_key" UNIQUE ("id", "wholesalerId");
  END IF;
END
$$;

-- 2. 単一 FK を外し、複合 FK を張る（対象は本系列が作った DealerEventReport のみ）。
ALTER TABLE "DealerEventReport"
  DROP CONSTRAINT IF EXISTS "DealerEventReport_relationshipId_fkey";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'DealerEventReport_relationshipId_wholesalerId_fkey'
  ) THEN
    ALTER TABLE "DealerEventReport"
      ADD CONSTRAINT "DealerEventReport_relationshipId_wholesalerId_fkey"
      FOREIGN KEY ("relationshipId", "wholesalerId")
      REFERENCES "Relationship"("id", "wholesalerId")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
