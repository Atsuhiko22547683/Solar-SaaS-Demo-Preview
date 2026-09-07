-- 取引先の論理削除用ステータスを追加する。
--
-- ユーザー操作の「取引先を削除」は物理 DELETE ではなく status = 'TERMINATED'
-- への遷移で表現する。Relationship は Customer / Salesperson / Incentive /
-- MonthlyReport 等から参照されており、行を消すと過去データの参照先名称が
-- 失われるため。
--
-- 既存値への影響なし（列挙子の追加のみ・既定値も変更しない）。
ALTER TYPE "RelationshipStatus" ADD VALUE IF NOT EXISTS 'TERMINATED';
