-- 顧客詳細「売電状況」タブ（設置申請タブとコールタブの間）。
-- 顧客ごとの現在値 1 セットのみを持ち、履歴テーブルは作らない。
--
-- 注: Construction."powerSaleStartDate" は施工 1 件ごとの売電開始日で別概念。
-- こちらは顧客単位の現況で、契約・施工がまだ無い段階でも記録できる。
-- 申請 ID などの補足情報は独立列を作らず "powerSaleNote" へ自由記述する運用。
--
-- 追加列のみ・いずれも NULL 可で、既存行・既存機能に影響しない（§17.10 と同方針）。

-- AlterTable — 売電開始日（日付のみ運用・未設定可）
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "powerSaleStartDate" TIMESTAMP(3);

-- AlterTable — 売電備考（複数行・改行保持・未設定可）
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "powerSaleNote" TEXT;
