// 催事に紐づくパートナー会社の催事日報（代理店-01 の統合先）。
//
// これまで DealerEventReport は催事と関連付いておらず（eventDate と venuePlace の
// 自由記述しか無かった）、独立メニューからしか見えなかった。eventId / eventDayId を
// 足したので、イベント詳細の「日報・実績」から同じデータを見る。
//
// 集計の決め事（水増しを作らないため）:
//  - 訂正・再提出（supersedesReportId で繋がる）は、連鎖の末尾だけを対象にする。
//  - 集計単位（reportScope）が UNKNOWN の行は合計に混ぜない。既存フォームが単位を
//    聞いていなかったため、個人の実績なのかブース全体なのか判定できない。
//    件数だけを「集計対象外」として出し、原文は一覧に残す。
//  - BOOTH（ブース全体）は複数社が同じ数値を出しうるので、COMPANY / PERSON とは
//    別立てで出す。単純合計に混ぜない。

import "server-only";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { DealerReportScope, Prisma, TxClient } from "@solar/db";

export interface DealerEventReportRow {
  id: string;
  eventDate: string;
  venuePlace: string;
  areaInFacility: string;
  startTime: string;
  endTime: string;
  /** 提出したパートナー会社。 */
  companyName: string;
  /** 提出者。 */
  submitterName: string | null;
  scope: DealerReportScope;
  /** どの開催日についての報告か（複数日開催のとき）。 */
  eventDayDate: string | null;
  lotteryTotal: number;
  seatedTotal: number;
  apptTotal: number;
  impression: string | null;
  createdAt: string;
  /** 別の報告に差し替えられている（＝集計対象外）。 */
  supersededByReportId: string | null;
}

export interface DealerEventReportSummary {
  /** 個人・会社単位の合計（ブース全体と単位不明は含めない）。 */
  lotteryTotal: number;
  seatedTotal: number;
  apptTotal: number;
  /** 合計に入れた報告の件数。 */
  countedReports: number;
  /** 単位が不明で合計に入れなかった件数。 */
  unknownScopeReports: number;
  /** ブース全体として別に出す件数（複数社が同じ数値を出しうるので合算しない）。 */
  boothReports: number;
  /** 訂正で差し替えられて対象外にした件数。 */
  supersededReports: number;
}

export interface DealerEventReportBundle {
  rows: DealerEventReportRow[];
  summary: DealerEventReportSummary;
}

/** 合計の決め事（上のコメント）をここ 1 か所に置く。 */
function summarize(rows: DealerEventReportRow[]): DealerEventReportSummary {
  const summary: DealerEventReportSummary = {
    lotteryTotal: 0,
    seatedTotal: 0,
    apptTotal: 0,
    countedReports: 0,
    unknownScopeReports: 0,
    boothReports: 0,
    supersededReports: 0,
  };
  for (const r of rows) {
    if (r.supersededByReportId) {
      summary.supersededReports += 1;
      continue;
    }
    if (r.scope === "BOOTH") {
      summary.boothReports += 1;
      continue;
    }
    if (r.scope === "UNKNOWN") {
      summary.unknownScopeReports += 1;
      continue;
    }
    summary.lotteryTotal += r.lotteryTotal;
    summary.seatedTotal += r.seatedTotal;
    summary.apptTotal += r.apptTotal;
    summary.countedReports += 1;
  }
  return summary;
}

async function requireEventReadCtx() {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError({
      code: "INVALID_CREDENTIALS",
      message: "Session missing — sign in is required",
    });
  }
  const ctx = await getTenantContext();
  assertCan({
    user: {
      userId: ctx.actorUserId,
      roles: session.user.roles,
      isSaasAdmin: ctx.isSaasAdmin,
      tenantId: ctx.tenantId,
      wholesalerId: ctx.wholesalerId,
      dealerId: ctx.dealerId,
      relationshipIds: ctx.relationshipIds,
    },
    action: "dealer_event_report.read",
  });
  return ctx;
}

/**
 * 渡された条件のパートナー日報を読み、同じ決め事で集計する。
 *
 * where は呼び出し側が組むが、withTenant の中で実行するので RLS と
 * Prisma extension のテナント条件は必ず掛かる。
 */
