// 開催場所・店舗の一覧（エリア・場所管理の主画面 / 店舗マスタ画面で共用）。
//
// 実際に催事を行う場所を「名前・所在地・管理エリア・提供元・関連催事」で確認する画面。
// 都道府県だけが並ぶエリア設定を主画面にしないための入れ替えで、店舗管理の画面を
// 二重に作らないよう、ここ 1 つを両方から使う。
//
// 所在地の都道府県（住所から取る）と、業務上の管理エリア（Area(type=EVENT)）は
// 別の列にする。県単位の管理エリアを禁止しないが、同じ物として混ぜない。
//
// 狭い画面では表をやめてカードで積む（店名・所在地・操作が必ず読める）。

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labels } from "@/lib/i18n/labels";

import type { EventAreaOption, StoreListItem, VenueProviderOption } from "./data";

const t = labels.storeMaster;
const c = labels.common;

const SELECT_CLASS =
  "border-hairline-light h-10 w-full rounded-md border bg-white px-3 text-sm sm:w-44";

export interface StoreListSectionProps {
  rows: StoreListItem[];
  options: { areas: EventAreaOption[]; venueProviders: VenueProviderOption[] };
  /** 検索フォームの送信先（/masters と /masters/stores で違う）。 */
  action: string;
  filter: { q: string; areaId: string; venueProviderId: string };
  /** /masters に埋め込むときはタブ側が見出しを持つので false。 */
  showHeading?: boolean;
}

export function StoreListSection({
  rows,
  options,
  action,
  filter,
  showHeading = true,
}: StoreListSectionProps) {
  return (
    <div className="space-y-4">
      {showHeading ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-ink text-lg font-semibold">{t.venueSection.title}</h2>
            <p className="text-muted-foreground text-sm">{t.venueSection.description}</p>
          </div>
          <Button asChild size="sm">
            <Link href="/masters/stores/new">{t.new}</Link>
          </Button>
        </div>
      ) : null}

      {/* 検索 — エリア / 場所提供元 / フリーテキスト（店名・住所）。
          対象月では絞らない。月で探すのは催事であって店舗ではないため。 */}
      <form method="get" action={action} className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1 sm:flex-none">
          <label htmlFor="store-q" className="text-mute-light block text-xs font-semibold">
            {t.filters.keyword}
          </label>
          <Input
            id="store-q"
            type="search"
            name="q"
            defaultValue={filter.q}
            placeholder={t.filters.keywordPlaceholder}
            className="w-full sm:w-64"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="store-area" className="text-mute-light block text-xs font-semibold">
            {t.fields.area}
          </label>
          <select
            id="store-area"
            name="areaId"
            defaultValue={filter.areaId}
            className={SELECT_CLASS}
          >
            <option value="">{t.filters.all}</option>
            {options.areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="store-provider" className="text-mute-light block text-xs font-semibold">
            {t.fields.venueProvider}
          </label>
          <select
            id="store-provider"
            name="venueProviderId"
            defaultValue={filter.venueProviderId}
            className={SELECT_CLASS}
          >
            <option value="">{t.filters.all}</option>
            {options.venueProviders.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          {c.search}
        </Button>
        <Button asChild variant="ghost">
          <Link href={action}>{t.filters.clear}</Link>
        </Button>
      </form>

      <p className="text-mute-light text-sm">
        {t.filters.resultCount.replace("{n}", String(rows.length))}
      </p>

      {rows.length === 0 ? (
        <div className="border-border bg-muted/30 rounded-md border p-8 text-center">
          <p className="text-foreground font-medium">{t.empty}</p>
          <p className="text-muted-foreground mt-2 text-sm">{t.emptyCta}</p>
          <Button asChild className="mt-4">
            <Link href="/masters/stores/new">{t.new}</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* 広い画面 — 表 */}
          <div className="border-border hidden overflow-x-auto rounded-md border lg:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">{t.columns.store}</th>
                  <th className="px-3 py-2 font-medium">{t.fields.venueProvider}</th>
                  <th className="px-3 py-2 font-medium">{t.columns.location}</th>
                  <th className="px-3 py-2 font-medium">{t.fields.area}</th>
                  <th className="px-3 py-2 font-medium">{t.columns.related}</th>
                  <th className="px-3 py-2 font-medium">{t.fields.isActive}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-border border-t align-top">
                    <td className="px-3 py-2">
                      <Link
                        href={`/masters/stores/${r.id}`}
                        className="text-primary font-medium underline-offset-4 hover:underline"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="text-muted-foreground px-3 py-2">
                      {r.venueProviderName ?? c.notSet}
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-ink block">{r.prefecture ?? c.notSet}</span>
                      <span className="text-muted-foreground block text-xs">
                        {r.address ?? t.noAddress}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-3 py-2">{r.areaName ?? c.notSet}</td>
                    <td className="px-3 py-2 text-xs">
                      <RelatedLinks row={r} />
                    </td>
                    <td className="px-3 py-2">{r.isActive ? c.active : c.inactive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 狭い画面 — カード。店名・所在地・操作が必ず見える。 */}
          <ul className="space-y-2 lg:hidden">
            {rows.map((r) => (
              <li key={r.id} className="border-border space-y-1 rounded-md border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link
                    href={`/masters/stores/${r.id}`}
                    className="text-primary text-sm font-medium underline-offset-4 hover:underline"
                  >
                    {r.name}
                  </Link>
                  <span className="text-muted-foreground text-xs">
                    {r.isActive ? c.active : c.inactive}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {r.venueProviderName ?? c.notSet}
                  {r.areaName ? ` / ${t.fields.area}: ${r.areaName}` : ""}
                </p>
                <p className="text-body-light break-words text-xs">
                  {r.prefecture ? `${r.prefecture} ` : ""}
                  {r.address ?? t.noAddress}
                </p>
                <div className="text-xs">
                  <RelatedLinks row={r} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** 関連催事・関連する出店希望への導線。件数は storeId 紐付き分だけ。 */
function RelatedLinks({ row }: { row: StoreListItem }) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      <Link
        href={`/masters/stores/${row.id}#events`}
        className="text-link-light underline underline-offset-2"
      >
        {t.columns.events.replace("{n}", String(row.eventCount))}
      </Link>
      <Link
        href={`/masters/stores/${row.id}#preferences`}
        className="text-link-light underline underline-offset-2"
      >
        {t.columns.preferences.replace("{n}", String(row.lanePreferenceCount))}
      </Link>
    </span>
  );
}
