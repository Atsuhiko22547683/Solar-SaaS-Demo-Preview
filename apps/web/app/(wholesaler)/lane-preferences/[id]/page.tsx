// 代理店側：出店希望 1 件の詳細と回答。
//
// パートナー会社が出したレーン・希望順位・希望日程・個別条件を見て、その場で回答する。
// 回答は提出に紐づくスレッドへ積むので、あとから「何を出して何と答えたか」を追える。
// 開催場所・日程・担当会社の確定そのものは催事側（イベント候補 → 開催体制決定）で行う。

import Link from "next/link";
import { notFound } from "next/navigation";

import { ThreadPanel } from "@/components/partner/thread-panel";
import { labels } from "@/lib/i18n/labels";

import { AdoptionPanel } from "../adoption-panel";
import { answerLanePreferenceAction } from "../answer-actions";
import { getAgencyLanePreference, listAdoptableEvents } from "../answer-data";

export const dynamic = "force-dynamic";

const t = labels.partner.lanePreference;
const c = labels.partner.common;
const a = labels.lanePreference;

export default async function AgencyLanePreferenceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; relationshipId?: string }>;
}) {
  const { id } = await params;
  // 一覧の検索条件を引き継ぐ。戻ったときに別の月へ飛ばさない。
  const sp = await searchParams;
  const backQuery = new URLSearchParams();
  if (sp.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month)) backQuery.set("month", sp.month);
  if (sp.relationshipId) backQuery.set("relationshipId", sp.relationshipId);
  const backHref = backQuery.toString()
    ? `/lane-preferences?${backQuery.toString()}`
    : "/lane-preferences";
  const data = await getAgencyLanePreference(id);
  if (!data) notFound();

  // 採用先の候補は「対象月に開催が決まったイベント」だけ。候補のままの行は出さない。
  const adoptable = await listAdoptableEvents(data.targetMonth);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold">
          {data.dealerName} / {data.targetMonth}
        </h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {t.statusLabel}: {t.status[data.status]} / {t.laneCountLabel}: {data.laneCount ?? c.dash}
        </p>
      </div>

      {data.note ? (
        <p className="bg-muted/40 whitespace-pre-wrap rounded-md p-3 text-sm">{data.note}</p>
      ) : null}

      {data.lanes.map((lane) => (
        <section key={lane.laneNo} className="rounded-md border p-3">
          <h2 className="text-sm font-semibold">
            {t.laneTitle.replace("{n}", String(lane.laneNo))}
          </h2>
          <ol className="mt-2 space-y-1.5">
            {lane.items.map((item) => (
              <li
                key={item.id}
                className="border-hairline-light border-t pt-2 text-sm first:border-t-0 first:pt-0"
              >
                <span className="text-muted-foreground mr-2 text-xs">
                  {t.priorityLabel.replace("{n}", String(item.priority))}
                </span>
                <span className="font-medium">{item.venueLabel}</span>
                {/* 店舗マスタに紐付いているときだけ、店舗と場所提供元を出す。
                    紐付きの無い明細で提供元名を出すと、ラベルと無関係な提供元が並ぶ。 */}
                {item.storeId ? (
                  <span className="text-muted-foreground mt-0.5 block text-[13px]">
                    {a.card.store}: {item.storeName ?? c.dash}
                    {item.venueProviderName ? (
                      <span>
                        {" / "}
                        {a.card.venueProvider}: {item.venueProviderName}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-muted-foreground mt-0.5 block text-[13px]">
                    {a.storeUnlinked}
                  </span>
                )}
                {/* 個別条件は希望順位とは別の軸。順位へ読み替えず、そのまま出す。 */}
                {item.conditionNote ? (
                  <span className="text-muted-foreground mt-0.5 block text-[13px]">
                    {t.conditionNote}: {item.conditionNote}
                  </span>
                ) : null}
                <AdoptionPanel
                  itemId={item.id}
                  storeId={item.storeId}
                  adoptions={item.adoptions}
                  options={adoptable}
                  targetMonth={data.targetMonth}
                />
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground mt-2 text-[13px]">
            {t.laneDesiredDates}:{" "}
            {lane.desiredDates.length > 0 ? lane.desiredDates.join("、") : c.notSet}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">{a.adoptionHint}</p>
        </section>
      ))}

      <section className="rounded-md border p-3">
        <h2 className="mb-2 text-sm font-semibold">{t.threadTitle}</h2>
        <ThreadPanel targetId={data.id} entries={data.thread} post={answerLanePreferenceAction} />
      </section>

      <Link href={backHref} className="text-primary text-sm underline-offset-4 hover:underline">
        {c.backToList}
      </Link>
    </div>
  );
}
