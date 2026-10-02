// ローカル確認用の「最小デモデータ」整備。デモ生成の入口はこのファイル 1 本。
//
// 何をするか:
//   0. 会社・ログイン・権限・マスタ・商品を用意する（基本シードを業務デモ抜きで実行）
//   1. 接続先がローカル確認用 DB であることを確かめる
//   2. 旧デモ・旧検証・E2E・基本シードの業務デモ行を、依存関係の順に削除する
//      （会社・ログイン・権限・正規のマスタ・商品は消さない。由来不明の行も消さない）
//   3. シナリオ A / B の最小データを固定 id・固定日付で作る
//
// 何回実行しても件数と関連が変わらない（固定 id + delete-then-create）。
//
// シナリオ:
//   A … 一連の営業を確認する。希望 → 採用 → 催事(レーン) → シフト → 日報、
//       催事 → 顧客 → アポイント → 商談 → 成約報告 までを実際の id で繋ぐ。
//   B … 別会社との区別を確認する。希望・採用なしで、直接割当した単発催事から
//       日報を出して代理店で確認できる。
//
// 実行: pnpm demo:minimal

import "./seed-env.js";

import { PrismaClient } from "@prisma/client";

import { classifyOrigin, MINIMAL_PREFIX, PURGEABLE, type DataOrigin } from "./demo-data-origin.js";
import {
  BASE_SEED_LINE_EVENT_NAMES,
  BASE_SEED_NEGOTIATION_NOTES,
  baseSeedSampleCustomerNames,
  seedAll,
} from "./seed.js";

const prisma = new PrismaClient();
const P = MINIMAL_PREFIX;

// ---------------------------------------------------------------------------
// 固定の基準値（再実行で動かさない）
// ---------------------------------------------------------------------------

/** 今週（2026-09-28 月 〜 10-04 日）かつ今月に収める。 */
const DATE_A = "2026-09-29"; // シナリオA レーン催事の開催日（火）
const DATE_B = "2026-09-30"; // シナリオB 単発催事の開催日（水）
const MONTH = "2026-09";

/** 暦日は UTC 0 時で持つ（既存方針）。 */
const dayUtc = (d: string) => new Date(`${d}T00:00:00.000Z`);
/** 時刻つきは JST → UTC で持つ。 */
const jst = (d: string, hhmm: string) => new Date(`${d}T${hhmm}:00.000+09:00`);

const AGENCY_NAME = "株式会社サンライズソーラー";
const PARTNER_A_EMAIL = "alpha-staff@solar-saas.dev";
const PARTNER_B_EMAIL = "beta-staff@solar-saas.dev";

// ---------------------------------------------------------------------------
// 0. 接続先の確認
// ---------------------------------------------------------------------------

function assertLocalDb(): string {
  const url = process.env.DATABASE_URL ?? "";
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  if (!isLocal || !url.includes("solar_saas_dev")) {
    throw new Error(
      `最小デモ整備はローカル確認用 DB (solar_saas_dev) でのみ実行します。DATABASE_URL=${url.replace(/:\/\/([^:]*):[^@]*@/, "://$1:***@")}`,
    );
  }
  return url;
}

// ---------------------------------------------------------------------------
// 1. 旧データの整理
// ---------------------------------------------------------------------------

interface PurgeTally {
  table: string;
  deleted: number;
  kept: number;
  unknown: Array<{ id: string; label: string }>;
}

const tallies: PurgeTally[] = [];

function split<T extends { id: string }>(
  rows: T[],
  label: (r: T) => string,
  createdAt?: (r: T) => Date | null,
  /** 消してよい由来。マスタのように base-seed を残したいときに絞る。 */
  allowed: DataOrigin[] = PURGEABLE,
  /** 名前だけでは決まらないときの追加判定。 */
  extra?: (r: T) => DataOrigin | null,
): { del: T[]; unknown: T[]; keptMinimal: number } {
  const del: T[] = [];
  const unknown: T[] = [];
  let keptMinimal = 0;
  for (const r of rows) {
    let origin: DataOrigin = classifyOrigin({
      id: r.id,
      name: label(r),
      createdAt: createdAt?.(r) ?? null,
    });
    if (origin === "unknown" && extra) origin = extra(r) ?? "unknown";
    if (origin === "minimal") keptMinimal++;
    else if (allowed.includes(origin)) del.push(r);
    else unknown.push(r);
  }
  return { del, unknown, keptMinimal };
}

function record(table: string, deleted: number, unknown: Array<{ id: string; label: string }>) {
  tallies.push({ table, deleted, kept: unknown.length, unknown });
}

/**
 * 業務デモ行の削除。
 *
 * 依存の向きに沿って葉から消す。Restrict の関係（Appointment→Customer,
 * Contract→Deal/Customer, PreCall→Appointment, Incentive→Contract など）が
 * あるので、順番を変えると外部キーで止まる。
 */
