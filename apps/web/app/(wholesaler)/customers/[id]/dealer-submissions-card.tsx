// 顧客詳細に出す「パートナー会社からの提出」（代理店-01 の統合先）。
//
// 訪問アポ報告と成約報告を、提出会社・提出日時つきで並べる。
// 成約報告は正式契約とは別物なので、金額・粗利はここに出さない（そもそも持っていない）。

import { Card } from "@/components/ui/card";
import { labels } from "@/lib/i18n/labels";

import type { CustomerDealerSubmissions } from "./dealer-submission-data";

const t = labels.customerDealerSubmissions;
const c = labels.common;

function ymd(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, "/");
}

export function DealerSubmissionsCard({ data }: { data: CustomerDealerSubmissions }) {
  const empty = data.visits.length === 0 && data.contracts.length === 0;

  return (
    <Card className="p-5">
      <h2 className="text-ink mb-1 text-sm font-semibold">{t.title}</h2>
      <p className="text-mute-light mb-3 text-xs">{t.hint}</p>

      {empty ? (
        <p className="text-mute-light text-sm">{t.empty}</p>
      ) : (
        <div className="space-y-4">
          {data.visits.length > 0 ? (
            <section className="space-y-1.5">
              <h3 className="text-mute-light text-xs font-semibold">{t.visitTitle}</h3>
              <ul className="divide-hairline-light border-hairline-light divide-y rounded-md border">
                {data.visits.map((v) => (
                  <li key={v.id} className="space-y-0.5 p-2.5 text-sm">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <span className="text-ink font-medium">{v.companyName}</span>
                      <span className="text-mute-light text-xs tabular-nums">
                        {t.submittedAt}: {ymd(v.createdAt)}
                      </span>
                    </div>
                    <div className="text-body-light text-xs">
                      {t.fields.tossDept}: {v.tossDept} / {t.fields.closeDept}: {v.closeDept} /{" "}
                      {t.fields.salesRep}: {v.salespersonName ?? c.notSet}
                    </div>
                    <div className="text-mute-light text-xs">
                      {t.fields.maekakuOperator}: {v.maekakuOperator}
                      {v.appointmentId ? ` / ${t.linkedAppointment}` : ` / ${t.noAppointment}`}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {data.contracts.length > 0 ? (
            <section className="space-y-1.5">
              <h3 className="text-mute-light text-xs font-semibold">{t.contractTitle}</h3>
              {/* 成約報告とステータス変更・正式契約は別物であることを画面に出す。 */}
              <p className="text-mute-light text-xs">{t.contractNote}</p>
              <ul className="divide-hairline-light border-hairline-light divide-y rounded-md border">
                {data.contracts.map((cr) => (
                  <li key={cr.id} className="space-y-0.5 p-2.5 text-sm">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <span className="text-ink font-medium">{cr.companyName}</span>
                      <span className="text-mute-light text-xs tabular-nums">
                        {t.fields.contractDate}: {ymd(cr.contractDate)}
                      </span>
                    </div>
                    <div className="text-body-light text-xs">
                      {t.fields.salesRep}: {cr.salesRep} / {t.fields.referralBranch}:{" "}
                      {cr.referralBranch} / {t.fields.tossDate}: {ymd(cr.tossDate)}
                    </div>
                    <div className="text-mute-light text-xs">
                      {cr.contractId ? t.linkedContract : t.noContract}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </Card>
  );
}
