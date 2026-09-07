// S-058 — 二次店ダッシュボード (docs/04 §1.5).
//
// 二次店ロール (dealer_admin / dealer_staff) の共通ホーム。
// 卸業者ホームと同じ構成 —— 最上段に要対応キュー、その下に当月実績。
// ロールが変わっても画面の読み方が変わらないよう、同じ部品を使う。

import { withTenant } from "@solar/db";
import Link from "next/link";

import { auth } from "@/auth";
import { Metric, SectionLabel, TodoRow } from "@/components/home/home-sections";
import { Card } from "@/components/ui/card";
import { labels } from "@/lib/i18n/labels";
import { getTenantContext } from "@/lib/tenancy/context";

export const dynamic = "force-dynamic";

async function getDealerDashboardSummary() {
  const ctx = await getTenantContext();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [todayEventCount, monthlyContractCount, pendingPreCallCount] = await Promise.all([
    withTenant(ctx, (tx) =>
      tx.event.count({
        where: {
          eventCandidate: {
            scheduledDate: { gte: todayStart, lt: todayEnd },
          },
          dealers: {
            some: {
              relationshipId: { in: ctx.relationshipIds },
            },
          },
        },
      }),
    ),
    withTenant(ctx, (tx) =>
      tx.contract.count({
        where: {
          contractDate: { gte: monthStart, lt: monthEnd },
          ownerRelationshipId: { in: ctx.relationshipIds },
        },
      }),
    ),
    withTenant(ctx, (tx) =>
      tx.preCallNotification.count({
        where: {
          relationshipId: { in: ctx.relationshipIds },
          status: "SENT",
        },
      }),
    ),
  ]);

  return { todayEventCount, monthlyContractCount, pendingPreCallCount };
}

export default async function DealerDashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const summary = await getDealerDashboardSummary();
  const t = labels.dealerDashboard;
  const s = t.sections;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-ink text-xl font-bold">{t.title}</h1>
        <p className="text-mute-light mt-0.5 text-[13px]">{t.subtitle}</p>
      </div>

      {/* 二次店側で売上を落とす原因はマエカクの取りこぼし。最上段はここだけに使う。 */}
      <section>
        <SectionLabel>{t.todoTitle}</SectionLabel>
        <Card className="p-0" data-section="pending-precall">
          <TodoRow
            title={s.pendingPreCall.title}
            count={summary.pendingPreCallCount}
            unit={s.pendingPreCall.unitSuffix}
            hint={s.pendingPreCall.description}
            clearedHint={t.todoAllClear}
            href="/d-appointments"
            linkLabel={s.pendingPreCall.cta}
          />
        </Card>
      </section>

      <section>
        <SectionLabel>{t.resultTitle}</SectionLabel>
        <Card className="p-0">
          <div className="divide-hairline-light flex flex-col divide-y sm:flex-row sm:divide-y-0">
            <Metric
              label={s.todayEvents.title}
              value={`${summary.todayEventCount}${s.todayEvents.unitSuffix}`}
            />
            <Metric
              label={s.monthlyContracts.title}
              value={`${summary.monthlyContractCount}${s.monthlyContracts.unitSuffix}`}
            />
          </div>
          <div className="border-hairline-light flex flex-wrap gap-x-5 gap-y-1 border-t px-4 py-2.5">
            <Link
              href="/d-events"
              className="text-link-light text-xs underline-offset-4 hover:underline"
            >
              {s.todayEvents.cta}
            </Link>
            <Link
              href="/d-contracts"
              className="text-link-light text-xs underline-offset-4 hover:underline"
            >
              {s.monthlyContracts.cta}
            </Link>
          </div>
        </Card>
      </section>
    </div>
  );
}
