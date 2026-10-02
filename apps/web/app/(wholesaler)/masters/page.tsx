import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { labels } from "@/lib/i18n/labels";
import { assertSettingsAccess } from "@/lib/permissions/settings-guard";

import { AreasTabContent } from "./areas/areas-tab-content";
import { getMastersHubSummary } from "./data";
import { listStoreFilterOptions, listStores } from "./stores/data";
import { StoreListSection } from "./stores/store-list-section";
import { VenueProviderRow } from "./venue-provider-row";

// /masters — エリア・場所管理。3 タブ構成（開催場所・店舗 → 場所提供元 → エリア設定）。
//
// 最初に出すのは「開催場所・店舗」。この画面で利用者が探しているのは実際に催事を行う
// 場所とその住所・地域・関連催事で、都道府県が並ぶだけのエリア設定ではないため。
// エリア設定は分類の定義なので最後に置く。
//
// 店舗一覧の実体は stores/store-list-section.tsx で、/masters/stores と共用する
// （同じ管理画面を二重に作らない）。
//
// 二次店の管理はここではなく「設定 > 二次店管理」(/masters/relationships) が担う。

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; areaId?: string; venueProviderId?: string }>;
}

export default async function MastersHubPage({ searchParams }: PageProps) {
  // 設定配下は OWNER / SYSTEM_ADMIN のみ。URL 直打ちもここで 403 にする。
  await assertSettingsAccess();

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const areaId = params.areaId?.trim() ?? "";
  const venueProviderId = params.venueProviderId?.trim() ?? "";

  const [summary, storeRows, storeOptions] = await Promise.all([
    getMastersHubSummary(),
    listStores({
      ...(q ? { name: q } : {}),
      ...(areaId ? { areaId } : {}),
      ...(venueProviderId ? { venueProviderId } : {}),
    }),
    listStoreFilterOptions(),
  ]);
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

      {/* 既定は「開催場所・店舗」。検索条件つきで開いたときもこのタブを見せる。 */}
      <Tabs defaultValue="stores" className="space-y-4">
        {/* TabsList は左寄せ + 各タブ等幅。w-fit でリスト自身は内容幅に縮める */}
        <TabsList className="grid w-fit grid-cols-3 gap-1">
          <TabsTrigger value="stores" className="w-40">
            {store.venueSection.title}
          </TabsTrigger>
          <TabsTrigger value="venueProviders" className="w-40">
            場所提供元
          </TabsTrigger>
          <TabsTrigger value="areas" className="w-40">
            エリア設定
          </TabsTrigger>
        </TabsList>

        {/* タブ 1: 開催場所・店舗 — この画面の主役。 */}
        <TabsContent value="stores">
          <section
            aria-labelledby="tab-stores-heading"
            className="border-border bg-card space-y-4 rounded-md border p-4 sm:p-6"
          >
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 id="tab-stores-heading" className="text-lg font-semibold">
                  {store.venueSection.title}
                </h2>
                <p className="text-muted-foreground text-sm">{store.venueSection.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/masters/stores">{t.embedded.openFullPage}</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/masters/stores/new">{store.new}</Link>
                </Button>
              </div>
            </header>
            <StoreListSection
              rows={storeRows}
              options={storeOptions}
              action="/masters"
              filter={{ q, areaId, venueProviderId }}
              showHeading={false}
            />
          </section>
        </TabsContent>

        {/* タブ 3: エリア設定 — 催事の分類・検索に使う地域区分の定義。
            クライアント側コンポーネントがイベントエリア / 顧客エリアのサブタブと
            新規/編集モーダルを管理する。 */}
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
