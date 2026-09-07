// レーン一覧 — F-059. 場所ごとのレーン契約情報を月単位で一覧表示する。

import { Card } from "@/components/ui/card";
import { labels } from "@/lib/i18n/labels";

import {
  listActiveAreas,
  listActiveDealers,
  listActiveStores,
  listActiveVenueProviders,
  listLineEvents,
  listSelfStaff,
} from "./data";
import { LineFilter } from "./line-filter";
import { LineTable } from "./line-table";
import { NewLineEventDialog } from "./new-line-event-dialog";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ month?: string; venueProviderId?: string }>;
}

// 当月を YYYY-MM で算出（タイムゾーン安全に getFullYear/getMonth で）。
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function LineEventsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const t = labels.lineEvent;

  const targetMonth =
    params.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month) ? params.month : currentMonth();
  const venueProviderId = params.venueProviderId ?? "";

  const [rows, venueProviders, areas, stores, selfStaff, dealers] = await Promise.all([
    listLineEvents({ targetMonth, venueProviderId: venueProviderId || undefined }),
    listActiveVenueProviders(),
    listActiveAreas(),
    listActiveStores(),
    listSelfStaff(),
    listActiveDealers(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-ink text-xl font-bold">{t.title}</h1>
          <p className="text-body-light mt-1 text-sm">{t.subtitle}</p>
        </div>
        <NewLineEventDialog
          venueProviders={venueProviders}
          areas={areas}
          stores={stores}
          selfStaff={selfStaff}
          dealers={dealers}
          defaultMonth={targetMonth}
        />
      </div>

      <Card className="p-4">
        <LineFilter
          venueProviders={venueProviders}
          currentMonth={targetMonth}
          currentVenueProviderId={venueProviderId}
        />
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-hairline-light flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-ink text-sm font-medium">{t.title}</h2>
          <span className="text-mute-light text-xs tabular-nums">
            {rows.length}
            {t.filter.resultCount}
          </span>
        </div>
        {rows.length === 0 ? (
          <div className="text-mute-light px-6 py-12 text-center text-sm">{t.empty}</div>
        ) : (
          <LineTable rows={rows} />
        )}
      </Card>
    </div>
  );
}
