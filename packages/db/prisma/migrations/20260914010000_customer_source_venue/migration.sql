-- 二次店ポータルのアポイント登録で、催事が事前登録されていない場合の
-- 催事情報を保持する列を Customer へ追加する（Google フォーム「初訪アポフォーム」準拠）。
--
-- 既存 sourceEventId（イベントへの紐付け）の代替値。イベントを選んだ場合は
-- EventCandidate 側を正とし、これらの列には書き込まない（同じ値を二重に持たない）。
--
-- sourceEventDate は日付のみの用途。既存 EventCandidate.scheduledDate と同じく
-- UTC 0 時で保存する運用にし、表示・フォーム往復も UTC 基準で行う。
--
-- 追加はすべて nullable。既存カラムの変更・削除、既存データの更新は行わない。
--
-- ロールバック:
--   ALTER TABLE "Customer" DROP COLUMN IF EXISTS "sourceBoothAreaNote";
--   ALTER TABLE "Customer" DROP COLUMN IF EXISTS "sourceBoothArea";
--   ALTER TABLE "Customer" DROP COLUMN IF EXISTS "sourceVenueChain";
--   ALTER TABLE "Customer" DROP COLUMN IF EXISTS "sourceVenuePlace";
--   ALTER TABLE "Customer" DROP COLUMN IF EXISTS "sourceEventDate";
--   （列を落とすだけで、既存の行・列・制約・RLS には影響しない）

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "sourceEventDate"     TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "sourceVenuePlace"    TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "sourceVenueChain"    "VenueChain";
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "sourceBoothArea"     "BoothArea";
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "sourceBoothAreaNote" TEXT;