async function purge(): Promise<void> {
  // --- 顧客に連なるもの ---------------------------------------------------
  const customers = await prisma.customer.findMany({
    select: { id: true, name: true, createdAt: true, registeredByOrgType: true },
  });
  // 基本シードのサンプル顧客は氏名の完全一致で判定する（推測で消さない）。
  const sampleNames = new Set(baseSeedSampleCustomerNames());
  const c = split(
    customers,
    (r) => r.name,
    (r) => r.createdAt,
    PURGEABLE,
    (r) => (r.registeredByOrgType === "WHOLESALER" && sampleNames.has(r.name) ? "base-seed" : null),
  );
  const custIds = c.del.map((r) => r.id);
  record(
    "Customer",
    custIds.length,
    c.unknown.map((r) => ({ id: r.id, label: r.name })),
  );

  if (custIds.length > 0) {
    // 契約まわり（Contract を参照する Restrict 関係を先に外す）。
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

    // アポイント（PreCall → Appointment の順）。
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

    // 商談（Contract は上で消してある）。
    await prisma.dealerContractReport.updateMany({
      where: { deal: { customerId: { in: custIds } } },
      data: { dealId: null },
    });
    await prisma.deal.deleteMany({ where: { customerId: { in: custIds } } });

    // 顧客を参照する報告の紐付けを外してから顧客を消す。
    await prisma.dealerVisitAppointment.updateMany({
      where: { customerId: { in: custIds } },
      data: { customerId: null },
    });
    await prisma.dealerContractReport.updateMany({
      where: { customerId: { in: custIds } },
      data: { customerId: null },
    });

    // 残りの子（CustomerActivity / Task / File / CallLog / LoanReview / Message /
    // ExistingEquipment / Hearing など）は Cascade なので顧客と一緒に消える。
    await prisma.customer.deleteMany({ where: { id: { in: custIds } } });
  }

  // --- パートナーの提出物 -------------------------------------------------
  const reps = await prisma.dealerEventReport.findMany({
    select: { id: true, venuePlace: true, createdAt: true },
  });
  const r = split(
    reps,
    (x) => x.venuePlace,
    (x) => x.createdAt,
  );
  if (r.del.length > 0) {
    const ids = r.del.map((x) => x.id);
    // 訂正の自己参照を先に外す（親を消す前に子の参照を切る）。
    await prisma.dealerEventReport.updateMany({
      where: { supersedesReportId: { in: ids } },
      data: { supersedesReportId: null },
    });
    await prisma.dealerEventReport.deleteMany({ where: { id: { in: ids } } });
  }
  record(
    "DealerEventReport",
    r.del.length,
    r.unknown.map((x) => ({ id: x.id, label: x.venuePlace })),
  );

  // 訪問アポ報告・成約報告は名前を持たないので、催事・顧客との紐付けが切れて
  // かつ最小デモのものでない行を「旧検証データ」として消す。
  const visits = await prisma.dealerVisitAppointment.findMany({
    select: { id: true, tossDept: true, maekakuOperator: true, closeDept: true, createdAt: true },
  });
  // 自由記述が 3 つあるので、どれかに目印があれば拾う（tossDept だけでは決まらない）。
  const v = split(
    visits,
    (x) => x.closeDept,
    (x) => x.createdAt,
    PURGEABLE,
    (x) => {
      for (const field of [x.tossDept, x.maekakuOperator, x.closeDept]) {
        const o = classifyOrigin({ name: field });
        if (o !== "unknown") return o;
      }
      return null;
    },
  );
  if (v.del.length > 0) {
    await prisma.dealerVisitAppointment.deleteMany({
      where: { id: { in: v.del.map((x) => x.id) } },
    });
  }
  record(
    "DealerVisitAppointment",
    v.del.length,
    v.unknown.map((x) => ({ id: x.id, label: x.tossDept })),
  );

  const creports = await prisma.dealerContractReport.findMany({
    select: {
      id: true,
      referralBranch: true,
      tossDept: true,
      apptGetter: true,
      affiliationDept: true,
      createdAt: true,
    },
  });
  const cr = split(
    creports,
    (x) => x.referralBranch,
    (x) => x.createdAt,
    PURGEABLE,
    (x) => {
      for (const field of [x.referralBranch, x.tossDept, x.apptGetter, x.affiliationDept]) {
        const o = classifyOrigin({ name: field });
        if (o !== "unknown") return o;
      }
      return null;
    },
  );
  if (cr.del.length > 0) {
    await prisma.dealerContractReport.deleteMany({
      where: { id: { in: cr.del.map((x) => x.id) } },
    });
  }
  record(
    "DealerContractReport",
    cr.del.length,
    cr.unknown.map((x) => ({ id: x.id, label: x.referralBranch })),
  );

  // --- 出店希望 -----------------------------------------------------------
  const prefs = await prisma.lanePreference.findMany({
    select: {
      id: true,
      submittedBy: true,
      submittedAt: true,
      items: { select: { venueLabel: true } },
    },
  });
  const seedUserIds = new Set(
    (
      await prisma.user.findMany({
        where: { email: { endsWith: "@solar-saas.dev" } },
        select: { id: true },
      })
    ).map((u) => u.id),
  );
  const prefDel: string[] = [];
  const prefUnknown: Array<{ id: string; label: string }> = [];
  for (const p of prefs) {
    const own = classifyOrigin({ id: p.id, createdAt: p.submittedAt });
    const byItem = p.items
      .map((it) => classifyOrigin({ name: it.venueLabel }))
      .find((o) => o !== "unknown" && o !== "base-seed");
    const origin: DataOrigin =
      own !== "unknown"
        ? own
        : (byItem ?? (seedUserIds.has(p.submittedBy) ? "base-seed" : "unknown"));
    if (origin === "minimal") continue;
    if (PURGEABLE.includes(origin)) prefDel.push(p.id);
    else prefUnknown.push({ id: p.id, label: p.items.map((i) => i.venueLabel).join(" / ") });
  }
  if (prefDel.length > 0) {
    // Adoption / Message / Item は Cascade。
    await prisma.lanePreference.deleteMany({ where: { id: { in: prefDel } } });
  }
  record("LanePreference", prefDel.length, prefUnknown);

  // --- 催事 ---------------------------------------------------------------
  const lines = await prisma.lineEvent.findMany({
    select: { id: true, name: true, createdAt: true },
  });
  // 基本シードのレーン催事は名前の完全一致で判定する（推測で消さない）。
  const lineNames = new Set(BASE_SEED_LINE_EVENT_NAMES);
  const l = split(
    lines,
    (x) => x.name,
    (x) => x.createdAt,
    PURGEABLE,
    (x) => (lineNames.has(x.name) ? "base-seed" : null),
  );
  if (l.del.length > 0)
    await prisma.lineEvent.deleteMany({ where: { id: { in: l.del.map((x) => x.id) } } });
  record(
    "LineEvent",
    l.del.length,
    l.unknown.map((x) => ({ id: x.id, label: x.name })),
  );

  const cands = await prisma.eventCandidate.findMany({
    select: { id: true, storeName: true, createdAt: true },
  });
  const cd = split(
    cands,
    (x) => x.storeName,
    (x) => x.createdAt,
  );
  if (cd.del.length > 0) {
    const ids = cd.del.map((x) => x.id);
    const events = await prisma.event.findMany({
      where: { eventCandidateId: { in: ids } },
      select: { id: true },
    });
    const evIds = events.map((e) => e.id);
    if (evIds.length > 0) {
      // 催事を参照する行を先に外す／消す。
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
    await prisma.eventCandidateVisibility.deleteMany({ where: { eventCandidateId: { in: ids } } });
    await prisma.dealerPreference.deleteMany({ where: { eventCandidateId: { in: ids } } });
    await prisma.eventCandidate.deleteMany({ where: { id: { in: ids } } });
  }
  record(
    "EventCandidate",
    cd.del.length,
    cd.unknown.map((x) => ({ id: x.id, label: x.storeName })),
  );

  // --- 場所の相談・交渉 ---------------------------------------------------
  // パートナーからの「場所確保の相談」（VenueConsultation）は題名で判定する。
  const cons = await prisma.venueConsultation.findMany({
    select: { id: true, title: true, createdAt: true },
  });
  const cs = split(
    cons,
    (x) => x.title,
    (x) => x.createdAt,
  );
  if (cs.del.length > 0) {
    await prisma.venueConsultation.deleteMany({ where: { id: { in: cs.del.map((x) => x.id) } } });
  }
  record(
    "VenueConsultation",
    cs.del.length,
    cs.unknown.map((x) => ({ id: x.id, label: x.title })),
  );

  // 代理店側の場所交渉（VenueNegotiation）は題名を持たないので、条件メモ・備考で判定する。
  const negs = await prisma.venueNegotiation.findMany({
    select: { id: true, conditionNote: true, note: true, createdAt: true },
  });
  // 基本シードの場所交渉は条件メモの完全一致で判定する。
  const negNotes = new Set(BASE_SEED_NEGOTIATION_NOTES);
  const n = split(
    negs,
    (x) => `${x.conditionNote ?? ""} ${x.note ?? ""}`.trim(),
    (x) => x.createdAt,
    PURGEABLE,
    (x) => (x.conditionNote && negNotes.has(x.conditionNote) ? "base-seed" : null),
  );
  if (n.del.length > 0)
    await prisma.venueNegotiation.deleteMany({ where: { id: { in: n.del.map((x) => x.id) } } });
  record(
    "VenueNegotiation",
    n.del.length,
    n.unknown.map((x) => ({ id: x.id, label: `${x.conditionNote ?? ""} ${x.note ?? ""}`.trim() })),
  );

  // --- 検証用マスタ（店舗）------------------------------------------------
  // 正規の店舗マスタは残し、検証で増えた店舗だけ消す。催事から参照されていれば残す。
  const stores = await prisma.store.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { eventCandidates: true } },
    },
  });
  // 正規の店舗マスタ（基本シード由来）は残す。検証で増えた店舗だけを対象にする。
  const s = split(
    stores,
    (x) => x.name,
    (x) => x.createdAt,
    ["old-demo", "verify", "e2e"],
  );
  const storeDel = s.del.filter((x) => x._count.eventCandidates === 0).map((x) => x.id);
  if (storeDel.length > 0) {
    await prisma.lanePreferenceItem.updateMany({
      where: { storeId: { in: storeDel } },
      data: { storeId: null },
    });
    await prisma.store.deleteMany({ where: { id: { in: storeDel } } });
  }
  record(
    "Store(検証用)",
    storeDel.length,
    s.unknown.map((x) => ({ id: x.id, label: x.name })),
  );

  // --- 検証用マスタ（販売員）----------------------------------------------
  // 正規の販売員マスタ（基本シード由来）は残す。検証で増えた行だけ消す。
  // 顧客の担当・催事の配置・訪問アポ報告から参照されているものは残す（外部キー）。
  const sps = await prisma.salesperson.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: {
        select: {
          eventAssignments: true,
          visitAppointments: true,
          tossUpCustomers: true,
          closingCustomers: true,
        },
      },
    },
  });
  const sp = split(
    sps,
    (x) => x.name,
    (x) => x.createdAt,
    ["old-demo", "verify", "e2e"],
  );
  const spDel = sp.del
    .filter(
      (x) =>
        x._count.eventAssignments === 0 &&
        x._count.visitAppointments === 0 &&
        x._count.tossUpCustomers === 0 &&
        x._count.closingCustomers === 0,
    )
    .map((x) => x.id);
  if (spDel.length > 0) {
    await prisma.salesperson.deleteMany({ where: { id: { in: spDel } } });
  }
  record(
    "Salesperson(検証用)",
    spDel.length,
    sp.unknown.map((x) => ({ id: x.id, label: x.name })),
  );
}

