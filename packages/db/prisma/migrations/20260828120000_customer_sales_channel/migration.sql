-- 販売チャネル（案件の獲得経路）— Customer.salesChannel。
--
-- 既存の AcquisitionChannel（EVENT/WALK_IN/TELE/REFERRAL/OTHER）とは意味が異なるため
-- 流用せず専用 enum として分離する:
--   WALK_IN「飛び込み」≠ 訪問販売 / TELE「テレアポ」≠ 反響（インバウンド）
-- 既存 enum のラベルを付け替えると既存画面全体の意味が変わってしまうため。
--
-- 追加 enum + 追加列（NULL 可）のみで、既存列の変更・削除は行わない。
-- 20260828000000_salesperson_and_event_basics は変更していない（新規 migration として追加）。

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SalesChannel" AS ENUM ('VISIT_SALES', 'INBOUND', 'EVENT', 'REFERRAL', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterTable — 未設定は NULL。イベント経由で作成した顧客には EVENT を設定する。
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "salesChannel" "SalesChannel";