async function loadReportBundle(
  tx: TxClient,
  where: Prisma.DealerEventReportWhereInput,
): Promise<DealerEventReportBundle> {
  {
    const rows = await tx.dealerEventReport.findMany({
      where,
      orderBy: [{ eventDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        eventDate: true,
        venuePlace: true,
        areaInFacility: true,
        startTime: true,
        endTime: true,
        reportScope: true,
        lotteryBoth: true,
        lotterySingle: true,
        seatedBoth: true,
        seatedSingle: true,
        apptBoth: true,
        apptSingle: true,
        impression: true,
        createdAt: true,
        createdByUserId: true,
        relationship: { select: { dealer: { select: { name: true } } } },
        eventDay: { select: { eventDate: true } },
        supersededBy: { select: { id: true } },
      },
    });

    const submitterIds = [...new Set(rows.map((r) => r.createdByUserId))];
    const submitters =
      submitterIds.length > 0
        ? await tx.user.findMany({
            where: { id: { in: submitterIds } },
            select: { id: true, name: true },
          })
        : [];
    const nameById = new Map(submitters.map((u) => [u.id, u.name]));

    const mapped: DealerEventReportRow[] = rows.map((r) => ({
      id: r.id,
      eventDate: r.eventDate.toISOString(),
      venuePlace: r.venuePlace,
      areaInFacility: r.areaInFacility,
      startTime: r.startTime,
      endTime: r.endTime,
      companyName: r.relationship.dealer.name,
      submitterName: nameById.get(r.createdByUserId) ?? null,
      scope: r.reportScope,
      eventDayDate: r.eventDay?.eventDate.toISOString() ?? null,
      // 合計は保存せず、両面 + 片面から出す（保存値と表示値の二重管理を作らない）。
      lotteryTotal: r.lotteryBoth + r.lotterySingle,
      seatedTotal: r.seatedBoth + r.seatedSingle,
      apptTotal: r.apptBoth + r.apptSingle,
      impression: r.impression,
      createdAt: r.createdAt.toISOString(),
      supersededByReportId: r.supersededBy?.id ?? null,
    }));

    const summary = summarize(mapped);

    return { rows: mapped, summary };
  }
}

/** 1 催事ぶんのパートナー日報と、その集計。 */
export async function getDealerEventReportsForEvent(
  eventId: string,
): Promise<DealerEventReportBundle> {
  const ctx = await requireEventReadCtx();
  return withTenant(ctx, (tx) => loadReportBundle(tx, { eventId }));
}

/**
 * レーン催事（LineEvent）の開催日ごとのパートナー日報。
 *
 * LineEvent は「その月にこの会場のレーンを押さえた」という枠で、開催日そのものは
 * scheduledDates に持つだけの計画上の入れ物。日報が紐付くのは実際に立てた催事
 * （Event / EventDay）なので、
 *
 *   LineEvent ← LanePreferenceItem.lineEventId → その希望の採用 → Event
 *
 * を辿って、このレーンの枠で確定した催事を集め、その日報を開催日で束ねて返す。
 * 会場名や日付が近いだけの行は拾わない（別の催事の実績を混ぜないため）。
 * 辿れる催事が無ければ空を返す。表示のために数値を作らない。
 */
export async function getDealerEventReportsForLineEvent(
  lineEventId: string,
): Promise<Record<string, DealerEventReportBundle>> {
  const ctx = await requireEventReadCtx();
  return withTenant(ctx, async (tx) => {
    const adoptions = await tx.lanePreferenceAdoption.findMany({
      where: { item: { lineEventId } },
      select: { eventId: true },
    });
    const eventIds = [...new Set(adoptions.map((a) => a.eventId))];
    if (eventIds.length === 0) return {};

    const bundle = await loadReportBundle(tx, { eventId: { in: eventIds } });

    // 開催日ごとに束ね直す。集計もその日ぶんで取り直す（全体の合計を日に按分しない）。
    const byDate = new Map<string, typeof bundle.rows>();
    for (const r of bundle.rows) {
      const key = (r.eventDayDate ?? r.eventDate).slice(0, 10);
      const cur = byDate.get(key) ?? [];
      cur.push(r);
      byDate.set(key, cur);
    }
    const out: Record<string, DealerEventReportBundle> = {};
    for (const [date, rows] of byDate) out[date] = { rows, summary: summarize(rows) };
    return out;
  });
}
