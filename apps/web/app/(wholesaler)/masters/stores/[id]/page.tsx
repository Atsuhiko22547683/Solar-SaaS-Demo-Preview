import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { labels } from "@/lib/i18n/labels";

import { getStore, listEventAreaOptions, listVenueProviderOptions } from "../data";
import { StoreForm } from "../store-form";

import type { StoreInput } from "@solar/contracts";

// 店舗マスタ 詳細・編集. `getStore` runs through the same auth →
// assertCan(store.read) → withTenant pipeline as the list, so cross-tenant ids
// resolve to null (RLS) and 404 here. The form calls updateStoreAction /
// disableStoreAction which re-check `store.update`.

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StoreDetailPage({ params }: PageProps) {
  const { id } = await params;
  const row = await getStore(id);
  if (!row) {
    notFound();
  }

  const t = labels.storeMaster;
  const c = labels.common;

  const initial: StoreInput & { isActive: boolean } = {
    name: row.name,
    venueProviderId: row.venueProviderId,
    postalCode: row.postalCode,
    address: row.address,
    areaId: row.areaId,
    isActive: row.isActive,
  };
  const [venueProviders, eventAreas] = await Promise.all([
    listVenueProviderOptions(),
    listEventAreaOptions(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/masters/stores">{c.back}</Link>
          </Button>
          <h1 className="text-ink text-xl font-bold">{t.edit}</h1>
        </div>
        <span className="text-muted-foreground text-sm">
          {row.isActive ? c.active : c.inactive}
        </span>
      </div>
      <StoreForm
        mode={{ kind: "edit", id: row.id, initial }}
        venueProviders={venueProviders}
        eventAreas={eventAreas}
      />

      {/* 店舗 → 催事の逆引き。開催当時の店舗名も一緒に出して、改称後でも辿れるようにする。 */}
      <section id="events" className="scroll-mt-4 space-y-2">
        <h2 className="text-lg font-medium">{t.sections.relatedEvents}</h2>
        <p className="text-muted-foreground text-sm">{t.relatedEventsHint}</p>
        {row.relatedEvents.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.relatedEventsEmpty}</p>
        ) : (
          <ul className="divide-hairline-light border-hairline-light divide-y rounded-md border">
            {row.relatedEvents.map((ev) => (
              <li
                key={ev.eventCandidateId}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
              >
                <span className="tabular-nums">{ev.scheduledDate.slice(0, 10)}</span>
                <Link
                  href={`/event-detail/${ev.eventCandidateId}`}
                  className="text-primary underline underline-offset-2"
                >
                  {ev.storeNameAtEvent}
                </Link>
                <span className="text-muted-foreground text-xs">
                  {t.storeNameAtEvent}: {ev.storeNameAtEvent}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* この店舗への出店希望。紐付けは storeId だけを根拠にする
          （「カインズ 大宮店」と「大宮店」は別の店舗でありうるため、名称では混ぜない）。 */}
      <section id="preferences" className="scroll-mt-4 space-y-2">
        <h2 className="text-lg font-medium">{t.relatedPreferences}</h2>
        <p className="text-muted-foreground text-sm">{t.relatedPreferencesHint}</p>
        {row.relatedPreferences.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t.relatedPreferencesEmpty}</p>
        ) : (
          <ul className="divide-hairline-light border-hairline-light divide-y rounded-md border">
            {row.relatedPreferences.map((pf) => (
              <li
                key={`${pf.lanePreferenceId}-${pf.laneNo}-${pf.priority}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
              >
                <span className="tabular-nums">{pf.targetMonth}</span>
                <Link
                  href={`/lane-preferences/${pf.lanePreferenceId}`}
                  className="text-primary underline underline-offset-2"
                >
                  {pf.dealerName}
                </Link>
                <span className="text-muted-foreground text-xs">
                  {t.laneAndPriority
                    .replace("{lane}", String(pf.laneNo))
                    .replace("{priority}", String(pf.priority))}
                </span>
                <span className="text-muted-foreground text-xs">
                  {t.venueLabelAtSubmit}: {pf.venueLabel}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
