"use client";

// 出店希望の提出フォーム（レーン単位）。
//
// 業務の形をそのまま入力できるようにする:
//   対象月 / 希望レーン数 / レーンごとの希望店舗（第一〜第n希望）/ レーンごとの希望日程 /
//   店舗ごとの個別条件 / 全体コメント。
//
// 「個別条件」は希望順位とは別の軸なので専用の入力欄にする。
// 「いずれか 2 日間を希望」のような条件を第四希望へ読み替えたりはしない。
//
// 希望日程はレーン単位の複数日入力。検索用の「対象月」（1 値のドロップダウン）とは
// 別の入力なので、見出しと説明文で区別する。

import { useState } from "react";

import { PartnerOriginNotice } from "@/components/partner/origin-select";
import {
  FIELD_CLASS,
  PartnerFormActions,
  PartnerFormField,
  TEXTAREA_CLASS,
} from "@/components/partner/partner-form";
import { labels } from "@/lib/i18n/labels";

import { submitPartnerLanePreferenceAction } from "./actions";

import type { LanePreferenceFormData } from "./data";

const t = labels.partner.lanePreference;
const c = labels.partner.common;

interface LaneItemDraft {
  /** 店舗マスタの行。保存値はこれ。名称は代理店側でマスタから解決する。 */
  storeId: string;
  /** 既存提出の表示用（マスタ未選択の古い行でも何を書いたか分かるように残す）。 */
  venueLabel: string;
  conditionNote: string;
  memo: string;
}

interface LaneDraft {
  laneNo: number;
  desiredDates: string;
  items: LaneItemDraft[];
}

function emptyItem(): LaneItemDraft {
  return { storeId: "", venueLabel: "", conditionNote: "", memo: "" };
}

/** 既存の提出内容を入力用の下書きへ。未提出なら 1 レーン × 3 希望の空欄を出す。 */
function initialLanes(data: LanePreferenceFormData): LaneDraft[] {
  const existing = data.existing;
  if (existing && existing.lanes.length > 0) {
    return existing.lanes.map((lane) => ({
      laneNo: lane.laneNo,
      desiredDates: lane.desiredDates.join("\n"),
      items: lane.items.map((i) => ({
        storeId: i.storeId ?? "",
        venueLabel: i.venueLabel,
        conditionNote: i.conditionNote ?? "",
        memo: i.memo ?? "",
      })),
    }));
  }
  // 第一〜第三希望が業務の既定の形なので、空欄を 3 行用意する。
  return [{ laneNo: 1, desiredDates: "", items: [emptyItem(), emptyItem(), emptyItem()] }];
}

