// 二次店ポータル：催事日報のデータローダー。
//
// 合計値（抽選数 / 着座数 / アポ数）は保存していないので、ここで
// dealerReportTotals() を通して算出する。画面側で足し直さない。

import "server-only";

import { dealerReportTotals } from "@solar/contracts";

import {
  listDealerUserOptions,
  resolveUserNames,
  submittedByWhere,
  type DealerUserOption,
} from "@/lib/partner/admin";
import { requirePartnerContext } from "@/lib/partner/context";
import {
  comparator,
  dateOnlyBounds,
  hasBounds,
  paginate,
  type SortValue,
} from "@/lib/partner/list-query";
import { relationshipScope } from "@/lib/partner/scope";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { ReportListQuery } from "./query";
import type { Prisma } from "@solar/db";

export interface PartnerReportListItem {
  id: string;
  eventDate: string;
  venuePlace: string;
  category: string;
  venueChain: string;
  lotteryTotal: number;
  seatedTotal: number;
  apptTotal: number;
  /** 提出したスタッフ。管理者向けの列・並べ替えに使う。 */
  submitterName: string | null;
  createdAt: string;
}

export interface PartnerReportListResult {
  rows: PartnerReportListItem[];
  total: number;
  page: number;
  pageCount: number;
  /** 管理者のときだけ true。列・条件の出し分けに使う。 */
  isAdmin: boolean;
  /** 提出スタッフの選択肢（管理者のみ。スタッフには空配列）。 */
  staffOptions: DealerUserOption[];
}

export interface PartnerReportDetail {
  id: string;
  eventDate: string;
  venuePlace: string;
  category: string;
  venueChain: string;
  areaInFacility: string;
  startTime: string;
  endTime: string;
  lotteryBoth: number;
  lotterySingle: number;
  seatedBoth: number;
  seatedSingle: number;
  apptBoth: number;
  apptSingle: number;
  lotteryTotal: number;
  seatedTotal: number;
  apptTotal: number;
  cainzPayCount: number | null;
  impression: string | null;
  /** 提出したスタッフ。管理者向けの表示のみ（スタッフ本人には出さない）。 */
  submitterName: string | null;
  createdAt: string;
  /** どの催事のどの開催日の記録か。訂正で引き継ぐ。 */
  eventId: string | null;
  eventDayId: string | null;
  /** 数値の集計単位。訂正で引き継ぐ。 */
  reportScope: string;
  /** これが訂正なら訂正元。 */
  supersedesReportId: string | null;
  /** この日報を訂正した日報。ある間は集計の対象外。 */
  supersededByReportId: string | null;
}

/**
 * 一覧。権限による対象限定と絞り込みは DB で行い、合計値（算出値）で並べ替えられる
 * よう並べ替えとページ分割はメモリ上で行う（対象は本人 / 自社の行に限られる）。
 */
export async function listPartnerReports(q: ReportListQuery): Promise<PartnerReportListResult> {
  const partner = await requirePartnerContext("partner_event_report.read");
  const isAdmin = partner.role === "ADMIN";
  return withTenant(partner.ctx, async (tx) => {
    const eventBounds = dateOnlyBounds(q.eventDate);
    const where: Prisma.DealerEventReportWhereInput = {
      ...relationshipScope(partner),
      ...submittedByWhere(partner, q.submittedBy),
      ...(hasBounds(eventBounds) ? { eventDate: eventBounds } : {}),
      ...(q.venuePlace ? { venuePlace: { contains: q.venuePlace, mode: "insensitive" } } : {}),
      ...(q.category ? { category: q.category } : {}),
      ...(q.venueChain ? { venueChain: q.venueChain } : {}),
      ...(q.areaInFacility
        ? { areaInFacility: { contains: q.areaInFacility, mode: "insensitive" } }
        : {}),
    };
    const rows = await tx.dealerEventReport.findMany({
      where,
      select: {
        id: true,
        eventDate: true,
        venuePlace: true,
        category: true,
        venueChain: true,
        lotteryBoth: true,
        lotterySingle: true,
        seatedBoth: true,
        seatedSingle: true,
        apptBoth: true,
        apptSingle: true,
        createdByUserId: true,
        createdAt: true,
      },
    });
    // 提出者の氏名は同じトランザクション内でまとめて引く（RLS が自テナントに絞る）。
    const [names, staffOptions] = await Promise.all([
      isAdmin
        ? resolveUserNames(
            tx,
            rows.map((r) => r.createdByUserId),
          )
        : Promise.resolve(null),
      isAdmin ? listDealerUserOptions(tx, partner) : Promise.resolve([]),
    ]);
    const items: PartnerReportListItem[] = rows.map((r) => {
      const totals = dealerReportTotals(r);
      return {
        id: r.id,
        eventDate: r.eventDate.toISOString(),
        venuePlace: r.venuePlace,
        category: r.category,
        venueChain: r.venueChain,
        lotteryTotal: totals.lotteryTotal,
        seatedTotal: totals.seatedTotal,
        apptTotal: totals.apptTotal,
        submitterName: names?.get(r.createdByUserId) ?? null,
        createdAt: r.createdAt.toISOString(),
      };
    });
    const pick = (r: PartnerReportListItem): SortValue => r[q.sort.field];
    items.sort(comparator(pick, q.sort.direction));
    return { ...paginate(items, q.page), isAdmin, staffOptions };
  });
}

