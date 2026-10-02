// 出店希望の詳細。
//
// 出したもの（レーン・希望順位・希望日程・個別条件）と、代理店からの回答、
// そして確定した開催（場所・日程・担当会社）を 1 画面で確認できるようにする。
// 個別条件は希望順位とは別の列として表示する（順位へ読み替えない）。

import Link from "next/link";
import { notFound } from "next/navigation";

import { BackToListLink } from "@/components/partner/back-to-list-link";
import {
  PartnerCard,
  PartnerField,
  PartnerFieldGrid,
  PartnerPageHeader,
  PartnerSection,
} from "@/components/partner/partner-ui";
import { ThreadPanel } from "@/components/partner/thread-panel";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { postLanePreferenceMessageAction } from "../actions";
import { getPartnerLanePreferenceDetail } from "../data";

export const dynamic = "force-dynamic";

const BASE = "/p-lane-preferences";
const t = labels.partner.lanePreference;
const c = labels.partner.common;

/** 開催体制の表示。EventMode の値域をそのまま日本語にする。 */
const MODE_LABEL: Record<string, string> = {
  SELF: "自社のみ",
  DEALER: "パートナー会社単独",
  JOINT: "共同開催",
  CANCELLED: "中止",
};

export default async function LanePreferenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPartnerLanePreferenceDetail(id);
  if (!data) notFound();

  return (
    <div>
      <PartnerPageHeader
        title={`${t.detailTitle}（${data.targetMonth}）`}
        description={`${t.originLabel}: ${data.originName}`}
        action={
          <Link
            href={`${BASE}/${data.id}/edit`}
            className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 items-center justify-center rounded-md border px-4 text-sm sm:h-9"
          >
            {t.resubmit}
          </Link>
        }
      />

      <PartnerCard className="mb-4">
        <PartnerFieldGrid>
          <PartnerField label={t.monthLabel} value={data.targetMonth} />
          <PartnerField label={t.originLabel} value={data.originName} />
          <PartnerField label={t.laneCountLabel} value={data.laneCount ?? c.dash} />
          <PartnerField label={t.statusLabel} value={t.status[data.status]} />
          <PartnerField label={t.submittedAt} value={formatDateTime(data.submittedAt)} />
          <PartnerField label={t.listColumns.submittedBy} value={data.submittedByName ?? c.dash} />
        </PartnerFieldGrid>
        {data.note ? (
          <p className="text-body-light mt-3 whitespace-pre-wrap break-words text-sm">
            {data.note}
          </p>
        ) : null}
      </PartnerCard>

      {/* 提出内容。レーンごとに希望順位・個別条件・希望日程を並べる。 */}
      {data.lanes.map((lane) => (
        <PartnerCard key={lane.laneNo} className="mb-4">
          <PartnerSection title={t.laneTitle.replace("{n}", String(lane.laneNo))}>
            <ol className="space-y-2">
              {lane.items.map((item) => (
                <li key={item.priority} className="text-sm">
                  <span className="text-mute-light mr-2 text-xs">
                    {t.priorityLabel.replace("{n}", String(item.priority))}
                  </span>
                  <span className="text-ink font-medium">{item.venueLabel}</span>
                  {item.conditionNote ? (
                    <span className="text-body-light mt-0.5 block text-[13px]">
                      {t.conditionNote}: {item.conditionNote}
                    </span>
                  ) : null}
                  {item.memo ? (
                    <span className="text-mute-light mt-0.5 block text-xs">{item.memo}</span>
                  ) : null}
                  {/* 代理店の採用結果。希望と違う店舗なら代替提案として区別して出す。 */}
                  {item.adoptions.map((ad) => (
                    <span
                      key={ad.eventId}
                      className={`mt-0.5 block text-xs ${ad.isAlternative ? "text-warning" : "text-success"}`}
                    >
                      {ad.isAlternative ? t.adoptedAlternative : t.adopted}:{" "}
                      {formatDate(ad.scheduledDate)} {ad.venuePlace}
                    </span>
                  ))}
                </li>
              ))}
            </ol>
            <p className="text-body-light mt-3 text-[13px]">
              {t.laneDesiredDates}:{" "}
              {lane.desiredDates.length > 0
                ? lane.desiredDates.map((d) => formatDate(d)).join("、")
                : c.notSet}
            </p>
          </PartnerSection>
        </PartnerCard>
      ))}

      {/* 確定した開催。代理店が確定した結果を確認する。 */}
      <PartnerCard className="mb-4">
        <PartnerSection title={t.confirmedTitle}>
          <p className="text-mute-light mb-2 text-[13px]">{t.confirmedHint}</p>
          {data.confirmed.length === 0 ? (
            <p className="text-mute-light text-sm">{t.confirmedEmpty}</p>
          ) : (
            <ul className="space-y-3">
              {data.confirmed.map((ev) => (
                <li key={ev.eventId} className="border-hairline-light rounded-md border p-3">
                  <p className="text-ink text-sm font-medium">{ev.venuePlace}</p>
                  <p className="text-body-light mt-1 text-[13px]">
                    {t.confirmedColumns.days}:{" "}
                    {ev.days
                      .map((d) => {
                        const time =
                          d.startAt && d.endAt
                            ? ` ${formatDateTime(d.startAt).slice(-5)}〜${formatDateTime(d.endAt).slice(-5)}`
                            : "";
                        return `${formatDate(d.date)}${time}`;
                      })
                      .join("、")}
                  </p>
                  <p className="text-mute-light mt-0.5 text-xs">
                    {t.confirmedColumns.mode}: {MODE_LABEL[ev.mode] ?? ev.mode} /{" "}
                    {t.confirmedColumns.dealers}: {ev.dealerNames.join("、") || c.dash}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </PartnerSection>
      </PartnerCard>

      <PartnerCard className="mb-4">
        <PartnerSection title={t.threadTitle}>
          <ThreadPanel
            targetId={data.id}
            entries={data.thread}
            post={postLanePreferenceMessageAction}
          />
        </PartnerSection>
      </PartnerCard>

      <BackToListLink href={BASE} label={c.backToList} />
    </div>
  );
}
