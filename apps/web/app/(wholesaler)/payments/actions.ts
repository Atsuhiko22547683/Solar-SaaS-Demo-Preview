"use server";

// 決済管理の Server Actions。
//
// Stripe の Secret key を使うのはここと lib/stripe/client.ts だけで、
// クライアントへは一切渡さない。カード番号はこのプロセスを通らない
// — 入力も保持も Stripe のホスト画面（Billing Portal）側で完結させる。
//
// テナントの取り違えを防ぐため、stripeCustomerId はクライアントから受け取らず、
// 必ずセッション由来の tenantId から引く / 作る。

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { invalidateBillingSnapshot } from "@/lib/billing/resolve";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { labels } from "@/lib/i18n/labels";
import { assertCan } from "@/lib/permissions/can";
import { getStripe } from "@/lib/stripe/client";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

const PAYMENTS_PATH = "/payments";

/** 決済操作の共通ガード。決済管理はオーナーのみ（既存の payment capability）。 */
async function requirePaymentContext() {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError({
      code: "INVALID_CREDENTIALS",
      message: "Session missing — sign in is required",
    });
  }
  const ctx = await getTenantContext();
  assertCan({
    user: {
      userId: ctx.actorUserId,
      roles: session.user.roles,
      isSaasAdmin: ctx.isSaasAdmin,
      tenantId: ctx.tenantId,
      wholesalerId: ctx.wholesalerId,
      dealerId: ctx.dealerId,
      relationshipIds: ctx.relationshipIds,
    },
    action: "payment.read",
  });
  if (!ctx.tenantId) throw new ValidationError("tenantId is required for billing");
  return ctx;
}

/**
 * 自テナントの Stripe Customer を用意して ID を返す。
 *
 * 既に紐づいていればそれを再利用する。同時に押されても Customer が増えないよう、
 * 保存は `stripeCustomerId: null` を条件にした updateMany で行い、
 * 先に書き込めた 1 件だけを採用する（負けた側で作った Customer は
 * その場で削除して Sandbox に残骸を残さない）。
 */
async function ensureStripeCustomer(
  ctx: Awaited<ReturnType<typeof requirePaymentContext>>,
): Promise<string> {
  const tenantId = ctx.tenantId!;

  const existing = await withTenant(ctx, (tx) =>
    tx.tenant.findUnique({
      where: { id: tenantId },
      select: { stripeCustomerId: true, name: true },
    }),
  );
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const stripe = getStripe();
  if (!stripe) throw new ValidationError(labels.billing.portal.notConfigured);

  const created = await stripe.customers.create({
    name: existing?.name ?? undefined,
    // 突き合わせ用の識別子だけ。機密情報（PII / 認証情報）は入れない。
    metadata: { bizorchTenantId: tenantId },
  });

  const claimed = await withTenant(ctx, (tx) =>
    tx.tenant.updateMany({
      where: { id: tenantId, stripeCustomerId: null },
      data: { stripeCustomerId: created.id },
    }),
  );

  if (claimed.count === 0) {
    // 競合して他のリクエストが先に紐づけた。作ったばかりの Customer は捨てる。
    await stripe.customers.del(created.id).catch(() => undefined);
    const current = await withTenant(ctx, (tx) =>
      tx.tenant.findUnique({ where: { id: tenantId }, select: { stripeCustomerId: true } }),
    );
    if (!current?.stripeCustomerId) throw new ValidationError(labels.billing.portal.error);
    return current.stripeCustomerId;
  }

  invalidateBillingSnapshot(tenantId);
  return created.id;
}

/**
 * 決済管理ページ（Stripe カスタマーポータル）を開く。
 *
 * カードの登録・変更・請求書の確認は Stripe のホスト画面で行う。BizOrch 側に
 * カード入力フォームを持たない = カード番号がこのアプリを通らない。
 *
 * Customer がまだ無ければ先に作る（「決済情報を登録」からの初回導線）。
 */
export async function openBillingPortalAction(): Promise<void> {
  const ctx = await requirePaymentContext();
  const stripe = getStripe();
  if (!stripe) throw new ValidationError(labels.billing.portal.notConfigured);

  const customerId = await ensureStripeCustomer(ctx);
  invalidateBillingSnapshot(ctx.tenantId!);

  const returnUrl = new URL(
    PAYMENTS_PATH,
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
  ).toString();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  revalidatePath(PAYMENTS_PATH);
  // redirect は例外を投げて制御を返すので、この後に処理を書かない。
  redirect(session.url);
}
