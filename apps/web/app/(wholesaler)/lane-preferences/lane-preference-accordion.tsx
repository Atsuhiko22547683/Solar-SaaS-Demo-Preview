"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { labels } from "@/lib/i18n/labels";

import { bandColor, groupConsecutiveDates } from "./desired-dates";

import type { LanePreferenceDto, LanePreferenceItemDto } from "./data";

// 提出日時は YYYY/MM/DD HH:mm（ja-JP, JST 表示）。
function formatSubmittedAt(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PRIORITY_LABELS = labels.lanePreference.priorityLabels;

function priorityLabel(priority: number): string {
  const fixed = PRIORITY_LABELS[priority as 1 | 2 | 3 | 4 | 5];
  if (fixed) return fixed;
  return PRIORITY_LABELS.fallback.replace("{n}", String(priority));
}

/** 明細をレーン番号でまとめる。保存されている laneNo をそのまま使う（表示順から推測しない）。 */
export function groupByLane(
  items: LanePreferenceItemDto[],
): Array<{ laneNo: number; items: LanePreferenceItemDto[] }> {
  const byLane = new Map<number, LanePreferenceItemDto[]>();
  for (const i of items) {
    const list = byLane.get(i.laneNo);
    if (list) list.push(i);
    else byLane.set(i.laneNo, [i]);
  }
  return [...byLane.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([laneNo, list]) => ({
      laneNo,
      items: list.slice().sort((a, b) => a.priority - b.priority),
    }));
}

function PreferenceCard({ item }: { item: LanePreferenceItemDto }) {
  const c = labels.lanePreference.card;
  // 連続日を帯チップにグルーピング（例 7/7,7/8 → "7/7~8"）。
  const bands = groupConsecutiveDates(item.desiredDates);
  const t = labels.lanePreference;

  return (
    <div className="border-hairline-light bg-surface-soft/40 min-w-[240px] flex-1 rounded-md border p-3">
      <div className="text-link-light mb-2 text-xs font-medium">{priorityLabel(item.priority)}</div>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-mute-light text-xs">{c.venueLabel}</dt>
          <dd className="text-ink font-medium">{item.venueLabel}</dd>
          {/* 店舗マスタに紐付いているときだけ、店舗と場所提供元を出す。
              紐付きが無い明細で提供元名を出すと、ラベルと無関係な提供元が
              並んで見えてしまう（「カインズ 大宮店 / スーパービバホーム」）。 */}
          {item.storeId ? (
            <>
              <dd className="text-mute-light mt-0.5 text-xs">
                {c.store}: {item.storeName ?? "—"}
              </dd>
              {item.venueProviderName ? (
                <dd className="text-mute-light text-xs">
                  {c.venueProvider}: {item.venueProviderName}
                </dd>
              ) : null}
            </>
          ) : (
            <dd className="text-mute-light mt-0.5 text-xs">{t.storeUnlinked}</dd>
          )}
        </div>
        <div>
          <dt className="text-mute-light mb-1 text-xs">{c.desiredDates}</dt>
          <dd>
            {bands.length === 0 ? (
              <span className="text-mute-light">—</span>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {bands.map((b) => (
                  <span
                    key={b.dates[0]}
                    className={[
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums",
                      bandColor(b.startDow),
                    ].join(" ")}
                  >
                    <span>{b.label}</span>
                    <span className="text-[10px] font-semibold opacity-70">
                      {c.dayCount.replace("{n}", String(b.dates.length))}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </dd>
        </div>
        {/* 店舗ごとの個別条件。希望順位とは別の軸なので、順位へ読み替えず独立に出す。 */}
        {item.conditionNote ? (
          <div>
            <dt className="text-mute-light text-xs">{t.conditionNoteLabel}</dt>
            <dd className="text-body-light">{item.conditionNote}</dd>
          </div>
        ) : null}
        {item.memo ? (
          <div>
            <dt className="text-mute-light text-xs">{c.memo}</dt>
            <dd className="text-body-light">{item.memo}</dd>
          </div>
        ) : null}
        {/* 採用して確定したイベント。提出 → 採用 → 開催の対応をここで辿れる。 */}
        {item.adoptions.length > 0 ? (
          <div>
            <dt className="text-mute-light text-xs">{t.adoptionTitle}</dt>
            <dd className="space-y-0.5">
              {item.adoptions.map((ad) => (
                <a
                  key={ad.eventId}
                  href={`/event-detail/${ad.eventCandidateId}`}
                  className="text-link-light block text-xs underline underline-offset-2"
                >
                  {ad.scheduledDate.slice(0, 10)} {ad.storeNameAtEvent}
                </a>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

function AccordionRow({ row, query }: { row: LanePreferenceDto; query: string }) {
  const [open, setOpen] = useState(false);
  const t = labels.lanePreference;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="hover:bg-surface-soft/30 flex w-full items-center justify-between px-6 py-4 text-left transition-colors"
      >
        <div className="flex items-center gap-3">
          <ChevronDown
            size={16}
            className={["text-mute-light transition-transform", open ? "rotate-180" : ""].join(" ")}
          />
          <span className="text-ink font-medium">{row.dealerName}</span>
          {/* 「レーン数」と「候補店舗数」は別の数。まとめて 1 つのバッジにしない。 */}
          <span className="bg-primary/10 text-primary inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums">
            {row.laneCount === null
              ? t.laneCountUnknown
              : t.laneCountBadge.replace("{n}", String(row.laneCount))}
          </span>
          <span className="bg-surface-soft text-mute-light inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums">
            {t.storeCountBadge.replace("{n}", String(row.itemCount))}
          </span>
          {row.laneCount !== null && row.laneCount !== row.laneCountFromItems ? (
            <span className="text-danger text-[11px] font-medium">
              {t.laneCountMismatch
                .replace("{declared}", String(row.laneCount))
                .replace("{actual}", String(row.laneCountFromItems))}
            </span>
          ) : null}
        </div>
        <span className="text-mute-light text-xs tabular-nums">
          {t.submittedAtLabel} {formatSubmittedAt(row.submittedAt)}
        </span>
      </button>

      <div
        className={[
          "grid transition-[grid-template-rows] duration-300 ease-in-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        ].join(" ")}
      >
        <div className="overflow-hidden">
          <div className="border-hairline-light bg-surface-soft/20 space-y-3 border-t px-6 pb-5 pt-4">
            {/* レーンごとにまとめて出す。レーンを跨いで順位だけ並べると、
                どのレーンの第一希望なのか分からなくなる。 */}
            {row.items.length === 0 ? (
              <span className="text-mute-light text-sm">—</span>
            ) : (
              <div className="space-y-4">
                {groupByLane(row.items).map((lane) => (
                  <div key={lane.laneNo} className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <h4 className="text-ink text-sm font-semibold">
                        {t.laneTitle.replace("{n}", String(lane.laneNo))}
                      </h4>
                      <span className="text-mute-light text-xs">{t.laneItemsHint}</span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {lane.items.map((item) => (
                        <PreferenceCard
                          key={`${row.id}-${item.laneNo}-${item.priority}`}
                          item={item}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="text-sm">
              <span className="text-mute-light text-xs">{t.noteLabel}: </span>
              <span className="text-body-light">{row.note ?? t.noNote}</span>
            </div>
            {/* 回答はスレッド付きの詳細画面で行う（提出内容とやり取りを同じ場所で見る）。 */}
            <a
              href={`/lane-preferences/${row.id}${query ? `?${query}` : ""}`}
              className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 items-center rounded-md border px-4 text-sm sm:h-9"
            >
              {t.openDetail}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

interface LanePreferenceAccordionProps {
  rows: LanePreferenceDto[];
  /** いま見ている検索条件。詳細へ引き継ぎ、戻ったときに同じ月へ帰れるようにする。 */
  query?: string;
}

export function LanePreferenceAccordion({ rows, query = "" }: LanePreferenceAccordionProps) {
  return (
    <div className="divide-hairline-light divide-y">
      {rows.map((row) => (
        <AccordionRow key={row.id} row={row} query={query} />
      ))}
    </div>
  );
}
