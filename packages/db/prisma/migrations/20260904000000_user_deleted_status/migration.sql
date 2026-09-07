-- システムユーザーの論理削除用ステータスを追加する。
--
-- ユーザー操作の「システムユーザーを削除」は物理 DELETE ではなく
-- status = 'DELETED' への遷移で表現する。User は AuditLog.actorUserId や
-- Customer の担当履歴から参照されており、行を消すと履歴が壊れるため。
--
-- 既存の SUSPENDED は「一時停止（後で戻す）」の意味なので流用しない。
-- 既存値への影響なし（列挙子の追加のみ・既定値も変更しない）。
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'DELETED';
