"use client";

// 出店希望の明細を、確定したイベントへ「採用」として結び付ける操作。
//
// ここで作るのは対応付けの記録だけで、開催の確定やスタッフ割当は行わない
// （それらはイベント側の決定操作のまま）。1 明細が複数イベント・複数日程に
// 対応しうるので、採用は 1 件ずつ足していける。

import { useState, useTransition } from "react";

import { labels } from "@/lib/i18n/labels";

import {
  adoptLanePreferenceItemAction,
  withdrawLanePreferenceAdoptionAction,
} from "./answer-actions";

import type { AgencyAdoptionView } from "./answer-data";

const t = labels.lanePreference;
const c = labels.common;

/** 採用先として選べる確定イベント（対象月ぶん）。 */
export interface AdoptableEventOption {
  eventId: string;
  eventCandidateId: string;
  storeName: string;
  storeId: string | null;
  scheduledDate: string;
}

export function AdoptionPanel({
  itemId,
  storeId,
  adoptions,
  options,
  targetMonth,
}: {
  itemId: string;
  /** この明細が希望している店舗。採用した催事と違えば代替提案として出す。 */
  storeId: string | null;
  adoptions: AgencyAdoptionView[];
  options: AdoptableEventOption[];
  targetMonth: string;
}) {
  const [eventId, setEventId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: true }>) {
    setMessage(null);
    start(async () => {
      try {
        await fn();
        setEventId("");
      } catch (err) {
        setMessage(err instanceof Error ? err.message : c.unknownError);
      }
    });
  }

  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-mute-light text-xs font-semibold">{t.adoptionTitle}</p>
      {adoptions.length === 0 ? (
        <p className="text-mute-light text-xs">{t.adoptionEmpty}</p>
      ) : (
        <ul className="space-y-1">
          {adoptions.map((ad) => (
            <li key={ad.eventId} className="flex flex-wrap items-center gap-2 text-xs">
              <a
                href={`/event-detail/${ad.eventCandidateId}`}
                className="text-link-light underline underline-offset-2"
              >
                {ad.scheduledDate.slice(0, 10)} {ad.storeNameAtEvent}
              </a>
              {/* 希望した店舗と違う催事に採用した場合は、代替提案と分かるようにする。 */}
              {storeId && ad.eventStoreId !== storeId ? (
                <span className="text-warning">{t.adoptionAlternative}</span>
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => withdrawLanePreferenceAdoptionAction({ itemId, eventId: ad.eventId }))
                }
                className="border-hairline-light text-mute-light hover:bg-surface-soft rounded border px-2 py-0.5"
              >
                {t.adoptionWithdraw}
              </button>
            </li>
          ))}
        </ul>
      )}

      {options.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`adopt-${itemId}`} className="sr-only">
            {t.adoptionSelect}
          </label>
          <select
            id={`adopt-${itemId}`}
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="border-hairline-light h-9 rounded-md border bg-white px-2 text-xs"
          >
            <option value="">{t.adoptionSelect}</option>
            {options.map((o) => (
              <option key={o.eventId} value={o.eventId}>
                {o.scheduledDate.slice(0, 10)} {o.storeName}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || eventId.length === 0}
            onClick={() => run(() => adoptLanePreferenceItemAction({ itemId, eventId }))}
            className="bg-primary h-9 rounded-md px-3 text-xs font-medium text-white disabled:opacity-60"
          >
            {pending ? c.saving : t.adoptionSubmit}
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-mute-light text-xs">{t.adoptionNoEvents}</p>
          {/* 対象月の確定イベントがまだ無い場合は、既存のイベント登録導線へ送る。
              ここで催事を勝手に作らない（開催の決定は催事側の操作のまま）。 */}
          <a
            href={`/events?from=${targetMonth}-01&to=${targetMonth}-31`}
            className="text-link-light text-xs underline underline-offset-2"
          >
            {t.adoptionCreateEvent}
          </a>
        </div>
      )}

      {message ? (
        <p role="alert" className="text-danger text-xs">
          {message}
        </p>
      ) : null}
    </div>
  );
}
