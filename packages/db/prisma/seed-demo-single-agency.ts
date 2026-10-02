// デモ用テストデータ：**代理店 1 社 × 複数パートナー会社**。
//
// 今回のデモ構成はこれが前提。複数代理店からの受注・代理店切替・代理店をまたぐ配置は
// 対象外なので、1 つのパートナー会社が ACTIVE な取引関係を 1 件だけ持つ状態にする。
//
// 構成:
//   代理店            : 株式会社サンライズソーラー（基本シード）
//   パートナー会社 A  : 株式会社グリーンフィールド（管理者 / スタッフ×2 / ゲスト）
//   パートナー会社 B  : あおぞらエナジー株式会社（管理者 / スタッフ）※会社境界の確認用
//   代理店の自社スタッフ: Salesperson.relationshipId = null
//
// 日付は「今日・今週・当月・翌月」で画面が埋まるように、実行時刻を起点に組み立てる
// （固定の過去日付だけにするとトップ画面が空になる）。ローカル時刻 = 日本時間を前提。
//
// 既存データの扱い:
//   - 作る行の id はすべて "demo1_" で始め、表示名に "[DEMO]" を付ける。再実行しても重複しない。
//   - 既存の複数代理店デモ（"bizflow_"）は**削除しない**。ただしパートナー会社 A が
//     2 つの代理店と ACTIVE な取引を持つと今回の前提が崩れるため、bizflow の
//     「グリーンフィールド × 東日本ソーラー」関係だけ status を TERMINATED にする
//     （行は残る。--restore-multi で ACTIVE に戻せる）。
//   - 業務データの一括削除・DB 初期化はしない。
//
// 実行:
//   pnpm -F @solar/db exec tsx prisma/seed-demo-single-agency.ts
//   pnpm -F @solar/db exec tsx prisma/seed-demo-single-agency.ts -- --clean
//   pnpm -F @solar/db exec tsx prisma/seed-demo-single-agency.ts -- --restore-multi

import "./seed-env";

import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

const P = "demo1_";
const TAG = "[DEMO]";
const PASSWORD = "Pilot!2026";

const AGENCY_NAME = "株式会社サンライズソーラー";
const PARTNER_A_NAME = "株式会社グリーンフィールド";
const PARTNER_B_NAME = "あおぞらエナジー株式会社";

/** 複数代理店デモで作った関係（今回の前提では ACTIVE にしない）。 */
const MULTI_AGENCY_REL_ID = "bizflow_rel_b_alpha";

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

// ---------------------------------------------------------------------------
// 日付ヘルパー（ローカル時刻 = 日本時間で組み立てる）
// ---------------------------------------------------------------------------

const now = new Date();
const TODAY = new Date(now.getFullYear(), now.getMonth(), now.getDate());

/** n 日後（ローカル暦日）。 */
function addDays(base: Date, n: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
}

/**
 * 暦日そのものを表す Date（UTC 0 時）。
 * EventCandidate.scheduledDate / EventDay.eventDate と同じ保持方針に揃える。
 */
function calDay(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0));
}

/** その日の時刻（ローカル = JST の壁時計）。 */
function at(d: Date, hh: number, mm = 0): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hh, mm, 0, 0);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 週の頭（月曜）。 */
function mondayOf(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7));
}

const THIS_MONTH = monthKey(TODAY);
const NEXT_MONTH = monthKey(new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 1));

// 今週の月曜を基準に、今日を含む日を確実に作る。
const MONDAY = mondayOf(TODAY);
/** 今日（トップ画面の「今週」に必ず出る）。 */
const D_TODAY = TODAY;
/** 今週の別日（重複判定の相手にする）。 */
const D_WEEK = addDays(MONDAY, 3) > TODAY ? addDays(MONDAY, 3) : addDays(MONDAY, 5);
/** 当月の少し先（複数日開催）。 */
const D_MULTI = addDays(TODAY, 10);
/** 翌月（確定した開催として出店希望の詳細に出す）。 */
const D_NEXT = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 12);

// ---------------------------------------------------------------------------

async function clean(): Promise<void> {
  // id 接頭辞だけを根拠に消す（名前では消さない）。
  await prisma.customerActivity.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.appointment.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.customerExistingEquipment.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.customer.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.eventShift.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.eventDay.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.eventDealer.deleteMany({ where: { eventId: { startsWith: P } } });
  await prisma.event.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.eventCandidateVisibility.deleteMany({
    where: { eventCandidateId: { startsWith: P } },
  });
  await prisma.eventCandidate.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.lanePreferenceMessage.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.venueConsultationMessage.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.venueConsultation.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.dealerEventReport.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.salesperson.deleteMany({ where: { id: { startsWith: P } } });
  await prisma.userRole.deleteMany({ where: { userId: { startsWith: P } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: P } } });
  console.info(`cleaned rows with id prefix "${P}"`);
}

