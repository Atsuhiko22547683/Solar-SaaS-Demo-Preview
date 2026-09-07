// 二次店 契約詳細 (T-05-09 / F-040 / F-041 / docs/04 §1.5 S-065).
//
// 契約基本情報 + 明細テーブル（仕入値非表示）+ インセンティブ placeholder。
// snapshotPurchasePrice は getDealerContractDetail の DTO 層で物理除外済み。
// ownerRelationshipId が自テナント外の場合は 404。

import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { getDealerContractDetail } from "../data";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function DealerContractDetailPage({ params }: PageProps) {
  const { id } = await params;
  const contract = await getDealerContractDetail(id);
  if (!contract) notFound();

  const t = labels.dealerContract;
  const ti = labels.contractItem;
  const c = labels.common;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/d-contracts">{c.back}</Link>
        </Button>
        <h1 className="text-ink text-xl font-bold">{t.detailTitle}</h1>
      </div>

      {/* Basic info */}
      <div className="border-border space-y-3 rounded-md border p-4">
        <h2 className="font-medium">{t.sections.basic}</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t.fields.customer}</dt>
          <dd>{contract.customerName}</dd>

          <dt className="text-muted-foreground">{t.fields.contractDate}</dt>
          <dd>{formatDate(contract.contractDate)}</dd>

          <dt className="text-muted-foreground">{t.fields.totalAmount}</dt>
          <dd>
            {Number(contract.contractAmount).toLocaleString("ja-JP")} {c.currencySuffix}
          </dd>

          <dt className="text-muted-foreground">{t.fields.cancelDeadline}</dt>
          <dd>{formatDate(contract.cancelDeadline)}</dd>

          <dt className="text-muted-foreground">{t.fields.status}</dt>
          <dd>
            <span className={contract.status === "CANCELLED" ? "text-destructive" : undefined}>
              {t.statuses[contract.status]}
            </span>
          </dd>
        </dl>
      </div>

      {/* Items section — snapshotPurchasePrice physically absent from DTO */}
      <div className="border-border space-y-3 rounded-md border p-4">
        <h2 className="font-medium">{t.sections.items}</h2>
        {contract.items.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.detail.noItems}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">{ti.columns.productName}</th>
                  <th className="px-3 py-2 font-medium">{ti.columns.maker}</th>
                  <th className="px-3 py-2 font-medium">{ti.columns.qty}</th>
                  <th className="px-3 py-2 font-medium">{ti.columns.unit}</th>
                  <th className="px-3 py-2 font-medium">{t.fields.dealerPrice}</th>
                  <th className="px-3 py-2 font-medium">{t.fields.listPrice}</th>
                  <th className="px-3 py-2 font-medium">{ti.columns.subtotal}</th>
                </tr>
              </thead>
              <tbody>
                {contract.items.map((item) => (
                  <tr key={item.id} className="border-border border-t">
                    <td className="px-3 py-2">{item.productName}</td>
                    <td className="text-muted-foreground px-3 py-2">{item.maker}</td>
                    <td className="px-3 py-2">{item.qty}</td>
                    <td className="text-muted-foreground px-3 py-2">{item.unit}</td>
                    <td className="px-3 py-2">
                      {Number(item.snapshotDealerPrice).toLocaleString("ja-JP")}
                    </td>
                    <td className="px-3 py-2">
                      {Number(item.snapshotListPrice).toLocaleString("ja-JP")}
                    </td>
                    <td className="px-3 py-2 font-medium">
                      {Number(item.subtotal).toLocaleString("ja-JP")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Incentive placeholder */}
      <div className="border-border rounded-md border border-dashed p-4">
        <p className="text-muted-foreground text-sm">{t.detail.incentivePlaceholder}</p>
      </div>
    </div>
  );
}
