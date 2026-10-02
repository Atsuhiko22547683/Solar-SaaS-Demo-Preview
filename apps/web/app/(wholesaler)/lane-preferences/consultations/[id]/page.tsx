// 代理店側：場所確保の相談の詳細と返信。

import Link from "next/link";
import { notFound } from "next/navigation";

import { ThreadPanel } from "@/components/partner/thread-panel";
import { labels } from "@/lib/i18n/labels";

import { replyVenueConsultationAction } from "../../answer-actions";
import { getAgencyConsultation } from "../../answer-data";

export const dynamic = "force-dynamic";

const t = labels.partner.consultation;
const c = labels.partner.common;

export default async function AgencyConsultationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getAgencyConsultation(id);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold">{data.title}</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {data.dealerName} / {t.columns.area}: {data.area ?? c.dash} / {t.columns.targetMonth}:{" "}
          {data.targetMonth ?? c.dash} / {t.status[data.status]}
        </p>
      </div>

      <section className="rounded-md border p-3">
        <h2 className="mb-2 text-sm font-semibold">{labels.partner.lanePreference.threadTitle}</h2>
        <ThreadPanel targetId={data.id} entries={data.thread} post={replyVenueConsultationAction} />
      </section>

      <Link
        href="/lane-preferences/consultations"
        className="text-primary text-sm underline-offset-4 hover:underline"
      >
        {c.backToList}
      </Link>
    </div>
  );
}
