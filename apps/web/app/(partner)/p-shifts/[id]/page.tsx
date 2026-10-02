// シフト 1 件の詳細。予定と実績を並べて確認できる。
//
// 予定時間はそのまま残し、実績は別に記録する（例: 予定 10:00〜18:00 / 実績 11:00〜17:00）。
// 編集はパートナー管理者のみ。スタッフサイトでは閲覧だけ。

import { attendanceState, formatWorkedDuration, workedMinutes } from "@solar/contracts";
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
import { labels } from "@/lib/i18n/labels";

import { getPartnerShiftDetail } from "../data";
import { hhmm, roleLabel } from "../shift-views";
import { ShiftActualForm, ShiftPlanForm, ShiftUnassignForm } from "./shift-detail-forms";

export const dynamic = "force-dynamic";

const BASE = "/p-shifts";
const t = labels.partner.shift;
const at = labels.partner.attendance;
const c = labels.partner.common;

export default async function ShiftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shift = await getPartnerShiftDetail(id);
  if (!shift) notFound();

  const planned = `${hhmm(shift.startPlanned)}〜${hhmm(shift.endPlanned)}`;
  const actual =
    shift.startActual || shift.endActual
      ? `${hhmm(shift.startActual) ?? "—"}〜${hhmm(shift.endActual) ?? "—"}`
      : t.actualUnset;

  // 勤務状態と勤務時間。未打刻は「未出勤」で、勤務時間を 0 時間にはしない。
  const state = attendanceState(shift);
  const workedLabel =
    state === "WORKING" ? at.state.WORKING : (formatWorkedDuration(workedMinutes(shift)) ?? c.dash);

  return (
    <div>
      <PartnerPageHeader
        title={shift.venuePlace}
        description={`${shift.date} / ${shift.originName}`}
      />

      <PartnerCard className="mb-4">
        <PartnerFieldGrid>
          <PartnerField label={t.columns.date} value={shift.date} />
          <PartnerField label={t.columns.venue} value={shift.venuePlace} />
          <PartnerField label={t.admin.columns.member} value={shift.userName ?? c.dash} />
          <PartnerField label={t.columns.role} value={roleLabel(shift.role)} />
          <PartnerField label={t.planned} value={planned} />
          <PartnerField label={t.actual} value={actual} />
          {/* 勤務時間は出勤から退勤までの経過時間。休憩は控除しない。 */}
          <PartnerField label={at.worked} value={`${workedLabel}（${at.workedNote}）`} />
          <PartnerField label={at.stateLabel} value={at.state[state]} />
        </PartnerFieldGrid>
      </PartnerCard>

      {/* この催事・開催日の日報へ。対象を選び直させない。 */}
      {shift.eventDayId ? (
        <p className="mb-4">
          <Link
            href={`/p-reports/new?eventId=${shift.eventId}&eventDayId=${shift.eventDayId}`}
            className="border-hairline-light text-ink hover:bg-surface-soft inline-flex h-11 items-center justify-center rounded-md border px-4 text-sm font-medium sm:h-9"
          >
            {t.registerReport}
          </Link>
        </p>
      ) : null}

      {shift.isAdmin ? (
        <>
          <PartnerCard className="mb-4">
            <PartnerSection title={t.planForm.title}>
              <ShiftPlanForm shift={shift} />
            </PartnerSection>
          </PartnerCard>

          <PartnerCard className="mb-4">
            <PartnerSection title={t.actualForm.title}>
              <ShiftActualForm shift={shift} />
            </PartnerSection>
          </PartnerCard>

          <PartnerCard className="mb-4">
            <ShiftUnassignForm shiftId={shift.shiftId} />
          </PartnerCard>
        </>
      ) : null}

      <BackToListLink href={BASE} label={c.backToList} />
    </div>
  );
}