// ---------------------------------------------------------------------------
// 2. 最小データの作成
// ---------------------------------------------------------------------------

async function build(): Promise<void> {
  const agency = await prisma.tenant.findFirst({
    where: { name: AGENCY_NAME, type: "WHOLESALER" },
  });
  if (!agency)
    throw new Error(
      `代理店テナントが見つかりません: ${AGENCY_NAME}。先に pnpm db:seed を実行してください。`,
    );

  async function partner(email: string) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, tenantId: true },
    });
    if (!user) throw new Error(`利用者が見つかりません: ${email}`);
    const rel = await prisma.relationship.findFirst({
      where: { wholesalerId: agency.id, dealerId: user.tenantId, status: "ACTIVE" },
      select: { id: true, dealer: { select: { name: true } } },
    });
    if (!rel) throw new Error(`取引関係が見つかりません: ${email}`);
    // 販売員（シフト・アポの担当に使う）。無ければこの利用者の分だけ作る。
    let sp = await prisma.salesperson.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    sp ??= await prisma.salesperson.create({
      data: {
        wholesalerId: agency.id,
        relationshipId: rel.id,
        userId: user.id,
        name: user.name,
        isActive: true,
      },
      select: { id: true },
    });
    return { user, rel, salespersonId: sp.id, companyName: rel.dealer.name };
  }

  const A = await partner(PARTNER_A_EMAIL);
  const B = await partner(PARTNER_B_EMAIL);

  const agencyAdmin = await prisma.user.findUnique({
    where: { email: "wholesaler_admin@solar-saas.dev" },
    select: { id: true },
  });
  if (!agencyAdmin)
    throw new Error("代理店管理者 wholesaler_admin@solar-saas.dev が見つかりません");

  // 既存の正規マスタを借りる（デモ用の提供元・エリアを新設しない）。
  const area = await prisma.area.findFirst({
    where: { wholesalerId: agency.id, type: "EVENT", isActive: true },
    orderBy: { name: "asc" },
  });
  const providers = await prisma.venueProvider.findMany({
    where: { wholesalerId: agency.id, isActive: true },
    orderBy: { name: "asc" },
    take: 2,
    select: { id: true, name: true },
  });
  if (providers.length < 2) throw new Error("場所提供元マスタが 2 件以上必要です");

  // --- デモ店舗（A / B）--------------------------------------------------
  const storeA = await prisma.store.upsert({
    where: { id: `${P}store_a` },
    create: {
      id: `${P}store_a`,
      wholesalerId: agency.id,
      venueProviderId: providers[0]!.id,
      name: "【デモA】店舗",
      postalCode: "330-0001",
      address: "埼玉県さいたま市大宮区（デモ）1-1",
      areaId: area?.id ?? null,
      isActive: true,
    },
    update: {
      name: "【デモA】店舗",
      venueProviderId: providers[0]!.id,
      areaId: area?.id ?? null,
      isActive: true,
    },
  });
  const storeB = await prisma.store.upsert({
    where: { id: `${P}store_b` },
    create: {
      id: `${P}store_b`,
      wholesalerId: agency.id,
      venueProviderId: providers[1]!.id,
      name: "【デモB】店舗",
      postalCode: "350-0001",
      address: "埼玉県川越市（デモ）2-2",
      areaId: area?.id ?? null,
      isActive: true,
    },
    update: {
      name: "【デモB】店舗",
      venueProviderId: providers[1]!.id,
      areaId: area?.id ?? null,
      isActive: true,
    },
  });

  // -----------------------------------------------------------------------
  // シナリオ A: レーン催事 1 組
  // -----------------------------------------------------------------------
  const candA = await prisma.eventCandidate.upsert({
    where: { id: `${P}cand_a` },
    create: {
      id: `${P}cand_a`,
      wholesalerId: agency.id,
      venueProviderId: storeA.venueProviderId,
      targetMonth: MONTH,
      scheduledDate: dayUtc(DATE_A),
      storeId: storeA.id,
      storeName: "【デモA】催事",
      address: storeA.address,
      area: area?.name ?? null,
      deadlineAt: dayUtc(DATE_A),
      status: "DECIDED",
      createdBy: agencyAdmin.id,
      // ブース場所。催事からアポを登録するとこの値が初期入力される。
      venueChain: "CAINZ",
      boothArea: "ENTRANCE",
    },
    update: {
      scheduledDate: dayUtc(DATE_A),
      targetMonth: MONTH,
      storeName: "【デモA】催事",
      storeId: storeA.id,
      status: "DECIDED",
      venueChain: "CAINZ",
      boothArea: "ENTRANCE",
    },
  });
  const eventA = await prisma.event.upsert({
    where: { id: `${P}event_a` },
    create: {
      id: `${P}event_a`,
      wholesalerId: agency.id,
      eventCandidateId: candA.id,
      mode: "DEALER",
      decidedBy: agencyAdmin.id,
      status: "PLANNED",
    },
    update: { mode: "DEALER", status: "PLANNED" },
  });
  // 開催日は 1 日だけ。旧行が残らないよう作り直す。
  await prisma.eventShift.deleteMany({ where: { eventId: eventA.id } });
  await prisma.eventDay.deleteMany({ where: { eventId: eventA.id } });
  const dayA = await prisma.eventDay.create({
    data: {
      id: `${P}day_a`,
      eventId: eventA.id,
      eventDate: dayUtc(DATE_A),
      startAt: jst(DATE_A, "10:00"),
      endAt: jst(DATE_A, "18:00"),
    },
  });
  await prisma.eventDealer.upsert({
    where: { eventId_relationshipId: { eventId: eventA.id, relationshipId: A.rel.id } },
    create: { eventId: eventA.id, relationshipId: A.rel.id, assignedBy: agencyAdmin.id },
    update: {},
  });
  await prisma.eventShift.create({
    data: {
      id: `${P}shift_a`,
      eventId: eventA.id,
      eventDayId: dayA.id,
      userId: A.user.id,
      role: "PITCH",
      startPlanned: jst(DATE_A, "10:00"),
      endPlanned: jst(DATE_A, "18:00"),
      status: "ASSIGNED",
      note: "【デモA】シフト",
    },
  });

  // レーン催事（枠）と、希望 → 採用 の接続。
  const lineA = await prisma.lineEvent.upsert({
    where: { id: `${P}line_a` },
    create: {
      id: `${P}line_a`,
      wholesalerId: agency.id,
      venueProviderId: storeA.venueProviderId,
      name: "【デモA】催事（レーン）",
      targetMonth: MONTH,
      area: area?.name ?? null,
      address: storeA.address,
      scheduledDates: [DATE_A],
      contractType: "FIXED",
      fixedFee: "30000",
      contractNote: "【デモA】レーン契約（デモ）",
      status: "CONFIRMED",
      assignMode: "DEALER",
      assignStatus: "CONFIRMED",
      assignStaffIds: [],
      assignDealerIds: [A.rel.id],
      assignNote: "【デモA】パートナーA 担当",
      createdBy: agencyAdmin.id,
    },
    update: {
      name: "【デモA】催事（レーン）",
      targetMonth: MONTH,
      scheduledDates: [DATE_A],
      status: "CONFIRMED",
      assignDealerIds: [A.rel.id],
    },
  });

  await prisma.lanePreference.deleteMany({ where: { id: `${P}pref_a` } });
  const prefA = await prisma.lanePreference.create({
    data: {
      id: `${P}pref_a`,
      wholesalerId: agency.id,
      relationshipId: A.rel.id,
      targetMonth: MONTH,
      note: "【デモA】出店希望（1 レーン・店舗Aを希望）",
      submittedBy: A.user.id,
      status: "CONFIRMED",
      laneCount: 1,
      items: {
        create: [
          {
            id: `${P}prefitem_a`,
            laneNo: 1,
            priority: 1,
            venueLabel: `${providers[0]!.name} 【デモA】店舗`,
            venueProviderId: storeA.venueProviderId,
            storeId: storeA.id,
            lineEventId: lineA.id,
            desiredDates: [DATE_A],
            conditionNote: "【デモA】上記日程で 1 日間を希望",
          },
        ],
      },
      messages: {
        create: [
          {
            id: `${P}prefmsg_a1`,
            side: "DEALER",
            kind: "SUBMISSION",
            body: "【デモA】店舗Aで 1 レーンを希望します。",
            authorUserId: A.user.id,
          },
          {
            id: `${P}prefmsg_a2`,
            side: "WHOLESALER",
            kind: "ANSWER",
            body: `【デモA】店舗Aで ${DATE_A} に確保できました。`,
            authorUserId: agencyAdmin.id,
          },
        ],
      },
    },
    select: { id: true },
  });
  await prisma.lanePreferenceAdoption.upsert({
    where: {
      lanePreferenceItemId_eventId: { lanePreferenceItemId: `${P}prefitem_a`, eventId: eventA.id },
    },
    create: {
      id: `${P}adopt_a`,
      wholesalerId: agency.id,
      lanePreferenceItemId: `${P}prefitem_a`,
      eventId: eventA.id,
      decidedBy: agencyAdmin.id,
      note: "【デモA】希望どおり採用",
    },
    update: { note: "【デモA】希望どおり採用" },
  });
  void prefA;

  // 顧客 A → アポイント → 商談 → 成約報告
  const custA = await prisma.customer.upsert({
    where: { id: `${P}cust_a` },
    create: {
      id: `${P}cust_a`,
      wholesalerId: agency.id,
      name: "【デモA】顧客",
      phone: "090-0000-0001",
      mobilePhone: "090-0000-0001",
      postalCode: "330-0002",
      prefecture: "埼玉県",
      addressLine: "さいたま市大宮区（デモ）3-3",
      channel: "EVENT",
      status: "IN_NEGOTIATION",
      registeredByUserId: A.user.id,
      registeredByOrgType: "DEALER",
      ownerRelationshipId: A.rel.id,
      registeredByRelationshipId: A.rel.id,
      closingRelationshipId: A.rel.id,
      sourceEventId: eventA.id,
      salesChannel: "EVENT",
    },
    update: { name: "【デモA】顧客", sourceEventId: eventA.id, status: "IN_NEGOTIATION" },
  });

  await prisma.appointment.deleteMany({ where: { id: `${P}appt_a` } });
  await prisma.appointment.create({
    data: {
      id: `${P}appt_a`,
      customerId: custA.id,
      eventId: eventA.id,
      scheduledAt: jst(DATE_A, "15:00"),
      partnerKind: "FIRST_VISIT",
      status: "VISITED",
      acquiredByUserId: A.user.id,
      acquiredOrgType: "DEALER",
      acquiredRelationshipId: A.rel.id,
      acquiredAt: jst(DATE_A, "11:30"),
      note: "【デモA】催事で獲得",
    },
  });

  const dealA = await prisma.deal.upsert({
    where: { id: `${P}deal_a` },
    create: {
      id: `${P}deal_a`,
      customerId: custA.id,
      ownerType: "DEALER",
      ownerUserId: A.user.id,
      ownerRelationshipId: A.rel.id,
      firstVisitAt: jst(DATE_A, "15:00"),
      status: "CONTRACTED",
      proposedProduct: "【デモA】太陽光＋蓄電池",
      nextAction: "【デモA】工事日程の調整",
      note: "【デモA】商談（デモ）",
    },
    update: { status: "CONTRACTED", note: "【デモA】商談（デモ）" },
  });

  // 接触履歴 2 回分。
  await prisma.customerActivity.deleteMany({ where: { id: { in: [`${P}act_a1`, `${P}act_a2`] } } });
  await prisma.customerActivity.createMany({
    data: [
      {
        id: `${P}act_a1`,
        customerId: custA.id,
        occurredAt: jst(DATE_A, "15:00"),
        category: "訪問",
        detail: "【デモA】初回訪問。提案内容を説明。",
        eventId: eventA.id,
        createdByUserId: A.user.id,
      },
      {
        id: `${P}act_a2`,
        customerId: custA.id,
        occurredAt: jst(DATE_A, "19:00"),
        category: "電話",
        detail: "【デモA】見積の確認。ご契約の意向あり。",
        eventId: eventA.id,
        createdByUserId: A.user.id,
      },
    ],
  });

  // 成約報告（正式契約は作らない。金額・手数料も作らない）。
  await prisma.dealerContractReport.deleteMany({ where: { id: `${P}creport_a` } });
  await prisma.dealerContractReport.create({
    data: {
      id: `${P}creport_a`,
      wholesalerId: agency.id,
      relationshipId: A.rel.id,
      createdByUserId: A.user.id,
      contractDate: dayUtc(DATE_A),
      tossDate: dayUtc(DATE_A),
      tossDept: "【デモA】トス部署",
      apptGetter: "【デモA】アポ獲得者",
      salesRep: A.user.name,
      referralBranch: "【デモA】取次拠点",
      affiliation: "PS",
      affiliationDept: "【デモA】所属部署",
      acquisitionChannel: "EVENT",
      customerId: custA.id,
      dealId: dealA.id,
      contractId: null,
    },
  });

  // 催事日報 A: 訂正前 1 件 + 有効な最新版 1 件。
  await prisma.dealerEventReport.deleteMany({
    where: { id: { in: [`${P}rep_a_new`, `${P}rep_a_old`] } },
  });
  const repBase = {
    wholesalerId: agency.id,
    relationshipId: A.rel.id,
    createdByUserId: A.user.id,
    eventId: eventA.id,
    eventDayId: dayA.id,
    reportScope: "COMPANY" as const,
    eventDate: dayUtc(DATE_A),
    venuePlace: "【デモA】催事",
    category: "HOUSING_EQUIPMENT" as const,
    venueChain: "CAINZ_V" as const,
    areaInFacility: "【デモA】入口付近",
    startTime: "10:00",
    endTime: "18:00",
  };
  await prisma.dealerEventReport.create({
    data: {
      ...repBase,
      id: `${P}rep_a_old`,
      lotteryBoth: 10,
      lotterySingle: 0,
      seatedBoth: 6,
      seatedSingle: 0,
      apptBoth: 1,
      apptSingle: 0,
      impression: "【デモA】日報（訂正前）。会社単位の実績。",
    },
  });
  await prisma.dealerEventReport.create({
    data: {
      ...repBase,
      id: `${P}rep_a_new`,
      supersedesReportId: `${P}rep_a_old`,
      lotteryBoth: 12,
      lotterySingle: 0,
      seatedBoth: 7,
      seatedSingle: 0,
      apptBoth: 1,
      apptSingle: 0,
      impression: "【デモA】日報（最新版）。会社単位の実績。訂正前は集計に入れない。",
    },
  });

  // -----------------------------------------------------------------------
  // シナリオ B: 単発催事 1 組（希望・採用なし＝直接割当）
  // -----------------------------------------------------------------------
  const candB = await prisma.eventCandidate.upsert({
    where: { id: `${P}cand_b` },
    create: {
      id: `${P}cand_b`,
      wholesalerId: agency.id,
      venueProviderId: storeB.venueProviderId,
      targetMonth: MONTH,
      scheduledDate: dayUtc(DATE_B),
      storeId: storeB.id,
      storeName: "【デモB】催事",
      address: storeB.address,
      area: area?.name ?? null,
      deadlineAt: dayUtc(DATE_B),
      status: "DECIDED",
      createdBy: agencyAdmin.id,
      venueChain: "KOMERI",
      boothArea: "REFORM_CORNER",
    },
    update: {
      scheduledDate: dayUtc(DATE_B),
      targetMonth: MONTH,
      storeName: "【デモB】催事",
      storeId: storeB.id,
      status: "DECIDED",
      venueChain: "KOMERI",
      boothArea: "REFORM_CORNER",
    },
  });
  const eventB = await prisma.event.upsert({
    where: { id: `${P}event_b` },
    create: {
      id: `${P}event_b`,
      wholesalerId: agency.id,
      eventCandidateId: candB.id,
      mode: "DEALER",
      decidedBy: agencyAdmin.id,
      status: "PLANNED",
    },
    update: { mode: "DEALER", status: "PLANNED" },
  });
  await prisma.eventShift.deleteMany({ where: { eventId: eventB.id } });
  await prisma.eventDay.deleteMany({ where: { eventId: eventB.id } });
  const dayB = await prisma.eventDay.create({
    data: {
      id: `${P}day_b`,
      eventId: eventB.id,
      eventDate: dayUtc(DATE_B),
      startAt: jst(DATE_B, "10:00"),
      endAt: jst(DATE_B, "18:00"),
    },
  });
  await prisma.eventDealer.upsert({
    where: { eventId_relationshipId: { eventId: eventB.id, relationshipId: B.rel.id } },
    create: { eventId: eventB.id, relationshipId: B.rel.id, assignedBy: agencyAdmin.id },
    update: {},
  });
  await prisma.eventShift.create({
    data: {
      id: `${P}shift_b`,
      eventId: eventB.id,
      eventDayId: dayB.id,
      userId: B.user.id,
      role: "PITCH",
      startPlanned: jst(DATE_B, "10:00"),
      endPlanned: jst(DATE_B, "18:00"),
      status: "ASSIGNED",
      note: "【デモB】シフト",
    },
  });

  const custB = await prisma.customer.upsert({
    where: { id: `${P}cust_b` },
    create: {
      id: `${P}cust_b`,
      wholesalerId: agency.id,
      name: "【デモB】顧客",
      phone: "090-0000-0002",
      mobilePhone: "090-0000-0002",
      postalCode: "350-0002",
      prefecture: "埼玉県",
      addressLine: "川越市（デモ）4-4",
      channel: "EVENT",
      status: "VISIT_PLANNED",
      registeredByUserId: B.user.id,
      registeredByOrgType: "DEALER",
      ownerRelationshipId: B.rel.id,
      registeredByRelationshipId: B.rel.id,
      closingRelationshipId: B.rel.id,
      sourceEventId: eventB.id,
      salesChannel: "EVENT",
    },
    update: { name: "【デモB】顧客", sourceEventId: eventB.id, status: "VISIT_PLANNED" },
  });
  await prisma.appointment.deleteMany({ where: { id: `${P}appt_b` } });
  await prisma.appointment.create({
    data: {
      id: `${P}appt_b`,
      customerId: custB.id,
      eventId: eventB.id,
      scheduledAt: jst(DATE_B, "16:00"),
      partnerKind: "FIRST_VISIT",
      status: "UNCONFIRMED",
      acquiredByUserId: B.user.id,
      acquiredOrgType: "DEALER",
      acquiredRelationshipId: B.rel.id,
      acquiredAt: jst(DATE_B, "12:00"),
      note: "【デモB】催事で獲得",
    },
  });
  await prisma.customerActivity.deleteMany({ where: { id: `${P}act_b1` } });
  await prisma.customerActivity.create({
    data: {
      id: `${P}act_b1`,
      customerId: custB.id,
      occurredAt: jst(DATE_B, "16:00"),
      category: "訪問",
      detail: "【デモB】初回訪問の予定を確認。",
      eventId: eventB.id,
      createdByUserId: B.user.id,
    },
  });

  await prisma.dealerEventReport.deleteMany({ where: { id: `${P}rep_b` } });
  await prisma.dealerEventReport.create({
    data: {
      wholesalerId: agency.id,
      relationshipId: B.rel.id,
      createdByUserId: B.user.id,
      id: `${P}rep_b`,
      eventId: eventB.id,
      eventDayId: dayB.id,
      reportScope: "COMPANY",
      eventDate: dayUtc(DATE_B),
      venuePlace: "【デモB】催事",
      category: "HOUSING_EQUIPMENT",
      venueChain: "CAINZ_V",
      areaInFacility: "【デモB】入口付近",
      startTime: "10:00",
      endTime: "18:00",
      lotteryBoth: 8,
      lotterySingle: 0,
      seatedBoth: 4,
      seatedSingle: 0,
      apptBoth: 1,
      apptSingle: 0,
      impression: "【デモB】日報。会社単位の実績。",
    },
  });

  // --- 表示 ---------------------------------------------------------------
  console.info("");
  console.info("=== 最小デモ（シナリオ A / B）=====================================");
  console.info(`代理店: ${AGENCY_NAME}`);
  console.info(`A: ${A.companyName} / ${A.user.name} (${PARTNER_A_EMAIL})`);
  console.info(`   店舗=【デモA】店舗 催事=【デモA】催事（レーン）${DATE_A}`);
  console.info(`   /event-detail/${candA.id}  /line-events/${lineA.id}  /customers/${custA.id}`);
  console.info(`B: ${B.companyName} / ${B.user.name} (${PARTNER_B_EMAIL})`);
  console.info(`   店舗=【デモB】店舗 催事=【デモB】催事 ${DATE_B}`);
  console.info(`   /event-detail/${candB.id}  /customers/${custB.id}`);
  console.info("==================================================================");
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const url = assertLocalDb();
  console.info(`[demo:minimal] 接続先 ${url.replace(/:\/\/([^:]*):[^@]*@/, "://$1:***@")}`);

  // 会社・ログイン・権限・マスタ・商品はここで用意する。
  // 業務デモ（サンプル顧客・商談・契約など）は入れない＝最小デモだけを載せる。
  await seedAll({ businessDemo: false });

  await purge();
  await build();

  console.info("");
  console.info("### 整理の内訳（削除 / 由来不明で残した件数）");
  for (const t of tallies) {
    console.info(`  ${t.table}: 削除 ${t.deleted} / 由来不明で残した ${t.kept}`);
    for (const u of t.unknown.slice(0, 10)) console.info(`      残: ${u.id} | ${u.label}`);
    if (t.unknown.length > 10) console.info(`      …ほか ${t.unknown.length - 10} 件`);
  }

  const after = {
    eventCandidate: await prisma.eventCandidate.count(),
    event: await prisma.event.count(),
    eventDay: await prisma.eventDay.count(),
    lineEvent: await prisma.lineEvent.count(),
    lanePreference: await prisma.lanePreference.count(),
    lanePreferenceAdoption: await prisma.lanePreferenceAdoption.count(),
    eventShift: await prisma.eventShift.count(),
    customer: await prisma.customer.count(),
    appointment: await prisma.appointment.count(),
    deal: await prisma.deal.count(),
    contract: await prisma.contract.count(),
    incentive: await prisma.incentive.count(),
    dealerEventReport: await prisma.dealerEventReport.count(),
    dealerEventReportActive: await prisma.dealerEventReport.count({
      where: { supersededBy: { is: null } },
    }),
    dealerVisitAppointment: await prisma.dealerVisitAppointment.count(),
    dealerContractReport: await prisma.dealerContractReport.count(),
  };
  console.info("");
  console.info("### 整理後の件数");
  for (const [k, v] of Object.entries(after)) console.info(`  ${k}: ${v}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