export async function getPartnerReport(id: string): Promise<PartnerReportDetail | null> {
  const partner = await requirePartnerContext("partner_event_report.read");
  return withTenant(partner.ctx, async (tx) => {
    // relationshipId を where に含める（id だけで引かない）。
    const r = await tx.dealerEventReport.findFirst({
      where: { id, ...relationshipScope(partner) },
      include: { supersededBy: { select: { id: true } } },
    });
    if (!r) return null;
    const totals = dealerReportTotals(r);
    const names = partner.role === "ADMIN" ? await resolveUserNames(tx, [r.createdByUserId]) : null;
    return {
      id: r.id,
      eventDate: r.eventDate.toISOString(),
      venuePlace: r.venuePlace,
      category: r.category,
      venueChain: r.venueChain,
      areaInFacility: r.areaInFacility,
      startTime: r.startTime,
      endTime: r.endTime,
      lotteryBoth: r.lotteryBoth,
      lotterySingle: r.lotterySingle,
      seatedBoth: r.seatedBoth,
      seatedSingle: r.seatedSingle,
      apptBoth: r.apptBoth,
      apptSingle: r.apptSingle,
      ...totals,
      cainzPayCount: r.cainzPayCount,
      impression: r.impression,
      submitterName: names?.get(r.createdByUserId) ?? null,
      createdAt: r.createdAt.toISOString(),
      eventId: r.eventId,
      eventDayId: r.eventDayId,
      reportScope: r.reportScope,
      supersedesReportId: r.supersedesReportId,
      supersededByReportId: r.supersededBy?.id ?? null,
    };
  });
}

/**
 * 日報を紐付けられる催事（自社が担当している開催）。
 *
 * 担当していない催事は出さない。候補にも出さないし、サーバー側でも弾く
 * （actions.ts の resolveReportEventLink）。
 */
export async function listPartnerLinkableEvents(limit = 100): Promise<
  Array<{
    eventId: string;
    label: string;
    venuePlace: string;
    days: Array<{ eventDayId: string; date: string; label: string }>;
  }>
> {
  const partner = await requirePartnerContext("partner_event_report.write");
  return withTenant(partner.ctx, async (tx) => {
    const rows = await tx.event.findMany({
      where: { dealers: { some: { relationshipId: { in: partner.relationshipIds } } } },
      orderBy: { eventCandidate: { scheduledDate: "desc" } },
      take: limit,
      select: {
        id: true,
        eventCandidate: { select: { storeName: true, scheduledDate: true } },
        // 複数日開催はどの日の日報かを選ばせるので、開催日も一緒に返す。
        days: { orderBy: { eventDate: "asc" }, select: { id: true, eventDate: true } },
      },
    });
    return rows.map((r) => {
      const venuePlace = r.eventCandidate.storeName;
      return {
        eventId: r.id,
        venuePlace,
        label: `${r.eventCandidate.scheduledDate.toISOString().slice(0, 10)} ${venuePlace}`,
        days: r.days.map((d) => {
          const date = d.eventDate.toISOString().slice(0, 10);
          return { eventDayId: d.id, date, label: `${date} / ${venuePlace}` };
        }),
      };
    });
  });
}
