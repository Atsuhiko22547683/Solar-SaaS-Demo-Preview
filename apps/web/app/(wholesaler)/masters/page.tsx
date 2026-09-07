import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { labels } from "@/lib/i18n/labels";
import { assertSettingsAccess } from "@/lib/permissions/settings-guard";

import { AreasTabContent } from "./areas/areas-tab-content";
import { getMastersHubSummary } from "./data";
import { VenueProviderRow } from "./venue-provider-row";

// /masters — エリア・場所管理。2 タブ構成（エリア設定 → 場所提供元）。
// 場所提供元は 1 : N で店舗（VenueProvider.stores）を持つ親子関係。タブ自身は
// 左寄せ + 各タブ幅を grid で統一。
//
// 二次店の管理はここではなく「設定 > 二次店管理」(/masters/relationships) が担う。
// エリア・場所の責務だけをこのハブに残し、二次店一覧タブは削除した。

export const dynamic = "force-dynamic";

export default async function MastersHubPage() {
  // 設定配下は OWNER / SYSTEM_ADMIN のみ。URL 直打ちもここで 403 にする。
  await assertSettingsAccess();

  const summary = await getMastersHubSummary();
  const t = labels.masters;
  const c = labels.common;
  const venueProvider = labels.venueProvider;
  const store = labels.storeMaster;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-ink text-xl font-bold">{t.title}</h1>
        <p className="text-muted-foreground text-sm">{t.subtitle}</p>
      </div>

      <Tabs defaultValue="areas" className="space-y-4">
        {/* TabsList は左寄せ + 各タブ等幅。w-fit でリスト自身は内容幅に縮める */}
        <TabsList className="grid w-fit grid-cols-2 gap-1">
          <TabsTrigger value="areas" className="w-40">
            エリア設定
          </TabsTrigger>
          <TabsTrigger value="venueProviders" className="w-40">
            場所提供元
          </TabsTrigger>
        </TabsList>

        {/* タブ 1: エリア設定 — クライアント側コンポーネントが
            イベントエリア / 顧客エリアのサブタブ + 新規/編集モーダルを管理。 */}
        <TabsContent value="areas">
          <section
            aria-labelledby="tab-areas-heading"
            className="border-border bg-card space-y-4 rounded-md border p-6"
          >
            <header className="space-y-1">
              <h2 id="tab-areas-heading" className="text-lg font-semibold">
                {t.tabs.areas.label}
              </h2>
              <p className="text-muted-foreground text-sm">{t.tabs.areas.description}</p>
            </header>
            <AreasTabContent
              eventAreas={summary.areas.eventAreas}
              customerAreas={summary.areas.customerAreas}
            />
          </section>
        </TabsContent>

        {/* タブ 2: 場所提供元（チェーン）+ 子の店舗（支店）。1 : N の親子関係を
            表で表現：1 行目に親（場所提供元）、その下に子（店舗）を字下げ表示。 */}
        <TabsContent value="venueProviders">
          <section
            aria-labelledby="tab-venue-providers-heading"
            className="border-border bg-card space-y-4 rounded-md border p-6"
          >
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 id="tab-venue-providers-heading" className="text-lg font-semibold">
                  {venueProvider.title} (
                  {summary.venueProviders.totalActiveCount.toLocaleString("ja-JP")} 件 / 店舗{" "}
                  {summary.venueProviders.totalStoreCount.toLocaleString("ja-JP")} 件)
                </h2>
                <p className="text-muted-foreground text-sm">
                  チェーン（場所提供元）とその支店（店舗）の親子関係を管理します
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/masters/venue-providers">{t.embedded.openFullPage}</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/masters/venue-providers/new">{venueProvider.new}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/masters/stores/new">{store.new}</Link>
                </Button>
              </div>
            </header>

            {summary.venueProviders.preview.length === 0 ? (
              <div className="border-border bg-muted/30 rounded-md border p-6 text-center">
                <p className="text-foreground font-medium">{venueProvider.empty}</p>
              </div>
            ) : (
              <div className="border-border overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">{venueProvider.fields.name}</th>
                      <th className="px-3 py-2 font-medium">{venueProvider.fields.area}</th>
                      <th className="px-3 py-2 font-medium">店舗（支店）</th>
                      <th className="px-3 py-2 font-medium">
                        <span className="sr-only">{c.edit}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.venueProviders.preview.map((r) => (
                      <VenueProviderRow key={r.id} href={`/masters/venue-providers/${r.id}`}>
                        <td className="text-primary px-3 py-2 font-medium">{r.name}</td>
                        <td className="text-muted-foreground px-3 py-2">{r.area ?? "—"}</td>
                        <td className="px-3 py-2">
                          {r.stores.length === 0 ? (
                            <span className="text-muted-foreground text-xs">支店なし</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {r.stores.map((s) => (
                                <span
                                  key={s.id}
                                  className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700 ring-1 ring-inset ring-sky-200"
                                >
                                  {s.name}
                                </span>
                              ))}
                              {r.storeCount > r.stores.length ? (
                                <span className="text-muted-foreground inline-flex items-center text-xs italic">
                                  +{(r.storeCount - r.stores.length).toLocaleString("ja-JP")}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="text-muted-foreground text-xs">→</span>
                        </td>
                      </VenueProviderRow>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
