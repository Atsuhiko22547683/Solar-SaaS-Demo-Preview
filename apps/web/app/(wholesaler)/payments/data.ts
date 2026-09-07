// 決済管理（/payments）の server-side data loader。
//
// 目的は「契約済み顧客の決済状況を確認し、必要なら Stripe 側で操作する」こと。
// Stripe API はまだ接続していないので、ここは既存 DB の読み取りだけを行う。
//
// 契約済みの判定は新設しない。既存の契約一覧と同じく Contract 行の存在＋
// status が CANCELLED 以外であることを「契約済み」とする。
//
// auth → assertCan("payment.read") → withTenant の順は他ローダーと同じ。

import "server-only";

import { maskName } from "@solar/contracts/services/masking";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { ViewerContext } from "@solar/contracts/services/masking";
import type { ContractPaymentStatus, ContractStatus } from "@solar/db";

/** 一覧のタブ。既存データだけで安全に判定できる範囲に絞る。 */
export type PaymentFilterTab = "all" | "unpaid" | "paid";

export interface PaymentListItem {
  /** Contract.id。決済は契約ごとに 1 件（ContractPayment は contractId 一意）。 */
  contractId: string;
  customerId: string;
  /** PII マスク済みの顧客名。 */
  customerName: string;
  contractDate: string;
  /** 契約金額（円）。文字列で持ち、表示側で整形する。 */
  contractAmount: string;
  contractStatus: ContractStatus;
  /** ContractPayment が無ければ null（＝決済情報未登録）。 */
  paymentStatus: ContractPaymentStatus | null;
  /** 入金日。ContractPayment.depositDate。 */
  lastPaidAt: string | null;
  /** 決済方法。ローン会社が入っていればローン、無ければ未設定として扱う。 */
  paymentMethod: string | null;
}

async function requirePaymentCtx() {
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
  return { session, ctx };
}

function viewerOf(roles: string[], piiMaskingMode: string | null | undefined): ViewerContext {
  return {
    role: (roles[0] ?? "OWNER") as ViewerContext["role"],
    tenantType: "WHOLESALER",
    isSelfTenant: true,
    piiMaskingMode: (piiMaskingMode ?? "MASKED") as "FULL" | "PARTIAL" | "MASKED",
  };
}

/** ローン会社が入っていれば「ローン」、無ければ未設定。新しい決済ロジックは作らない。 */
function methodOf(loanCompany: string | null): string | null {
  return loanCompany?.trim() ? loanCompany.trim() : null;
}

/**
 * 決済一覧。契約済み（Contract 行があり status !== CANCELLED）の契約だけを返す。
 *
 * tab は既存 ContractPayment.paymentStatus だけで判定する:
 *   unpaid = 決済情報が無い、または UNPAID / PARTIAL
 *   paid   = PAID
 */
export async function listPayments(tab: PaymentFilterTab = "all"): Promise<PaymentListItem[]> {
  const { session, ctx } = await requirePaymentCtx();

  return withTenant(ctx, async (tx) => {
    const settings = ctx.wholesalerId
      ? await tx.wholesalerSettings.findUnique({
          where: { wholesalerId: ctx.wholesalerId },
          select: { piiMaskingMode: true },
        })
      : null;
    const viewer = viewerOf(session.user.roles, settings?.piiMaskingMode);

    const rows = await tx.contract.findMany({
      where: {
        status: { not: "CANCELLED" },
        ...(tab === "paid" ? { payment: { paymentStatus: "PAID" } } : {}),
        ...(tab === "unpaid"
          ? {
              OR: [
                { payment: { is: null } },
                { payment: { paymentStatus: { in: ["UNPAID", "PARTIAL"] } } },
              ],
            }
          : {}),
      },
      orderBy: [{ contractDate: "desc" }],
      select: {
        id: true,
        contractDate: true,
        contractAmount: true,
        status: true,
        customer: { select: { id: true, name: true } },
        payment: {
          select: { paymentStatus: true, depositDate: true, loanCompany: true },
        },
      },
    });

    return rows.map<PaymentListItem>((r) => ({
      contractId: r.id,
      customerId: r.customer.id,
      customerName: maskName(r.customer.name, viewer),
      contractDate: r.contractDate.toISOString(),
      contractAmount: r.contractAmount.toString(),
      contractStatus: r.status,
      paymentStatus: r.payment?.paymentStatus ?? null,
      lastPaidAt: r.payment?.depositDate?.toISOString() ?? null,
      paymentMethod: methodOf(r.payment?.loanCompany ?? null),
    }));
  });
}