async function restoreMulti(): Promise<void> {
  await prisma.relationship.updateMany({
    where: { id: MULTI_AGENCY_REL_ID },
    data: { status: "ACTIVE" },
  });
  console.info("restored multi-agency relationship to ACTIVE:", MULTI_AGENCY_REL_ID);
}

async function main(): Promise<void> {
  if (process.argv.includes("--clean")) return clean();
  if (process.argv.includes("--restore-multi")) return restoreMulti();

  const agency = await prisma.tenant.findFirst({ where: { name: AGENCY_NAME } });
  const partnerA = await prisma.tenant.findFirst({ where: { name: PARTNER_A_NAME } });
  const partnerB = await prisma.tenant.findFirst({ where: { name: PARTNER_B_NAME } });
  if (!agency || !partnerA || !partnerB) {
    throw new Error("基本シードが未投入です。先に pnpm db:seed を実行してください。");
  }

  // 今回の前提（代理店 1 社）に合わせ、別代理店との取引は ACTIVE から外す。行は残す。
  const suspended = await prisma.relationship.updateMany({
    where: { id: MULTI_AGENCY_REL_ID, status: "ACTIVE" },
    data: { status: "TERMINATED" },
  });

  const relA = await prisma.relationship.findFirst({
    where: { wholesalerId: agency.id, dealerId: partnerA.id, status: "ACTIVE" },
  });
  const relB = await prisma.relationship.findFirst({
    where: { wholesalerId: agency.id, dealerId: partnerB.id, status: "ACTIVE" },
  });
  if (!relA || !relB) throw new Error("代理店 × パートナー会社の取引関係が見つかりません");

  const passwordHash = await argon2.hash(PASSWORD, ARGON2_OPTIONS);

  // --- 利用者 -------------------------------------------------------------
  const userSeeds = [
    {
      key: "a_staff2",
      name: `${TAG} 三好 涼`,
      email: "demo-a-staff2@solar-saas.dev",
      tenantId: partnerA.id,
      role: "DEALER_STAFF" as const,
    },
    {
      key: "a_guest",
      name: `${TAG} 来栖 ゲスト`,
      email: "demo-a-guest@solar-saas.dev",
      tenantId: partnerA.id,
      role: "DEALER_STAFF" as const,
    },
    {
      key: "b_admin",
      name: `${TAG} B社 管理者`,
      email: "demo-b-admin@solar-saas.dev",
      tenantId: partnerB.id,
      role: "DEALER_ADMIN" as const,
    },
    {
      key: "b_staff",
      name: `${TAG} B社 スタッフ`,
      email: "demo-b-staff@solar-saas.dev",
      tenantId: partnerB.id,
      role: "DEALER_STAFF" as const,
    },
  ];
  const uid: Record<string, string> = {};
  for (const u of userSeeds) {
    const id = `${P}user_${u.key}`;
    await prisma.user.upsert({
      where: { id },
      create: {
        id,
        tenantId: u.tenantId,
        email: u.email,
        name: u.name,
        passwordHash,
        status: "ACTIVE",
      },
      update: { name: u.name, status: "ACTIVE" },
    });
    await prisma.userRole.createMany({
      data: [{ userId: id, role: u.role, assignedBy: `${P}seed` }],
      skipDuplicates: true,
    });
    uid[u.key] = id;
  }

  // 既存の A 社アカウント。管理者にはスタッフ資格も持たせ、サイト往復を確認できるようにする。
  const aAdmin = await prisma.user.findFirst({ where: { email: "alpha-admin@solar-saas.dev" } });
  const aStaff = await prisma.user.findFirst({ where: { email: "alpha-staff@solar-saas.dev" } });
  if (aAdmin) {
    await prisma.userRole.createMany({
      data: [{ userId: aAdmin.id, role: "DEALER_STAFF", assignedBy: `${P}seed` }],
      skipDuplicates: true,
    });
  }

  // --- スタッフ（Salesperson） --------------------------------------------
  const spSeeds: {
    key: string;
    userId?: string;
    name: string;
    isGuest: boolean;
    address: string;
    relationshipId: string | null;
  }[] = [
    {
      key: "a_staff2",
      userId: uid.a_staff2,
      name: `${TAG} 三好 涼`,
      isGuest: false,
      address: "埼玉県さいたま市大宮区桜木町1-1",
      relationshipId: relA.id,
    },
    {
      key: "a_guest",
      userId: uid.a_guest,
      name: `${TAG} 来栖 ゲスト`,
      isGuest: true,
      address: "東京都八王子市旭町3-3",
      relationshipId: relA.id,
    },
    {
      key: "b_staff",
      userId: uid.b_staff,
      name: `${TAG} B社 スタッフ`,
      isGuest: false,
      address: "千葉県船橋市本町4-4",
      relationshipId: relB.id,
    },
    // 代理店の自社スタッフ（relationshipId = null）。自社催事だけを担当する。
    {
      key: "agency_own",
      name: `${TAG} 代理店 自社スタッフ`,
      isGuest: false,
      address: "埼玉県さいたま市浦和区高砂5-5",
      relationshipId: null,
    },
  ];
  for (const sp of spSeeds) {
    const id = `${P}sp_${sp.key}`;
    // Salesperson.userId は @unique。既に別の行が持っていたら紐付けない。
    const taken = sp.userId
      ? await prisma.salesperson.findFirst({
          where: { userId: sp.userId, NOT: { id } },
          select: { id: true },
        })
      : null;
    await prisma.salesperson.upsert({
      where: { id },
      create: {
        id,
        wholesalerId: agency.id,
        relationshipId: sp.relationshipId,
        userId: taken ? null : (sp.userId ?? null),
        name: sp.name,
        address: sp.address,
        isGuest: sp.isGuest,
        isActive: true,
      },
      update: { name: sp.name, address: sp.address, isGuest: sp.isGuest, isActive: true },
    });
  }

  // --- 催事（すべて同じ代理店が主催） --------------------------------------
  // 今日・今週・当月（複数日）・翌月。重複判定は「同じ代理店の複数催事」で行う。
  const events = [
    {
      key: "today_a",
      store: `${TAG} カインズ 大宮店`,
      rel: relA.id,
      month: THIS_MONTH,
      days: [{ d: D_TODAY, s: at(D_TODAY, 10), e: at(D_TODAY, 18) }],
    },
    {
      key: "today_b",
      store: `${TAG} ベイシア 川越店`,
      rel: relA.id,
      month: THIS_MONTH,
      days: [{ d: D_TODAY, s: at(D_TODAY, 11), e: at(D_TODAY, 19) }],
    },
    {
      key: "week",
      store: `${TAG} コメリ 熊谷店`,
      rel: relA.id,
      month: THIS_MONTH,
      days: [{ d: D_WEEK, s: at(D_WEEK, 10), e: at(D_WEEK, 18) }],
    },
    {
      key: "multi",
      store: `${TAG} ヤマダデンキ 伊勢崎店`,
      rel: relA.id,
      month: THIS_MONTH,
      days: [
        { d: D_MULTI, s: at(D_MULTI, 10), e: at(D_MULTI, 18) },
        { d: addDays(D_MULTI, 1), s: at(addDays(D_MULTI, 1), 10), e: at(addDays(D_MULTI, 1), 18) },
      ],
    },
    {
      key: "b_company",
      store: `${TAG} ムサシ 越谷店`,
      rel: relB.id,
      month: THIS_MONTH,
      days: [{ d: D_WEEK, s: at(D_WEEK, 10), e: at(D_WEEK, 18) }],
    },
    {
      key: "next",
      store: `${TAG} 前橋みなみモール店`,
      rel: relA.id,
      month: NEXT_MONTH,
      days: [
        { d: D_NEXT, s: at(D_NEXT, 10), e: at(D_NEXT, 18) },
        { d: addDays(D_NEXT, 1), s: at(addDays(D_NEXT, 1), 10), e: at(addDays(D_NEXT, 1), 18) },
      ],
    },
  ];

  // 開催日と配置は「今日」を基準に毎回計算し直す。前回実行のままだと日付が古いうえ、
  // EventDay の一意制約 (eventId, eventDate) と EventShift の時間帯 EXCLUDE 制約に
  // 当たるので、デモが作った行だけ先に消して入れ直す。
  // 消す条件は id 接頭辞 demo1_ のみで、業務データには触れない。
  // （子の EventShift → 親の EventDay の順に消す。）
  await prisma.eventShift.deleteMany({ where: { id: { startsWith: `${P}shift_` } } });
  await prisma.eventDay.deleteMany({ where: { id: { startsWith: `${P}day_` } } });

  for (const ev of events) {
    const candId = `${P}cand_${ev.key}`;
    const firstDay = ev.days[0]!;
    await prisma.eventCandidate.upsert({
      where: { id: candId },
      create: {
        id: candId,
        wholesalerId: agency.id,
        targetMonth: ev.month,
        scheduledDate: calDay(firstDay.d),
        storeName: ev.store,
        address: "（デモデータ）",
        area: "関東",
        deadlineAt: calDay(addDays(firstDay.d, -14)),
        status: "DECIDED",
        publishedAt: calDay(addDays(firstDay.d, -21)),
        createdBy: `${P}seed`,
      },
      update: { scheduledDate: calDay(firstDay.d), storeName: ev.store, targetMonth: ev.month },
    });
    await prisma.eventCandidateVisibility.upsert({
      where: {
        eventCandidateId_relationshipId: { eventCandidateId: candId, relationshipId: ev.rel },
      },
      create: { eventCandidateId: candId, relationshipId: ev.rel, isVisible: true },
      update: { isVisible: true },
    });

    const eventId = `${P}event_${ev.key}`;
    await prisma.event.upsert({
      where: { id: eventId },
      create: {
        id: eventId,
        wholesalerId: agency.id,
        eventCandidateId: candId,
        mode: "DEALER",
        decidedBy: `${P}seed`,
        status: "PLANNED",
      },
      update: {},
    });
    await prisma.eventDealer.upsert({
      where: { eventId_relationshipId: { eventId, relationshipId: ev.rel } },
      create: { eventId, relationshipId: ev.rel, assignedBy: `${P}seed` },
      update: {},
    });
    for (const [i, d] of ev.days.entries()) {
      await prisma.eventDay.create({
        data: {
          id: `${P}day_${ev.key}_${i}`,
          eventId,
          eventDate: calDay(d.d),
          startAt: d.s,
          endAt: d.e,
        },
      });
    }
  }

  // --- 配置 ---------------------------------------------------------------
  // 今日の催事に A 社スタッフを入れる（スタッフトップの「今週」に必ず出る）。
  // today_a と today_b は同じ日の重なる時間帯なので、同じ人は片方にしか入れない。
  const shifts: {
    key: string;
    eventKey: string;
    dayIndex: number;
    userId: string | undefined;
    role: "CATCH" | "TOSS";
    s: Date;
    e: Date;
    actual?: [Date, Date];
  }[] = [
    {
      key: "s1",
      eventKey: "today_a",
      dayIndex: 0,
      userId: aStaff?.id,
      role: "CATCH",
      s: at(D_TODAY, 10),
      e: at(D_TODAY, 18),
    },
    {
      key: "s2",
      eventKey: "today_b",
      dayIndex: 0,
      userId: uid.a_staff2,
      role: "TOSS",
      s: at(D_TODAY, 11),
      e: at(D_TODAY, 19),
    },
    {
      key: "s3",
      eventKey: "week",
      dayIndex: 0,
      userId: aStaff?.id,
      role: "TOSS",
      s: at(D_WEEK, 10),
      e: at(D_WEEK, 18),
      actual: [at(D_WEEK, 11), at(D_WEEK, 17)],
    },
    {
      key: "s4",
      eventKey: "multi",
      dayIndex: 0,
      userId: uid.a_guest,
      role: "CATCH",
      s: at(D_MULTI, 10),
      e: at(D_MULTI, 18),
    },
    {
      key: "s5",
      eventKey: "multi",
      dayIndex: 1,
      userId: uid.a_staff2,
      role: "CATCH",
      s: at(addDays(D_MULTI, 1), 10),
      e: at(addDays(D_MULTI, 1), 18),
    },
    {
      key: "s6",
      eventKey: "b_company",
      dayIndex: 0,
      userId: uid.b_staff,
      role: "CATCH",
      s: at(D_WEEK, 10),
      e: at(D_WEEK, 18),
    },
  ];
  for (const sh of shifts) {
    if (!sh.userId) continue;
    const id = `${P}shift_${sh.key}`;
    try {
      await prisma.eventShift.create({
        data: {
          id,
          eventId: `${P}event_${sh.eventKey}`,
          eventDayId: `${P}day_${sh.eventKey}_${sh.dayIndex}`,
          userId: sh.userId,
          role: sh.role,
          startPlanned: sh.s,
          endPlanned: sh.e,
          ...(sh.actual ? { startActual: sh.actual[0], endActual: sh.actual[1] } : {}),
        },
      });
    } catch (err) {
      // 予定時間帯の EXCLUDE 制約に当たった場合は飛ばす（既存データとの重複）。
      console.warn("skip shift", sh.key, err instanceof Error ? err.message.slice(0, 120) : err);
    }
  }

  // --- 出店希望（翌月ぶん）+ 代理店の回答 ----------------------------------
  // 基本シードは当月の明細を入れ替えるので、デモは翌月に置く。
  // 月が変わると対象月も変わる。その場合この提出行は自然キーで引き当てられないので、
  // 対象月が古いデモ提出行を先に片付けておく（作り直しで id が衝突するのを防ぐ）。
  const staleRefs = {
    lanePreference: { id: { startsWith: `${P}pref_` }, targetMonth: { not: NEXT_MONTH } },
  };
  await prisma.lanePreferenceMessage.deleteMany({ where: staleRefs });
  await prisma.lanePreferenceItem.deleteMany({ where: staleRefs });
  await prisma.lanePreference.deleteMany({ where: staleRefs.lanePreference });
  const pref = await prisma.lanePreference.upsert({
    where: { relationshipId_targetMonth: { relationshipId: relA.id, targetMonth: NEXT_MONTH } },
    create: {
      id: `${P}pref_a`,
      wholesalerId: agency.id,
      relationshipId: relA.id,
      targetMonth: NEXT_MONTH,
      laneCount: 2,
      note: `${TAG} 翌月の出店希望です。`,
      submittedBy: aAdmin?.id ?? `${P}seed`,
      status: "ANSWERED",
    },
    update: { laneCount: 2, status: "ANSWERED", note: `${TAG} 翌月の出店希望です。` },
    select: { id: true },
  });
  // この提出行は「対象月 × 取引関係」で一意なので、旧デモ（bizflow_）が同じ行を
  // 使っていた場合はその明細・やり取りが残る。同じ行に 2 組ぶら下がると画面が
  // 二重表示になるため、この行に紐づく旧デモの行だけを取り除く（業務データは触らない）。
  await prisma.lanePreferenceItem.deleteMany({ where: { lanePreferenceId: pref.id } });
  await prisma.lanePreferenceMessage.deleteMany({
    where: { lanePreferenceId: pref.id, id: { startsWith: "bizflow_" } },
  });
  const lane1 = [1, 2, 8, 9].map((d) => `${NEXT_MONTH}-${String(d).padStart(2, "0")}`);
  const lane2 = [15, 16, 22].map((d) => `${NEXT_MONTH}-${String(d).padStart(2, "0")}`);
  // 希望場所は店舗マスタに実在する支店を指す。以前は「伊勢崎店」「コメリ蒲原」など
  // マスタに無い名前を自由記述で入れていたため、どの店舗への希望なのか決まらなかった。
  // 支店名で引き当て、表示名もマスタから組み立てて食い違いを作らない。
  const demoStores = await prisma.store.findMany({
    where: { wholesalerId: agency.id },
    select: {
      id: true,
      name: true,
      venueProviderId: true,
      venueProvider: { select: { name: true } },
    },
  });
  const storeByName = new Map(demoStores.map((st) => [st.name, st]));
  const label = (st: { name: string; venueProvider: { name: string } | null }) =>
    st.venueProvider ? `${st.venueProvider.name} ${st.name}` : st.name;

  const items = [
    { laneNo: 1, priority: 1, storeName: "前橋みなみモール店", dates: lane1, cond: null },
    { laneNo: 1, priority: 2, storeName: "渋川店", dates: lane1, cond: null },
    { laneNo: 1, priority: 3, storeName: "浦和美園店", dates: lane1, cond: null },
    { laneNo: 2, priority: 1, storeName: "大宮店", dates: lane2, cond: null },
    { laneNo: 2, priority: 2, storeName: "新所沢店", dates: lane2, cond: null },
    // 順位とは別の軸の条件。第四希望へ読み替えない。
    {
      laneNo: 2,
      priority: 3,
      storeName: "テックランド川越店",
      dates: lane2,
      cond: "上記日程のいずれか 2 日間を希望",
    },
  ];
  for (const [i, it] of items.entries()) {
    const st = storeByName.get(it.storeName);
    if (!st) {
      throw new Error(`[demo] 希望場所 "${it.storeName}" が店舗マスタにありません。`);
    }
    await prisma.lanePreferenceItem.create({
      data: {
        id: `${P}prefitem_${i}`,
        lanePreferenceId: pref.id,
        laneNo: it.laneNo,
        priority: it.priority,
        storeId: st.id,
        // 場所提供元は店舗マスタの親から取る（別々に持たせない）。
        venueProviderId: st.venueProviderId,
        venueLabel: label(st),
        desiredDates: it.dates,
        conditionNote: it.cond,
      },
    });
  }
  for (const m of [
    {
      key: "1",
      side: "DEALER" as const,
      kind: "SUBMISSION" as const,
      body: `${TAG} 2 レーンで提出しました。2 レーン目の第三希望は、いずれか 2 日間を希望します。`,
      author: aAdmin?.id ?? `${P}seed`,
    },
    {
      key: "2",
      side: "WHOLESALER" as const,
      kind: "ANSWER" as const,
      body: `${TAG} 1 レーン目は第一希望の店舗で確保できました。2 レーン目は調整中です。`,
      author: `${P}seed`,
    },
  ]) {
    await prisma.lanePreferenceMessage.upsert({
      where: { id: `${P}prefmsg_${m.key}` },
      create: {
        id: `${P}prefmsg_${m.key}`,
        lanePreferenceId: pref.id,
        side: m.side,
        kind: m.kind,
        body: m.body,
        authorUserId: m.author,
      },
      update: { lanePreferenceId: pref.id },
    });
  }

  // --- 場所確保の相談 -------------------------------------------------------
  await prisma.venueConsultation.upsert({
    where: { id: `${P}consult_1` },
    create: {
      id: `${P}consult_1`,
      wholesalerId: agency.id,
      relationshipId: relA.id,
      targetMonth: NEXT_MONTH,
      area: "群馬県東部",
      title: `${TAG} 群馬県東部でのブース確保のご相談`,
      body: "この地域は戸建ての持ち家比率が高く反応が良いため、太田・桐生あたりでブースを確保できませんか。",
      createdByUserId: aAdmin?.id ?? `${P}seed`,
      status: "ANSWERED",
    },
    update: { status: "ANSWERED" },
  });
  for (const m of [
    {
      key: "1",
      side: "DEALER" as const,
      kind: "SUBMISSION" as const,
      body: "この地域は戸建ての持ち家比率が高く反応が良いため、太田・桐生あたりでブースを確保できませんか。",
      author: aAdmin?.id ?? `${P}seed`,
    },
    {
      key: "2",
      side: "WHOLESALER" as const,
      kind: "ANSWER" as const,
      body: `${TAG} 太田の店舗に打診しました。来週中に回答します。`,
      author: `${P}seed`,
    },
  ]) {
    await prisma.venueConsultationMessage.upsert({
      where: { id: `${P}consultmsg_${m.key}` },
      create: {
        id: `${P}consultmsg_${m.key}`,
        venueConsultationId: `${P}consult_1`,
        side: m.side,
        kind: m.kind,
        body: m.body,
        authorUserId: m.author,
      },
      update: {},
    });
  }

  // --- 顧客 + アポ + 商談履歴（催事起点） ---------------------------------
  const customerId = `${P}cust_a1`;
  await prisma.customer.upsert({
    where: { id: customerId },
    create: {
      id: customerId,
      wholesalerId: agency.id,
      ownerRelationshipId: relA.id,
      registeredByRelationshipId: relA.id,
      registeredByUserId: aStaff?.id ?? uid.a_staff2!,
      registeredByOrgType: "DEALER",
      name: `${TAG} 山田 花子`,
      kana: "ヤマダ ハナコ",
      phone: "09000000001",
      mobilePhone: "09000000001",
      landlinePhone: "0480000001",
      postalCode: "3300000",
      prefecture: "埼玉県",
      city: "さいたま市大宮区",
      addressLine: "桜木町1-1",
      channel: "EVENT",
      salesChannel: "EVENT",
      sourceEventId: `${P}event_today_a`,
      contractStatus: "negotiating",
      maekakuStatus: "pending",
      status: "IN_NEGOTIATION",
      guideAttendee: "BOTH",
      household: "4人（夫婦 + 子2）",
    },
    update: {},
  });
  await prisma.appointment.upsert({
    where: { id: `${P}appt_a1` },
    create: {
      id: `${P}appt_a1`,
      customerId,
      eventId: `${P}event_today_a`,
      scheduledAt: at(addDays(TODAY, 3), 13),
      partnerKind: "FIRST_VISIT",
      acquiredByUserId: aStaff?.id ?? uid.a_staff2!,
      acquiredOrgType: "DEALER",
      acquiredRelationshipId: relA.id,
    },
    update: {},
  });
  for (const [i, eq] of [
    { category: "PV" as const, installed: "NO" as const },
    { category: "ECO_CUTE" as const, installed: "YES" as const },
    { category: "IH" as const, installed: "UNKNOWN" as const },
    { category: "AIR_CONDITIONER" as const, installed: "YES" as const },
  ].entries()) {
    await prisma.customerExistingEquipment.upsert({
      where: { customerId_category: { customerId, category: eq.category } },
      create: { id: `${P}eq_${i}`, customerId, category: eq.category, installed: eq.installed },
      update: {},
    });
  }
  for (const a of [
    {
      key: "a1",
      at: at(TODAY, 14),
      category: "event",
      detail: "催事ブースで接客。太陽光に関心あり。訪問日時を調整。",
      eventId: `${P}event_today_a`,
    },
    {
      key: "a2",
      at: at(addDays(TODAY, 3), 13),
      category: "visit",
      detail: "初回訪問。屋根形状を確認。見積提示は次回。",
      eventId: null,
    },
  ]) {
    await prisma.customerActivity.upsert({
      where: { id: `${P}act_${a.key}` },
      create: {
        id: `${P}act_${a.key}`,
        customerId,
        occurredAt: a.at,
        category: a.category,
        detail: `${TAG} ${a.detail}`,
        eventId: a.eventId,
        assigneeUserId: aStaff?.id ?? null,
        createdByUserId: aStaff?.id ?? uid.a_staff2!,
      },
      update: {},
    });
  }

  // --- B 社の顧客（会社境界の確認用） --------------------------------------
  await prisma.customer.upsert({
    where: { id: `${P}cust_b1` },
    create: {
      id: `${P}cust_b1`,
      wholesalerId: agency.id,
      ownerRelationshipId: relB.id,
      registeredByRelationshipId: relB.id,
      registeredByUserId: uid.b_staff!,
      registeredByOrgType: "DEALER",
      name: `${TAG} B社 顧客`,
      phone: "09000000099",
      channel: "EVENT",
    },
    update: {},
  });

  // --- 催事日報 -------------------------------------------------------------
  await prisma.dealerEventReport.upsert({
    where: { id: `${P}report_a1` },
    create: {
      id: `${P}report_a1`,
      wholesalerId: agency.id,
      relationshipId: relA.id,
      createdByUserId: aStaff?.id ?? uid.a_staff2!,
      eventDate: calDay(D_TODAY),
      venuePlace: `${TAG} カインズ 大宮店`,
      category: "HOUSING_EQUIPMENT",
      venueChain: "CAINZ_W",
      areaInFacility: "入口正面",
      startTime: "10:00",
      endTime: "18:00",
      lotteryBoth: 20,
      lotterySingle: 10,
      seatedBoth: 8,
      seatedSingle: 4,
      apptBoth: 3,
      apptSingle: 1,
    },
    update: {},
  });

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // -------------------------------------------------------------------------
  // 日報の親催事を整備する（③④）
  // -------------------------------------------------------------------------
  //
  // E2E が UI から提出した日報（催事場所が「テスト会場-…」「他社会場-…」）は、
  // 催事を選ばせる前の仕様で作られたので親催事を持たない。一覧から消さず、
  // 日付ごとに 1 件だけ受け皿の催事を用意して紐付ける（1 件ごとに催事を作らない）。
  //
  // 店舗は既存マスタから借りる。実在店舗の住所を作り話で埋めない。
  // 由来が分からない日報には触れず、件数だけを出す。
  const repairStore = await prisma.store.findFirst({
    where: { wholesalerId: agency.id, isActive: true, venueProviderId: { not: null } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      address: true,
      venueProviderId: true,
      area: { select: { name: true } },
    },
  });

  let repairedReports = 0;
  let unknownReports = 0;
  if (repairStore) {
    // 対象は「自分たちのテスト・デモが作った」と分かる日報だけ。
    // 接頭辞で見分けられるものに限る。由来が分からない行には触れない。
    const targets = await prisma.dealerEventReport.findMany({
      where: {
        eventId: null,
        OR: [
          { venuePlace: { startsWith: "テスト会場-" } },
          { venuePlace: { startsWith: "他社会場-" } },
          { venuePlace: { startsWith: "管理者会場-" } },
          { venuePlace: { startsWith: "スタッフ会場-" } },
          // 一覧テストが作る「L3-xxxx 会場N」。
          { venuePlace: { startsWith: "L3-" } },
          { venuePlace: { startsWith: "[E2E" } },
          { venuePlace: { startsWith: TAG } },
          { venuePlace: { startsWith: "[BIZ]" } },
        ],
      },
      select: { id: true, eventDate: true, relationshipId: true },
    });

    // 日付ごとにまとめる。1 日 = 1 催事。
    const byDay = new Map<string, { ids: string[]; rels: Set<string> }>();
    for (const r of targets) {
      const key = r.eventDate.toISOString().slice(0, 10);
      const cur = byDay.get(key) ?? { ids: [], rels: new Set<string>() };
      cur.ids.push(r.id);
      cur.rels.add(r.relationshipId);
      byDay.set(key, cur);
    }

    for (const [day, group] of byDay) {
      const candId = `${P}repcand_${day}`;
      const eventId = `${P}repevent_${day}`;
      const dayId = `${P}repday_${day}`;
      const date = new Date(`${day}T00:00:00.000Z`);

      await prisma.eventCandidate.upsert({
        where: { id: candId },
        create: {
          id: candId,
          wholesalerId: agency.id,
          venueProviderId: repairStore.venueProviderId,
          targetMonth: day.slice(0, 7),
          scheduledDate: date,
          storeId: repairStore.id,
          storeName: `${TAG} 日報受け皿（${repairStore.name}）`,
          address: repairStore.address,
          area: repairStore.area?.name ?? null,
          deadlineAt: date,
          status: "DECIDED",
          createdBy: `${P}seed`,
        },
        update: { scheduledDate: date, targetMonth: day.slice(0, 7) },
      });
      await prisma.event.upsert({
        where: { id: eventId },
        create: {
          id: eventId,
          wholesalerId: agency.id,
          eventCandidateId: candId,
          mode: "DEALER",
          decidedBy: `${P}seed`,
          status: "CLOSED",
        },
        update: {},
      });
      await prisma.eventShift.deleteMany({ where: { eventDayId: dayId } });
      await prisma.eventDay.deleteMany({ where: { id: dayId } });
      await prisma.eventDay.create({ data: { id: dayId, eventId, eventDate: date } });

      // 提出した会社をこの催事の担当として割り当てる（会社割当が無いと辿れない）。
      for (const relId of group.rels) {
        await prisma.eventDealer.upsert({
          where: { eventId_relationshipId: { eventId, relationshipId: relId } },
          create: { eventId, relationshipId: relId, assignedBy: `${P}seed` },
          update: {},
        });
      }

      const res = await prisma.dealerEventReport.updateMany({
        where: { id: { in: group.ids } },
        data: { eventId, eventDayId: dayId },
      });
      repairedReports += res.count;
    }

    unknownReports = await prisma.dealerEventReport.count({ where: { eventId: null } });
  }
  console.info(
    `[demo] 日報の親催事: 整備 ${repairedReports}件 / 受け皿の催事 ${
      new Set(
        (
          await prisma.dealerEventReport.findMany({
            where: { eventId: { not: null } },
            select: { eventId: true },
            distinct: ["eventId"],
          })
        ).map((x) => x.eventId),
      ).size
    }件 / 由来不明で据え置き ${unknownReports}件`,
  );

  console.info("--------------------------------------------------------------");
  console.info(`デモデータを投入しました（id 接頭辞 "${P}" / 表示 "${TAG}"）`);
  console.info(`代理店（1 社）: ${AGENCY_NAME}`);
  console.info(`パートナー会社 A: ${PARTNER_A_NAME} / B: ${PARTNER_B_NAME}`);
  console.info(`当月: ${THIS_MONTH} / 翌月（出店希望・相談）: ${NEXT_MONTH}`);
  console.info(
    `催事: 今日 ${fmt(D_TODAY)}（2 件・時間が重なる）/ 今週 ${fmt(D_WEEK)} / 複数日 ${fmt(D_MULTI)}〜 / 翌月 ${fmt(D_NEXT)}〜`,
  );
  if (suspended.count > 0) {
    console.info(
      `複数代理店デモの取引関係を TERMINATED にしました: ${MULTI_AGENCY_REL_ID}（--restore-multi で戻せます）`,
    );
  }
  console.info(`パスワード（追加した利用者）: ${PASSWORD}`);
  console.info("--------------------------------------------------------------");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
