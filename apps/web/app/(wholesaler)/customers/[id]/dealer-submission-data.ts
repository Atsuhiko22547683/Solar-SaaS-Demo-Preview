// 顧客に紐付いたパートナー会社の提出物（訪問アポ報告 / 成約報告）。代理店-01 の統合先。
//
// どちらのフォームも顧客名を聞いていないので、紐付けは人が確認して行う（自動でしない）。
// 紐付いていない分は独立した一覧のまま残り、ここには出さない。
//
// 成約報告から Contract を作ることはしない。このフォームは金額・解約期限・粗利を
// 持たないので、Contract に載せるには架空値が要る。正式な契約はこれまでどおり
// 商談（Deal）から積み上げる。

import "server-only";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

export interface CustomerDealerVisitRow {
  id: string;
  companyName: string;
  tossDept: string;
  closeDept: string;
  maekakuOperator: string;
  salespersonName: string | null;
  createdAt: string;
  /** 日時を持つアポイントに紐付いているか。 */
  appointmentId: string | null;
}

export interface CustomerDealerContractRow {
  id: string;
  companyName: string;
  contractDate: string;
  tossDate: string;
  salesRep: string;
  referralBranch: string;
  createdAt: string;
  /** 正式契約に紐付いているか。報告から契約は作らない。 */
  contractId: string | null;
  dealId: string | null;
}

export interface CustomerDealerSubmissions {
  visits: CustomerDealerVisitRow[];
  contracts: CustomerDealerContractRow[];
}

async function requireCustomerReadCtx() {
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
    action: "customer.read",
  });
  return ctx;
}

export async function getCustomerDealerSubmissions(
  customerId: string,
): Promise<CustomerDealerSubmissions> {
  const ctx = await requireCustomerReadCtx();
  return withTenant(ctx, async (tx) => {
    const [visits, contracts] = await Promise.all([
      tx.dealerVisitAppointment.findMany({
        where: { customerId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          tossDept: true,
          closeDept: true,
          maekakuOperator: true,
          createdAt: true,
          appointmentId: true,
          relationship: { select: { dealer: { select: { name: true } } } },
          salesperson: { select: { name: true } },
        },
      }),
      tx.dealerContractReport.findMany({
        where: { customerId },
        orderBy: { contractDate: "desc" },
        select: {
          id: true,
          contractDate: true,
          tossDate: true,
          salesRep: true,
          referralBranch: true,
          createdAt: true,
          contractId: true,
          dealId: true,
          relationship: { select: { dealer: { select: { name: true } } } },
        },
      }),
    ]);

    return {
      visits: visits.map((v) => ({
        id: v.id,
        companyName: v.relationship.dealer.name,
        tossDept: v.tossDept,
        closeDept: v.closeDept,
        maekakuOperator: v.maekakuOperator,
        salespersonName: v.salesperson?.name ?? null,
        createdAt: v.createdAt.toISOString(),
        appointmentId: v.appointmentId,
      })),
      contracts: contracts.map((cr) => ({
        id: cr.id,
        companyName: cr.relationship.dealer.name,
        contractDate: cr.contractDate.toISOString(),
        tossDate: cr.tossDate.toISOString(),
        salesRep: cr.salesRep,
        referralBranch: cr.referralBranch,
        createdAt: cr.createdAt.toISOString(),
        contractId: cr.contractId,
        dealId: cr.dealId,
      })),
    };
  });
}
