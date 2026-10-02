// E2E が作った行の後片付け。
//
// Playwright の spec は実行ごとに乱数つきの名前で顧客・催事・日報を作るので、
// 何度も回すと確認用 DB が膨らんで画面間の関連が追えなくなる。
// 実行後にここで片付けて、確認用 DB を最小デモの状態に戻せるようにする。
//
// シードが作る行（基本シード・旧デモシード・最小デモ）は触らない。
// 由来不明の行も触らず、件数だけ出す。
//
// 実行: pnpm demo:purge-e2e  /  Playwright の globalTeardown から自動実行

import "./seed-env.js";

import { PrismaClient } from "@prisma/client";

import { classifyOrigin, E2E_PURGEABLE, type DataOrigin } from "./demo-data-origin.js";

const prisma = new PrismaClient();

function assertLocalDb(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    throw new Error("E2E の後片付けはローカル DB でのみ実行します");
  }
  return url;
}

const isE2E = (input: { id?: string | null; name?: string | null }): boolean =>
  E2E_PURGEABLE.includes(classifyOrigin(input) as DataOrigin);

export async function purgeE2eData(): Promise<Record<string, number>> {
  assertLocalDb();
  const out: Record<string, number> = {};

  // --- 顧客に連なるもの ---------------------------------------------------
  const customers = await prisma.customer.findMany({ select: { id: true, name: true } });
  const custIds = customers.filter((c) => isE2E(c)).map((c) => c.id);
  if (custIds.length > 0) {
    const contracts = await prisma.contract.findMany({
      where: { customerId: { in: custIds } },
      select: { id: true },
    });
    const contractIds = contracts.map((r) => r.id);
    if (contractIds.length > 0) {
      await prisma.incentiveAdjustment.deleteMany({
        where: { incentive: { contractId: { in: contractIds } } },
      });
      await prisma.incentive.deleteMany({ where: { contractId: { in: contractIds } } });
      await prisma.grossProfit.deleteMany({ where: { contractId: { in: contractIds } } });
      await prisma.application.deleteMany({ where: { contractId: { in: contractIds } } });
      await prisma.construction.deleteMany({ where: { contractId: { in: contractIds } } });
      await prisma.contractCancellation.deleteMany({ where: { contractId: { in: contractIds } } });
      await prisma.contractCost.deleteMany({ where: { contractId: { in: contractIds } } });
      await prisma.contractEquipment.deleteMany({ where: { contractId: { in: contractIds } } });
      await prisma.contractPayment.deleteMany({ where: { contractId: { in: contractIds } } });
      await prisma.contractItem.deleteMany({ where: { contractId: { in: contractIds } } });
      await prisma.dealerContractReport.updateMany({
        where: { contractId: { in: contractIds } },
        data: { contractId: null },
      });
      await prisma.contract.deleteMany({ where: { id: { in: contractIds } } });
    }
    const appts = await prisma.appointment.findMany({
      where: { customerId: { in: custIds } },
      select: { id: true },
    });
    const apptIds = appts.map((r) => r.id);
    if (apptIds.length > 0) {
      await prisma.preCallNotification.deleteMany({
        where: { preCall: { appointmentId: { in: apptIds } } },
      });
      await prisma.preCall.deleteMany({ where: { appointmentId: { in: apptIds } } });
      await prisma.dealerVisitAppointment.updateMany({
        where: { appointmentId: { in: apptIds } },
        data: { appointmentId: null },
      });
      await prisma.appointment.deleteMany({ where: { id: { in: apptIds } } });
    }
    await prisma.dealerContractReport.updateMany({
      where: { deal: { customerId: { in: custIds } } },
      data: { dealId: null },
    });
    await prisma.deal.deleteMany({ where: { customerId: { in: custIds } } });
    await prisma.dealerVisitAppointment.updateMany({
      where: { customerId: { in: custIds } },
      data: { customerId: null },
    });
    await prisma.dealerContractReport.updateMany({
      where: { customerId: { in: custIds } },
      data: { customerId: null },
    });
    out.customer = (await prisma.customer.deleteMany({ where: { id: { in: custIds } } })).count;
  }

  // --- パートナーの提出物 -------------------------------------------------
  const reps = await prisma.dealerEventReport.findMany({ select: { id: true, venuePlace: true } });
  const repIds = reps.filter((r) => isE2E({ id: r.id, name: r.venuePlace })).map((r) => r.id);
  if (repIds.length > 0) {
    await prisma.dealerEventReport.updateMany({
      where: { supersedesReportId: { in: repIds } },
      data: { supersedesReportId: null },
    });
    out.dealerEventReport = (
      await prisma.dealerEventReport.deleteMany({ where: { id: { in: repIds } } })
    ).count;
  }
  const visits = await prisma.dealerVisitAppointment.findMany({
    select: { id: true, tossDept: true },
  });
  const visitIds = visits.filter((r) => isE2E({ id: r.id, name: r.tossDept })).map((r) => r.id);
  if (visitIds.length > 0) {
    out.dealerVisitAppointment = (
      await prisma.dealerVisitAppointment.deleteMany({ where: { id: { in: visitIds } } })
    ).count;
  }
  const creps = await prisma.dealerContractReport.findMany({
    select: { id: true, referralBranch: true },
  });
  const crepIds = creps.filter((r) => isE2E({ id: r.id, name: r.referralBranch })).map((r) => r.id);
  if (crepIds.length > 0) {
    out.dealerContractReport = (
      await prisma.dealerContractReport.deleteMany({ where: { id: { in: crepIds } } })
    ).count;
  }

  // --- 出店希望（明細の希望場所名で判定）---------------------------------
  const prefs = await prisma.lanePreference.findMany({
    select: { id: true, items: { select: { venueLabel: true } } },
  });
  const prefIds = prefs
    .filter((p) => p.items.some((it) => isE2E({ name: it.venueLabel })))
    .map((p) => p.id);
  if (prefIds.length > 0) {
    out.lanePreference = (
      await prisma.lanePreference.deleteMany({ where: { id: { in: prefIds } } })
    ).count;
  }

  // --- 催事 ---------------------------------------------------------------
  const cands = await prisma.eventCandidate.findMany({ select: { id: true, storeName: true } });
  const candIds = cands.filter((c) => isE2E({ id: c.id, name: c.storeName })).map((c) => c.id);
  if (candIds.length > 0) {
    const events = await prisma.event.findMany({
      where: { eventCandidateId: { in: candIds } },
      select: { id: true },
    });
    const evIds = events.map((e) => e.id);
    if (evIds.length > 0) {
      await prisma.dealerEventReport.updateMany({
        where: { eventId: { in: evIds } },
        data: { eventId: null, eventDayId: null },
      });
      await prisma.appointment.updateMany({
        where: { eventId: { in: evIds } },
        data: { eventId: null },
      });
      await prisma.customer.updateMany({
        where: { sourceEventId: { in: evIds } },
        data: { sourceEventId: null },
      });
      await prisma.customerActivity.updateMany({
        where: { eventId: { in: evIds } },
        data: { eventId: null },
      });
      await prisma.lanePreferenceAdoption.deleteMany({ where: { eventId: { in: evIds } } });
      await prisma.eventReportMetric.deleteMany({ where: { report: { eventId: { in: evIds } } } });
      await prisma.eventReport.deleteMany({ where: { eventId: { in: evIds } } });
      await prisma.eventShift.deleteMany({ where: { eventId: { in: evIds } } });
      await prisma.eventSalesperson.deleteMany({ where: { eventId: { in: evIds } } });
      await prisma.eventDealer.deleteMany({ where: { eventId: { in: evIds } } });
      await prisma.eventChange.deleteMany({ where: { eventId: { in: evIds } } });
      await prisma.eventDay.deleteMany({ where: { eventId: { in: evIds } } });
      await prisma.event.deleteMany({ where: { id: { in: evIds } } });
    }
    await prisma.eventCandidateVisibility.deleteMany({
      where: { eventCandidateId: { in: candIds } },
    });
    await prisma.dealerPreference.deleteMany({ where: { eventCandidateId: { in: candIds } } });
    out.eventCandidate = (
      await prisma.eventCandidate.deleteMany({ where: { id: { in: candIds } } })
    ).count;
  }

  // --- 検証で増えた店舗・販売員（催事から参照されていないものだけ）-------
  const stores = await prisma.store.findMany({
    select: { id: true, name: true, _count: { select: { eventCandidates: true } } },
  });
  const storeIds = stores
    .filter((s) => isE2E(s) && s._count.eventCandidates === 0)
    .map((s) => s.id);
  if (storeIds.length > 0) {
    await prisma.lanePreferenceItem.updateMany({
      where: { storeId: { in: storeIds } },
      data: { storeId: null },
    });
    out.store = (await prisma.store.deleteMany({ where: { id: { in: storeIds } } })).count;
  }

  return out;
}

// 直接実行されたときだけ動かす（globalTeardown からは import して呼ぶ）。
const invokedDirectly = process.argv[1]?.replace(/\\/g, "/").endsWith("purge-e2e-data.ts");
if (invokedDirectly) {
  purgeE2eData()
    .then((out) => {
      const total = Object.values(out).reduce((a, b) => a + b, 0);
      console.info(`[purge-e2e] 削除 ${total} 件 ${JSON.stringify(out)}`);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
