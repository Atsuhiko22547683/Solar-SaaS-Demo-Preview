// S-033 — 卸業者側 顧客登録フォーム (T-04-06 / F-031 / docs/04 §1.3).

import { auth } from "@/auth";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { UnauthorizedError } from "@/lib/errors";
import { labels } from "@/lib/i18n/labels";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";

import { eventExistsInTenant } from "../../events/[id]/data";
import { listAssignableStaff } from "../../salespeople/data";
import { createCustomerAction } from "../actions";
import { CustomerForm } from "../customer-form";

import type { CustomerFormValues } from "../customer-form";

export const dynamic = "force-dynamic";

interface NewCustomerPageProps {
  // イベント詳細からの導線は ?eventId=<Event.id> を付けてくる。催事チャネル +
  // 催事 ID を初期値として埋め、販売チャネルは催事（EVENT）で開く。
  searchParams?: Promise<{ eventId?: string }>;
}

export default async function NewCustomerPage({ searchParams }: NewCustomerPageProps) {
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
    action: "customer.create",
  });

  const t = labels.customer;
  const bc = labels.breadcrumb.items;

  // query parameter は書き換えられるので、そのまま前埋めせず自テナントに実在する
  // Event かを確認する（実在しなければ通常の新規登録として開く）。書き込み側の
  // createCustomerAction でも同じ検証を行う（こちらは表示のための先行チェック）。
  const requestedEventId = (await searchParams)?.eventId?.trim() ?? "";
  const sourceEventId = (await eventExistsInTenant(requestedEventId)) ? requestedEventId : "";
  // トス獲得者の候補はスタッフマスタ（Salesperson）の自社スタッフだけ。
  // システムユーザー（User）は人物マスタとして使わない。
  const tossUpStaff = (await listAssignableStaff())
    .filter((s) => s.relationshipId === null)
    .map((s) => ({ id: s.id, name: s.name }));

  async function submitAction(values: CustomerFormValues) {
    "use server";
    return createCustomerAction({
      name: values.name,
      kana: values.kana,
      phone: values.phone,
      email: values.email,
      postalCode: values.postalCode,
      address: values.address,
      channel: values.channel,
      sourceEventId: values.sourceEventId,
      salesChannel: values.salesChannel,
      faceToFace: values.faceToFace,
      tossDept: values.tossDept,
      tossUpSalespersonId: values.tossUpSalespersonId,
      note: values.note,
    });
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: bc.customers, href: "/customers" }, { label: bc.customerNew }]}
      />
      <h1 className="text-ink text-xl font-bold">{t.new}</h1>
      <CustomerForm
        mode={
          sourceEventId
            ? {
                // イベント経由の登録。氏名・電話は必須入力なので空のまま開き、
                // 催事由来であることを示す値だけ先に埋める。
                kind: "create",
                initial: {
                  name: "",
                  phone: "",
                  channel: "EVENT",
                  sourceEventId,
                  salesChannel: "EVENT",
                },
              }
            : { kind: "create" }
        }
        // 実在イベント由来なら販売チャネルは催事で固定（サーバ側でも EVENT へ寄せる）。
        lockEventSalesChannel={sourceEventId !== ""}
        tossUpStaff={tossUpStaff}
        onSubmitAction={submitAction}
        redirectTo="/customers"
      />
    </div>
  );
}