export function LanePreferenceForm({ data }: { data: LanePreferenceFormData }) {
  const existing = data.existing;

  const [targetMonth, setTargetMonth] = useState(data.targetMonth);
  const [lanes, setLanes] = useState<LaneDraft[]>(() => initialLanes(data));
  const [laneCount, setLaneCount] = useState(
    String(existing?.laneCount ?? initialLanes(data).length),
  );
  const [note, setNote] = useState(existing?.note ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const updateLane = (index: number, patch: Partial<LaneDraft>) => {
    setLanes((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };
  const updateItem = (laneIndex: number, itemIndex: number, patch: Partial<LaneItemDraft>) => {
    setLanes((prev) =>
      prev.map((l, i) =>
        i === laneIndex
          ? { ...l, items: l.items.map((it, j) => (j === itemIndex ? { ...it, ...patch } : it)) }
          : l,
      ),
    );
  };

  const addLane = () => {
    setLanes((prev) => {
      const nextNo = prev.reduce((max, l) => Math.max(max, l.laneNo), 0) + 1;
      const next = [
        ...prev,
        { laneNo: nextNo, desiredDates: "", items: [emptyItem(), emptyItem(), emptyItem()] },
      ];
      setLaneCount(String(next.length));
      return next;
    });
  };
  const removeLane = (index: number) => {
    setLanes((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setLaneCount(String(Math.max(1, next.length)));
      return next.length > 0 ? next : initialLanes({ ...data, existing: null });
    });
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      // 空欄の希望行は送らない（保存されない行を作らない）。
      const payloadLanes = lanes
        .map((lane) => ({
          laneNo: lane.laneNo,
          desiredDates: lane.desiredDates,
          // 店舗を選んでいない行は送らない（空の希望を作らない）。
          items: lane.items
            .filter((i) => i.storeId.length > 0)
            .map((i) => ({
              storeId: i.storeId,
              conditionNote: i.conditionNote,
              memo: i.memo,
            })),
        }))
        .filter((lane) => lane.items.length > 0);

      if (payloadLanes.length === 0) {
        setMessage(t.errors.needItem);
        setPending(false);
        return;
      }

      await submitPartnerLanePreferenceAction({
        targetMonth,
        // 数値入力は文字列で持っているので送信時に数値へ。
        laneCount: Number(laneCount),
        note,
        lanes: payloadLanes,
      });
      setMessage(t.submitted);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t.errors.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* 依頼先代理店は表示のみ。サーバー側が認証情報と取引関係から確定する。 */}
        <PartnerOriginNotice options={data.originOptions} />

        {/* 検索用の月ではなく「提出の対象月」。希望日程の入力とは別物。 */}
        <PartnerFormField label={t.monthLabel} htmlFor="targetMonth" required>
          <input
            id="targetMonth"
            type="month"
            value={targetMonth}
            onChange={(e) => setTargetMonth(e.target.value)}
            className={FIELD_CLASS}
          />
        </PartnerFormField>

        <PartnerFormField
          label={t.laneCountLabel}
          hint={t.laneCountHint}
          htmlFor="laneCount"
          required
        >
          <input
            id="laneCount"
            type="number"
            min={1}
            max={20}
            value={laneCount}
            onChange={(e) => setLaneCount(e.target.value)}
            className={FIELD_CLASS}
          />
        </PartnerFormField>
      </div>

      {lanes.map((lane, laneIndex) => (
        <section
          key={lane.laneNo}
          className="border-hairline-light rounded-md border p-3 sm:p-4"
          aria-label={t.laneTitle.replace("{n}", String(lane.laneNo))}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-ink text-sm font-semibold">
              {t.laneTitle.replace("{n}", String(lane.laneNo))}
            </h3>
            {lanes.length > 1 ? (
              <button
                type="button"
                onClick={() => removeLane(laneIndex)}
                className="text-mute-light hover:text-danger min-h-11 text-xs sm:min-h-0"
              >
                {t.removeLane}
              </button>
            ) : null}
          </div>

          <div className="space-y-3">
            {lane.items.map((item, itemIndex) => (
              <div key={itemIndex} className="grid gap-2 sm:grid-cols-2">
                <PartnerFormField
                  label={t.priorityLabel.replace("{n}", String(itemIndex + 1))}
                  hint={itemIndex === 0 ? t.venueSelectHint : undefined}
                  htmlFor={`venue-${lane.laneNo}-${itemIndex}`}
                >
                  {/* 希望場所は店舗マスタから選ぶ。自由記述だと、どの店舗を指すのか
                      決まらず「カインズ 大宮店」が別支店に結び付いてしまうため。
                      同名の店舗があっても場所提供元・所在地で見分けられるようにする。 */}
                  <select
                    id={`venue-${lane.laneNo}-${itemIndex}`}
                    value={item.storeId}
                    onChange={(e) => updateItem(laneIndex, itemIndex, { storeId: e.target.value })}
                    className={FIELD_CLASS}
                  >
                    <option value="">{t.venueSelectNone}</option>
                    {data.candidates.map((cand) => (
                      <option key={cand.storeId} value={cand.storeId}>
                        {cand.venueProviderName ? `${cand.venueProviderName} ` : ""}
                        {cand.name}
                        {cand.address ? `（${cand.address}）` : ""}
                      </option>
                    ))}
                  </select>
                  {/* 既存提出でマスタ未選択の行は、提出時の名称を残して何を書いたか分かるようにする。 */}
                  {item.storeId.length === 0 && item.venueLabel.length > 0 ? (
                    <p className="text-mute-light mt-1 text-xs">
                      {t.venueLabelAtSubmit}: {item.venueLabel}
                    </p>
                  ) : null}
                </PartnerFormField>
                <PartnerFormField
                  label={t.conditionNote}
                  hint={itemIndex === 0 ? t.conditionNoteHint : undefined}
                  htmlFor={`cond-${lane.laneNo}-${itemIndex}`}
                >
                  <input
                    id={`cond-${lane.laneNo}-${itemIndex}`}
                    value={item.conditionNote}
                    onChange={(e) =>
                      updateItem(laneIndex, itemIndex, { conditionNote: e.target.value })
                    }
                    className={FIELD_CLASS}
                  />
                </PartnerFormField>
              </div>
            ))}

            <button
              type="button"
              onClick={() => updateLane(laneIndex, { items: [...lane.items, emptyItem()] })}
              className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 items-center rounded-md border px-3 text-sm sm:h-9"
            >
              {t.addPriority}
            </button>

            {/* 希望日程はレーン単位。複数日を指定できる。 */}
            <PartnerFormField
              label={t.laneDesiredDates}
              hint={t.laneDesiredDatesHint}
              htmlFor={`dates-${lane.laneNo}`}
            >
              <textarea
                id={`dates-${lane.laneNo}`}
                value={lane.desiredDates}
                onChange={(e) => updateLane(laneIndex, { desiredDates: e.target.value })}
                className={TEXTAREA_CLASS}
                rows={3}
              />
            </PartnerFormField>
          </div>
        </section>
      ))}

      <button
        type="button"
        onClick={addLane}
        className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 items-center rounded-md border px-3 text-sm sm:h-9"
      >
        {t.addLane}
      </button>

      <PartnerFormField label={t.noteLabel} htmlFor="note">
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={TEXTAREA_CLASS}
          rows={3}
        />
      </PartnerFormField>

      <p className="text-mute-light text-[13px]">{t.replaceNote}</p>
      <PartnerFormActions
        submitLabel={t.submit}
        pending={pending}
        pendingLabel={t.submitting}
        cancelHref="/p-lane-preferences"
        cancelLabel={c.cancel}
        error={message}
      />
    </form>
  );
}
