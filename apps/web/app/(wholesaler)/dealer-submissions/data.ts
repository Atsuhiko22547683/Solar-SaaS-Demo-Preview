// 代理店側：二次店が提出した訪問アポ / 成約の読み取り専用ローダー。
//
// 登録・編集は二次店ポータルだけが行う。ここは閲覧のみなので read アクションしか
// 持たない（書き込み経路を作らない）。
//
// 取得範囲は RLS が決める。卸業者セッションでは「自社に紐づく Relationship の行
// だけ」が見える（DealerVisitAppointment_isolation / DealerContractReport_isolation）。

import "server-only";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { PermissionAction } from "@/lib/permissions/can";

export interface DealerVisitAppointmentListItem {
  id: string;
  createdAt: string;
  dealerName: string;
  tossDept: string;
  closeDept: string;
  salesRep: string;
}

export interface DealerVisitAppointmentDetail extends DealerVisitAppointmentListItem {
  maekakuOperator: string;
  salesChannel: string;
}

export interface DealerContractListItem {
  id: string;
  contractDate: string;
  dealerName: string;
  salesRep: string;
  referralBranch: string;
  affiliation: string;
}

export interface DealerContractDetail extends DealerContractListItem {
  tossDate: string;
  tossDept: string;
  apptGetter: string;
  affiliationDept: string;
  acquisitionChannel: string;
  createdAt: string;
}

async function requireReadCtx(action: PermissionAction) {
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
    action,
    resource: ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined,
  });
  return ctx;
}

// ---------------------------------------------------------------------------
// 訪問アポ
// ---------------------------------------------------------------------------

export async function listDealerVisitAppointments(): Promise<DealerVisitAppointmentListItem[]> {
  const ctx = await requireReadCtx("dealer_visit_appointment.read");
  return withTenant(ctx, async (tx) => {
    const rows = await tx.dealerVisitAppointment.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        createdAt: true,
        tossDept: true,
        closeDept: true,
        salesperson: { select: { name: true } },
        relationship: { select: { dealer: { select: { name: true } } } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      dealerName: r.relationship.dealer.name,
      tossDept: r.tossDept,
      closeDept: r.closeDept,
      salesRep: r.salesperson?.name ?? "",
    }));
  });
}

export async function getDealerVisitAppointment(
  id: string,
): Promise<DealerVisitAppointmentDetail | null> {
  const ctx = await requireReadCtx("dealer_visit_appointment.read");
  return withTenant(ctx, async (tx) => {
    const r = await tx.dealerVisitAppointment.findFirst({
      where: { id },
      select: {
        id: true,
        createdAt: true,
        tossDept: true,
        closeDept: true,
        maekakuOperator: true,
        salesChannel: true,
        salesperson: { select: { name: true } },
        relationship: { select: { dealer: { select: { name: true } } } },
      },
    });
    if (!r) return null;
    return {
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      dealerName: r.relationship.dealer.name,
      tossDept: r.tossDept,
      closeDept: r.closeDept,
      maekakuOperator: r.maekakuOperator,
      salesChannel: r.salesChannel,
      salesRep: r.salesperson?.name ?? "",
    };
  });
}

// ---------------------------------------------------------------------------
// 成約
// ---------------------------------------------------------------------------

export async function listDealerContracts(): Promise<DealerContractListItem[]> {
  const ctx = await requireReadCtx("dealer_contract_report.read");
  return withTenant(ctx, async (tx) => {
    const rows = await tx.dealerContractReport.findMany({
      orderBy: [{ contractDate: "desc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        contractDate: true,
        salesRep: true,
        referralBranch: true,
        affiliation: true,
        relationship: { select: { dealer: { select: { name: true } } } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      contractDate: r.contractDate.toISOString(),
      dealerName: r.relationship.dealer.name,
      salesRep: r.salesRep,
      referralBranch: r.referralBranch,
      affiliation: r.affiliation,
    }));
  });
}

export async function getDealerContract(id: string): Promise<DealerContractDetail | null> {
  const ctx = await requireReadCtx("dealer_contract_report.read");
  return withTenant(ctx, async (tx) => {
    const r = await tx.dealerContractReport.findFirst({
      where: { id },
      include: { relationship: { select: { dealer: { select: { name: true } } } } },
    });
    if (!r) return null;
    return {
      id: r.id,
      contractDate: r.contractDate.toISOString(),
      tossDate: r.tossDate.toISOString(),
      dealerName: r.relationship.dealer.name,
      tossDept: r.tossDept,
      apptGetter: r.apptGetter,
      salesRep: r.salesRep,
      referralBranch: r.referralBranch,
      affiliation: r.affiliation,
      affiliationDept: r.affiliationDept,
      acquisitionChannel: r.acquisitionChannel,
      createdAt: r.createdAt.toISOString(),
    };
  });
}
