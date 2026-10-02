-- BizOrch 利用料の決済に使う Stripe Customer をテナントへ紐づける。additive のみ。
--
-- 保持するのは Stripe の Customer ID だけ。カード番号・brand・last4 は保存せず、
-- 表示のたびに Stripe から取得する（docs/03 §4.3 と同じ「持たない」方針）。
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

-- 1 テナントに複数の Customer が紐づかないよう DB 側でも防ぐ。
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_stripeCustomerId_key"
  ON "Tenant"("stripeCustomerId");
