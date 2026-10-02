// 開催場所・店舗の一覧（店舗マスタ）。
//
// 表示の実体は store-list-section.tsx にあり、エリア・場所管理のハブ（/masters）の
// 最初のタブでも同じものを使う。店舗管理の画面を二重に作らないため。

import { ListPageHeader } from "@/components/list/list-shell";
import { labels } from "@/lib/i18n/labels";

import { listStoreFilterOptions, listStores } from "./data";
import { StoreListSection } from "./store-list-section";

export const dynamic = "force-dynamic";

interface PageProps {
  // 旧 URL（?name=）で来ても拾えるようにしておく。
  searchParams: Promise<{ q?: string; name?: string; areaId?: string; venueProviderId?: string }>;
}

export default async function StoresListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = (params.q ?? params.name ?? "").trim();
  const areaId = params.areaId?.trim() ?? "";
  const venueProviderId = params.venueProviderId?.trim() ?? "";

  const [rows, options] = await Promise.all([
    listStores({
      ...(q ? { name: q } : {}),
      ...(areaId ? { areaId } : {}),
      ...(venueProviderId ? { venueProviderId } : {}),
    }),
    listStoreFilterOptions(),
  ]);

  const t = labels.storeMaster;

  return (
    <div className="space-y-6">
      <ListPageHeader title={t.venueSection.title} />
      <StoreListSection
        rows={rows}
        options={options}
        action="/masters/stores"
        filter={{ q, areaId, venueProviderId }}
      />
    </div>
  );
}
