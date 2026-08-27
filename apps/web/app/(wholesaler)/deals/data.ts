// Server-side data loader for the wholesaler deal DETAIL (T-05-03 / F-038 /
// docs/04 §1.3 S-037 / docs/05 §4.8).
//
// 横断一覧としての「商談一覧」は廃止したため、ここに残るのは詳細取得のみ。
// 商談データ自体は削除していない（顧客詳細の「商談履歴」タブから参照する）。
//

import "server-only";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { DealStatus } from "@solar/db";

export interface DealDetail {
  id: string;
  customerId: string;
  customerName: string;
  status: DealStatus;
  ownerType: "WHOLESALER" | "DEALER";
  ownerUserId: string;
  ownerRelationshipId: string | null;
  firstVisitAt: string | null;
  proposedProduct: string | null;
  proposedAmount: string | null;
  expectedProfit: string | null;
  expectedContractDate: string | null;
  lostReason: string | null;
  nextAction: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getDeal(id: string): Promise<DealDetail | null> {
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
    action: "deal.read",
  });

  return withTenant(ctx, async (tx) => {
    const row = await tx.deal.findUnique({
      where: { id },
      select: {
        id: true,
        customerId: true,
        status: true,
        ownerType: true,
        ownerUserId: true,
        ownerRelationshipId: true,
        firstVisitAt: true,
        proposedProduct: true,
        proposedAmount: true,
        expectedProfit: true,
        expectedContractDate: true,
        lostReason: true,
        nextAction: true,
        note: true,
        createdAt: true,
        updatedAt: true,
        customer: { select: { name: true } },
      },
    });

    if (!row) return null;

    return {
      id: row.id,
      customerId: row.customerId,
      customerName: row.customer.name,
      status: row.status,
      ownerType: row.ownerType as "WHOLESALER" | "DEALER",
      ownerUserId: row.ownerUserId,
      ownerRelationshipId: row.ownerRelationshipId,
      firstVisitAt: row.firstVisitAt?.toISOString() ?? null,
      proposedProduct: row.proposedProduct,
      proposedAmount: row.proposedAmount?.toString() ?? null,
      expectedProfit: row.expectedProfit?.toString() ?? null,
      expectedContractDate: row.expectedContractDate?.toISOString() ?? null,
      lostReason: row.lostReason,
      nextAction: row.nextAction,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}
