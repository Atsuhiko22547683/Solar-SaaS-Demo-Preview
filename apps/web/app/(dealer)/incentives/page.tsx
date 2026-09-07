// S-070 — 二次店 インセンティブ確認 (T-06-10 / F-051 / docs/04 §1.5).
//
// dealer_admin / dealer_staff が自社の確定済み (FINALIZED) インセンティブを
// 一覧確認する。仕入値は絶対表示しない (CLAUDE.md rule #5)。

import "server-only";

import { formatDate } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { listDealerIncentives } from "./data";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DealerIncentivesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const targetMonth = typeof sp["month"] === "string" ? sp["month"] : undefined;

  const result = await listDealerIncentives({ targetMonth });

  const t = labels.dealerIncentive;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-ink text-xl font-bold">{t.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t.subtitle}</p>
      </div>

      {/* Month filter */}
      <form method="GET" className="flex items-center gap-2">
        <label className="text-sm font-medium" htmlFor="month-input">
          {t.filterLabel}
        </label>
        <input
          id="month-input"
          name="month"
          type="month"
          defaultValue={targetMonth ?? ""}
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring h-9 rounded-md border px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          placeholder={t.filterPlaceholder}
        />
        <button
          type="submit"
          className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-md px-3 text-sm font-medium"
        >
          {t.filterApply}
        </button>
      </form>

      {result.items.length === 0 ? (
        <div className="border-border bg-muted/30 rounded-md border p-8 text-center">
          <p className="text-foreground font-medium">{t.empty}</p>
          <p className="text-muted-foreground mt-2 text-sm">{t.emptyCta}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground border-b text-xs">
                <th className="px-4 py-3 text-left font-medium">{t.fields.contractDate}</th>
                <th className="px-4 py-3 text-left font-medium">{t.fields.settledMonth}</th>
                <th className="px-4 py-3 text-right font-medium">{t.fields.targetProfit}</th>
                <th className="px-4 py-3 text-right font-medium">{t.fields.rate}</th>
                <th className="px-4 py-3 text-right font-medium">{t.fields.amount}</th>
                <th className="px-4 py-3 text-left font-medium">{t.fields.status}</th>
                <th className="px-4 py-3 text-left font-medium">{t.fields.finalizedAt}</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => {
                const statusLabel = t.statuses[item.status] ?? item.status;
                const badgeClass = t.statusBadgeClass[item.status] ?? "text-foreground";

                return (
                  <tr key={item.id} className="hover:bg-muted/30 border-b last:border-0">
                    <td className="px-4 py-3 tabular-nums">{formatDate(item.contractDate)}</td>
                    <td className="px-4 py-3 tabular-nums">{item.settledMonth}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {Number(item.targetProfit).toLocaleString("ja-JP")}
                      {t.currencySuffix}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {Number(item.rate).toFixed(2)}
                      {t.percentSuffix}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {Number(item.amount).toLocaleString("ja-JP")}
                      {t.currencySuffix}
                    </td>
                    <td className={`px-4 py-3 font-medium ${badgeClass}`}>{statusLabel}</td>
                    <td className="px-4 py-3 text-xs tabular-nums">
                      {item.finalizedAt ? formatDate(item.finalizedAt) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
