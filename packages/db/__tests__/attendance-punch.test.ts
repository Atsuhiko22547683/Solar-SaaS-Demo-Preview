// 出退勤の打刻を、UI を通さず書き込みの層で確かめる。
//
// 「画面にボタンを出さないから安全」では確かめたことにならないので、Server Action が
// 使うのと同じ条件付き更新（updateMany の where）を直接叩く。
//
//   ・未出勤の割当に退勤を打つと 0 件（記録が入らない）
//   ・同時に出勤を打っても 1 件だけ成立し、時刻が動かない
//   ・他人の割当には打刻できない（0 件）
//   ・予定時間（startPlanned / endPlanned）は打刻で書き換わらない
//
// テスト用 DB（solar_saas_test）に自前のフィクスチャを作って走らせる。

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const admin = new PrismaClient({ datasources: { db: { url: process.env.TEST_DB_ADMIN_URL } } });

const SHIFT = "att_shift_me";
const OTHER_SHIFT = "att_shift_other";

interface Fixture {
  meId: string;
  otherId: string;
  startPlanned: Date;
  endPlanned: Date;
}
let fx: Fixture;

async function truncate(): Promise<void> {
  await admin.$executeRawUnsafe(`
    TRUNCATE TABLE
      "EventShift",
      "EventDay",
      "EventDealer",
      "Event",
      "EventCandidate",
      "Relationship",
      "User",
      "Tenant"
    RESTART IDENTITY CASCADE;
  `);
}

beforeAll(async () => {
  await truncate();

  const wholesaler = await admin.tenant.create({
    data: { type: "WHOLESALER", name: "打刻テスト卸", plan: "PILOT" },
  });
  const dealer = await admin.tenant.create({
    data: { type: "DEALER", name: "打刻テスト二次店", plan: "PILOT" },
  });
  const me = await admin.user.create({
    data: { tenantId: dealer.id, email: "att-me@example.com", name: "打刻 本人", status: "ACTIVE" },
  });
  const other = await admin.user.create({
    data: {
      tenantId: dealer.id,
      email: "att-other@example.com",
      name: "打刻 別人",
      status: "ACTIVE",
    },
  });
  const rel = await admin.relationship.create({
    data: {
      wholesalerId: wholesaler.id,
      dealerId: dealer.id,
      status: "ACTIVE",
      defaultScope: "FULL_CLOSING",
    },
  });
  const date = new Date("2026-09-30T00:00:00.000Z");
  const candidate = await admin.eventCandidate.create({
    data: {
      wholesalerId: wholesaler.id,
      targetMonth: "2026-09",
      scheduledDate: date,
      storeName: "打刻テスト店舗",
      deadlineAt: date,
      status: "DECIDED",
      createdBy: me.id,
    },
  });
  const event = await admin.event.create({
    data: {
      wholesalerId: wholesaler.id,
      eventCandidateId: candidate.id,
      mode: "DEALER",
      decidedBy: me.id,
    },
  });
  await admin.eventDealer.create({
    data: { eventId: event.id, relationshipId: rel.id, assignedBy: me.id },
  });
  const day = await admin.eventDay.create({ data: { eventId: event.id, eventDate: date } });

  const startPlanned = new Date("2026-09-30T01:00:00.000Z");
  const endPlanned = new Date("2026-09-30T09:00:00.000Z");
  await admin.eventShift.create({
    data: {
      id: SHIFT,
      eventId: event.id,
      eventDayId: day.id,
      userId: me.id,
      role: "PITCH",
      startPlanned,
      endPlanned,
    },
  });
  // 別人の割当は時間帯を重ねない（EventShift_user_no_overlap は同一利用者のみだが、
  // 意図を読みやすくするため別枠にする）。
  await admin.eventShift.create({
    data: {
      id: OTHER_SHIFT,
      eventId: event.id,
      eventDayId: day.id,
      userId: other.id,
      role: "PITCH",
      startPlanned,
      endPlanned,
    },
  });

  fx = { meId: me.id, otherId: other.id, startPlanned, endPlanned };
});

afterAll(async () => {
  await admin.$disconnect();
});

