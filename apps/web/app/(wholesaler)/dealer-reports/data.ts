// 代理店側：二次店が提出した催事日報の読み取り専用ローダー。
//
// 登録・編集は二次店ポータルだけが行う。ここは閲覧のみなので read アクションしか
// 持たない（書き込み経路を作らない）。
//
// 取得範囲は RLS が決める。卸業者セッションでは
// 「自社に紐づく Relationship の日報だけ」が見える（DealerEventReport_isolation）。

import "server-only";

import { dealerReportTotals } from "@solar/contracts";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { ReportDetailViewData } from "@/components/partner/report-detail-view";

export interface DealerReportListItem {
  id: string;
  eventDate: string;
  dealerName: string;
  venuePlace: string;
  venueChain: string;
  apptTotal: number;
}

export interface DealerReportDetail extends ReportDetailViewData {
  id: string;
  dealerName: string;
  createdAt: string;
}

async function requireReadCtx() {
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
    action: "dealer_event_report.read",
    resource: ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined,
  });
  return ctx;
}

export async function listDealerReports(filter: {
  relationshipId?: string;
}): Promise<DealerReportListItem[]> {
  const ctx = await requireReadCtx();
  return withTenant(ctx, async (tx) => {
    const rows = await tx.dealerEventReport.findMany({
      where: filter.relationshipId ? { relationshipId: filter.relationshipId } : {},
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        eventDate: true,
        venuePlace: true,
        venueChain: true,
        apptBoth: true,
        apptSingle: true,
        relationship: { select: { dealer: { select: { name: true } } } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      eventDate: r.eventDate.toISOString(),
      dealerName: r.relationship.dealer.name,
      venuePlace: r.venuePlace,
      venueChain: r.venueChain,
      apptTotal: r.apptBoth + r.apptSingle,
    }));
  });
}

export async function getDealerReport(id: string): Promise<DealerReportDetail | null> {
  const ctx = await requireReadCtx();
  return withTenant(ctx, async (tx) => {
    const r = await tx.dealerEventReport.findUnique({
      where: { id },
      include: { relationship: { select: { dealer: { select: { name: true } } } } },
    });
    if (!r) return null;
    return {
      id: r.id,
      dealerName: r.relationship.dealer.name,
      eventDate: r.eventDate.toISOString(),
      venuePlace: r.venuePlace,
      category: r.category,
      venueChain: r.venueChain,
      areaInFacility: r.areaInFacility,
      startTime: r.startTime,
      endTime: r.endTime,
      lotteryBoth: r.lotteryBoth,
      lotterySingle: r.lotterySingle,
      seatedBoth: r.seatedBoth,
      seatedSingle: r.seatedSingle,
      apptBoth: r.apptBoth,
      apptSingle: r.apptSingle,
      ...dealerReportTotals(r),
      cainzPayCount: r.cainzPayCount,
      impression: r.impression,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

/** 絞り込み用の二次店一覧（自社に紐づく取引関係のみ）。 */
export async function listDealerOptions(): Promise<{ id: string; name: string }[]> {
  const ctx = await requireReadCtx();
  return withTenant(ctx, async (tx) => {
    const rows = await tx.relationship.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, dealer: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((r) => ({ id: r.id, name: r.dealer.name }));
  });
}