/** 決済履歴 1 行。既存 DB にある記録だけを日時順に並べる。 */
export interface PaymentHistoryRow {
  /** 表示ラベル（入金 / 代理店支払 など）。 */
  label: string;
  occurredAt: string;
  note: string | null;
}

export interface PaymentDetail extends PaymentListItem {
  /** 支払い回数。ContractPayment.paymentCount。 */
  paymentCount: number | null;
  /** 頭金（円）。 */
  downPayment: number | null;
  /** ローン備考。 */
  loanNote: string | null;
  /** 決済情報レコード自体の有無。 */
  hasPaymentRecord: boolean;
  history: PaymentHistoryRow[];
}

/**
 * 決済詳細。決済情報と決済履歴を返す。
 *
 * 履歴専用テーブルは無いので、ContractPayment に記録されている日付
 * （入金日 / 代理店支払日）と決済情報の作成・更新日時を時系列に並べる。
 * 架空のデータは作らない。
 */
export async function getPaymentDetail(contractId: string): Promise<PaymentDetail | null> {
  const { session, ctx } = await requirePaymentCtx();

  return withTenant(ctx, async (tx) => {
    const settings = ctx.wholesalerId
      ? await tx.wholesalerSettings.findUnique({
          where: { wholesalerId: ctx.wholesalerId },
          select: { piiMaskingMode: true },
        })
      : null;
    const viewer = viewerOf(session.user.roles, settings?.piiMaskingMode);

    const r = await tx.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        contractDate: true,
        contractAmount: true,
        status: true,
        customer: { select: { id: true, name: true } },
        payment: {
          select: {
            paymentStatus: true,
            paymentCount: true,
            loanCompany: true,
            downPayment: true,
            loanNote: true,
            depositDate: true,
            dealerPayoutDate: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!r || r.status === "CANCELLED") return null;

    const p = r.payment;
    const history: PaymentHistoryRow[] = [];
    if (p) {
      history.push({ label: "決済情報を登録", occurredAt: p.createdAt.toISOString(), note: null });
      if (p.depositDate) {
        history.push({ label: "入金", occurredAt: p.depositDate.toISOString(), note: null });
      }
      if (p.dealerPayoutDate) {
        history.push({
          label: "代理店支払",
          occurredAt: p.dealerPayoutDate.toISOString(),
          note: null,
        });
      }
      if (p.updatedAt.getTime() !== p.createdAt.getTime()) {
        history.push({
          label: "決済情報を更新",
          occurredAt: p.updatedAt.toISOString(),
          note: null,
        });
      }
      history.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    }

    return {
      contractId: r.id,
      customerId: r.customer.id,
      customerName: maskName(r.customer.name, viewer),
      contractDate: r.contractDate.toISOString(),
      contractAmount: r.contractAmount.toString(),
      contractStatus: r.status,
      paymentStatus: p?.paymentStatus ?? null,
      lastPaidAt: p?.depositDate?.toISOString() ?? null,
      paymentMethod: methodOf(p?.loanCompany ?? null),
      paymentCount: p?.paymentCount ?? null,
      downPayment: p?.downPayment ?? null,
      loanNote: p?.loanNote ?? null,
      hasPaymentRecord: p != null,
      history,
    };
  });
}