beforeEach(async () => {
  await admin.eventShift.updateMany({
    where: { id: { in: [SHIFT, OTHER_SHIFT] } },
    data: { startActual: null, endActual: null, status: "ASSIGNED" },
  });
});

/** clockIn が使う条件付き更新。 */
const punchIn = (shiftId: string, userId: string, at: Date) =>
  admin.eventShift.updateMany({
    where: { id: shiftId, userId, startActual: null },
    data: { startActual: at, status: "CHECKED_IN" },
  });

/** clockOut が使う条件付き更新。 */
const punchOut = (shiftId: string, userId: string, at: Date) =>
  admin.eventShift.updateMany({
    where: { id: shiftId, userId, startActual: { not: null }, endActual: null },
    data: { endActual: at, status: "CHECKED_OUT" },
  });

const read = (id: string) =>
  admin.eventShift.findUniqueOrThrow({
    where: { id },
    select: {
      startActual: true,
      endActual: true,
      status: true,
      startPlanned: true,
      endPlanned: true,
    },
  });

describe("出退勤の打刻", () => {
  it("未出勤の割当に退勤を打っても記録が入らない", async () => {
    const res = await punchOut(SHIFT, fx.meId, new Date("2026-09-30T09:00:00.000Z"));
    expect(res.count).toBe(0);
    const after = await read(SHIFT);
    expect(after.startActual).toBeNull();
    expect(after.endActual).toBeNull();
    expect(after.status).toBe("ASSIGNED");
  });

  it("同時に出勤を打っても 1 件だけ成立し、時刻が動かない", async () => {
    const first = new Date("2026-09-30T01:05:00.000Z");
    const second = new Date("2026-09-30T01:06:00.000Z");
    const [a, b] = await Promise.all([
      punchIn(SHIFT, fx.meId, first),
      punchIn(SHIFT, fx.meId, second),
    ]);
    expect(a.count + b.count).toBe(1);
    const after = await read(SHIFT);
    expect(after.status).toBe("CHECKED_IN");
    // どちらが勝っても、あとから来た方で上書きされない。
    expect([first.getTime(), second.getTime()]).toContain(after.startActual?.getTime());

    // もう一度打っても件数 0（時刻は変わらない）。
    const again = await punchIn(SHIFT, fx.meId, new Date("2026-09-30T02:00:00.000Z"));
    expect(again.count).toBe(0);
    const later = await read(SHIFT);
    expect(later.startActual?.getTime()).toBe(after.startActual?.getTime());
  });

  it("退勤も二重にならず、予定時間は書き換わらない", async () => {
    await punchIn(SHIFT, fx.meId, new Date("2026-09-30T01:00:00.000Z"));
    const out1 = new Date("2026-09-30T09:00:00.000Z");
    const first = await punchOut(SHIFT, fx.meId, out1);
    expect(first.count).toBe(1);

    const second = await punchOut(SHIFT, fx.meId, new Date("2026-09-30T10:00:00.000Z"));
    expect(second.count).toBe(0);

    const after = await read(SHIFT);
    expect(after.endActual?.getTime()).toBe(out1.getTime());
    expect(after.status).toBe("CHECKED_OUT");
    // 予定シフトの時間は打刻で変わらない。
    expect(after.startPlanned.getTime()).toBe(fx.startPlanned.getTime());
    expect(after.endPlanned.getTime()).toBe(fx.endPlanned.getTime());
  });

  it("他人の割当には打刻できない", async () => {
    const res = await punchIn(OTHER_SHIFT, fx.meId, new Date("2026-09-30T01:00:00.000Z"));
    expect(res.count).toBe(0);
    const other = await read(OTHER_SHIFT);
    expect(other.startActual).toBeNull();
    expect(other.status).toBe("ASSIGNED");
  });

  it("本人の割当なら打刻できる（対比）", async () => {
    const res = await punchIn(SHIFT, fx.meId, new Date("2026-09-30T01:00:00.000Z"));
    expect(res.count).toBe(1);
    expect((await read(SHIFT)).status).toBe("CHECKED_IN");
  });
});
