// 二次店ポータル：催事日報のデータローダー。
//
// 合計値（抽選数 / 着座数 / アポ数）は保存していないので、ここで
// dealerReportTotals() を通して算出する。画面側で足し直さない。

import "server-only";

import { dealerReportTotals } from "@solar/contracts";

import { requirePartnerContext } from "@/lib/partner/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

export interface PartnerReportListItem {
  id: string;
  eventDate: string;
  venuePlace: string;
  venueChain: string;
  apptTotal: number;
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
  createdAt: string;
}

export async function listPartnerReports(): Promise<PartnerReportListItem[]> {
  const partner = await requirePartnerContext("partner_event_report.read");
  return withTenant(partner.ctx, async (tx) => {
    const rows = await tx.dealerEventReport.findMany({
      where: { relationshipId: partner.relationshipId },
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        eventDate: true,
        venuePlace: true,
        venueChain: true,
        apptBoth: true,
        apptSingle: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      eventDate: r.eventDate.toISOString(),
      venuePlace: r.venuePlace,
      venueChain: r.venueChain,
      apptTotal: r.apptBoth + r.apptSingle,
    }));
  });
}

export async function getPartnerReport(id: string): Promise<PartnerReportDetail | null> {
  const partner = await requirePartnerContext("partner_event_report.read");
  return withTenant(partner.ctx, async (tx) => {
    // relationshipId を where に含める（id だけで引かない）。
    const r = await tx.dealerEventReport.findFirst({
      where: { id, relationshipId: partner.relationshipId },
    });
    if (!r) return null;
    const totals = dealerReportTotals(r);
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
      createdAt: r.createdAt.toISOString(),
    };
  });
}
