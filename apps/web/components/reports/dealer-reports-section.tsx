// イベント詳細の「日報・実績（パートナー会社）」。
//
// これまでパートナー会社の催事日報は独立メニュー（/dealer-reports）でしか見られず、
// 催事とも紐付いていなかった。ここが統合先で、同じ催事の報告を提出会社・提出者・
// 開催日つきで一覧にする。
//
// 合計の出し方は data 側の決め事に従い、画面では「何件を合計に入れ、何件を入れなかったか」
// を必ず一緒に出す。単位が分からない報告を黙って足し込まない。

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { labels } from "@/lib/i18n/labels";

import type { DealerEventReportBundle } from "@/app/(wholesaler)/event-detail/dealer-report-data";

const t = labels.dealerEventReportSection;
const c = labels.common;

function ymd(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "/");
}

export function DealerReportsSection({ bundle }: { bundle: DealerEventReportBundle }) {
  const { rows, summary } = bundle;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-mute-light text-sm">{t.hint}</p>

        {rows.length === 0 ? (
          <p className="text-mute-light text-sm">{t.empty}</p>
        ) : (
          <>
            {/* 集計 — 対象件数と対象外件数を必ず添える。 */}
            <div className="border-hairline-light bg-surface-soft/40 space-y-2 rounded-md border p-3">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-mute-light text-xs">{t.metrics.lottery}</dt>
                  <dd className="text-ink tabular-nums">{summary.lotteryTotal}</dd>
                </div>
                <div>
                  <dt className="text-mute-light text-xs">{t.metrics.seated}</dt>
                  <dd className="text-ink tabular-nums">{summary.seatedTotal}</dd>
                </div>
                <div>
                  <dt className="text-mute-light text-xs">{t.metrics.appointment}</dt>
                  <dd className="text-ink tabular-nums">{summary.apptTotal}</dd>
                </div>
                <div>
                  <dt className="text-mute-light text-xs">{t.metrics.counted}</dt>
                  <dd className="text-ink tabular-nums">
                    {t.metrics.countedValue.replace("{n}", String(summary.countedReports))}
                  </dd>
                </div>
              </dl>
              {/* 合計に入れなかったものは黙って捨てず、理由ごとに件数を出す。 */}
              {summary.unknownScopeReports > 0 ||
              summary.boothReports > 0 ||
              summary.supersededReports > 0 ? (
                <ul className="text-mute-light space-y-0.5 text-xs">
                  {summary.unknownScopeReports > 0 ? (
                    <li>
                      {t.excluded.unknown.replace("{n}", String(summary.unknownScopeReports))}
                    </li>
                  ) : null}
                  {summary.boothReports > 0 ? (
                    <li>{t.excluded.booth.replace("{n}", String(summary.boothReports))}</li>
                  ) : null}
                  {summary.supersededReports > 0 ? (
                    <li>
                      {t.excluded.superseded.replace("{n}", String(summary.supersededReports))}
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>

            {/* 明細 — 原文のまま残す。 */}
            <ul className="divide-hairline-light border-hairline-light divide-y rounded-md border">
              {rows.map((r) => (
                <li key={r.id} className="space-y-1 p-3 text-sm">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-ink font-medium">{r.companyName}</span>
                    <span className="text-mute-light text-xs tabular-nums">
                      {ymd(r.eventDayDate ?? r.eventDate)} {r.startTime}–{r.endTime}
                    </span>
                    <span className="text-mute-light text-xs">{t.scopeLabels[r.scope]}</span>
                    {r.supersededByReportId ? (
                      <span className="text-warning text-xs">{t.supersededBadge}</span>
                    ) : null}
                  </div>
                  <div className="text-body-light text-xs">
                    {t.submitter}: {r.submitterName ?? c.notSet} / {t.areaInFacility}:{" "}
                    {r.areaInFacility}
                  </div>
                  <dl className="flex flex-wrap gap-x-4 text-xs tabular-nums">
                    <span>
                      {t.metrics.lottery} {r.lotteryTotal}
                    </span>
                    <span>
                      {t.metrics.seated} {r.seatedTotal}
                    </span>
                    <span>
                      {t.metrics.appointment} {r.apptTotal}
                    </span>
                  </dl>
                  {r.impression ? (
                    <p className="text-body-light whitespace-pre-line break-words text-xs">
                      {r.impression}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
