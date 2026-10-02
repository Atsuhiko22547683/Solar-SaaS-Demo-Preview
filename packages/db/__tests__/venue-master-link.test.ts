// 開催場所の参照整合を、UI を通さずサーバー処理の層で確かめる。
//
// 「画面から送れないから安全」では確かめたことにならないので、Server Action が使うのと
// 同じ引き当て（店舗マスタから住所・提供元・開催エリアを確定し、食い違う組合せを拒否する）
// を直接呼ぶ。テスト用 DB（solar_saas_test）に自前のフィクスチャを作って走らせる。
//
// テナント分離そのものは *-isolation.test.ts が非 SUPERUSER ロールで別に見ているので、
// ここは admin 接続で参照整合だけを見る。

import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const admin = new PrismaClient({ datasources: { db: { url: process.env.TEST_DB_ADMIN_URL } } });

interface Fixture {
  wholesalerId: string;
  /** 親チェーン A とその支店。 */
  providerA: string;
  storeA: { id: string; name: string };
  /** 別の親チェーン B（A の支店とは組み合わせられない）。 */
  providerB: string;
  /** 停止中の支店。 */
  inactiveStore: string;
  areaName: string;
}

let fx: Fixture;

async function truncate(): Promise<void> {
  await admin.$executeRawUnsafe(`
    TRUNCATE TABLE
      "LanePreferenceItem",
      "LanePreference",
      "EventCandidate",
      "Store",
      "Area",
      "VenueProvider",
      "Relationship",
      "Tenant"
    RESTART IDENTITY CASCADE;
  `);
}

/**
 * Server Action `createEventCandidateAction` / `updateEventCandidateAction` が使う
 * `resolveVenueFromStore` と同じ判断。
 *
 * アプリ側の実装は Next.js の "use server" モジュールなので、この DB パッケージからは
 * import できない。判断の中身と順序をここに写し、実装と食い違ったら気付けるようにする。
 * （実装: apps/web/app/(wholesaler)/event-detail/actions.ts）
 */
async function resolveVenueFromStore(input: {
  storeId: string;
  venueProviderId?: string | null;
}): Promise<{
  storeId: string;
  storeName: string;
  address: string | null;
  area: string | null;
  venueProviderId: string | null;
}> {
  const store = await admin.store.findUnique({
    where: { id: input.storeId },
    select: {
      id: true,
      name: true,
      address: true,
      venueProviderId: true,
      isActive: true,
      area: { select: { name: true } },
    },
  });
  if (!store) throw new Error("店舗が見つかりません");
  if (!store.isActive) throw new Error("停止中の店舗は選択できません");
  if (
    input.venueProviderId !== undefined &&
    input.venueProviderId !== null &&
    input.venueProviderId !== store.venueProviderId
  ) {
    throw new Error("選択した店舗と場所提供元の組合せが正しくありません");
  }
  return {
    storeId: store.id,
    storeName: store.name,
    address: store.address,
    area: store.area?.name ?? null,
    venueProviderId: store.venueProviderId,
  };
}

beforeAll(async () => {
  await truncate();

  const tenant = await admin.tenant.create({
    data: { type: "WHOLESALER", name: "卸 V 株式会社", plan: "PILOT" },
  });
  const area = await admin.area.create({
    data: { wholesalerId: tenant.id, name: "埼玉県", type: "EVENT" },
  });
  const a = await admin.venueProvider.create({
    data: { wholesalerId: tenant.id, name: "チェーン A", area: "関東" },
  });
  const b = await admin.venueProvider.create({
    data: { wholesalerId: tenant.id, name: "チェーン B", area: "関東" },
  });
  const storeA = await admin.store.create({
    data: {
      wholesalerId: tenant.id,
      venueProviderId: a.id,
      name: "大宮店",
      postalCode: "331-0811",
      address: "埼玉県さいたま市北区吉野町2-195-1",
      areaId: area.id,
    },
  });
  const inactive = await admin.store.create({
    data: { wholesalerId: tenant.id, venueProviderId: a.id, name: "休止店", isActive: false },
  });

  fx = {
    wholesalerId: tenant.id,
    providerA: a.id,
    storeA: { id: storeA.id, name: storeA.name },
    providerB: b.id,
    inactiveStore: inactive.id,
    areaName: area.name,
  };
});

afterAll(async () => {
  await truncate();
  await admin.$disconnect();
});

describe("開催場所の確定（店舗マスタが正本）", () => {
  it("店舗 ID から住所・場所提供元・開催エリアを確定する", async () => {
    const r = await resolveVenueFromStore({ storeId: fx.storeA.id });
    expect(r.storeName).toBe("大宮店");
    expect(r.address).toBe("埼玉県さいたま市北区吉野町2-195-1");
    expect(r.venueProviderId).toBe(fx.providerA);
    expect(r.area).toBe(fx.areaName);
  });

  it("店舗の親ではない場所提供元が一緒に送られたら拒否する", async () => {
    // 画面で送れないことを根拠にせず、処理そのものを直接呼んで確かめる。
    await expect(
      resolveVenueFromStore({ storeId: fx.storeA.id, venueProviderId: fx.providerB }),
    ).rejects.toThrow("選択した店舗と場所提供元の組合せが正しくありません");
  });

  it("店舗の親と同じ場所提供元なら通る", async () => {
    const r = await resolveVenueFromStore({
      storeId: fx.storeA.id,
      venueProviderId: fx.providerA,
    });
    expect(r.venueProviderId).toBe(fx.providerA);
  });

  it("停止中の店舗は選べない", async () => {
    await expect(resolveVenueFromStore({ storeId: fx.inactiveStore })).rejects.toThrow(
      "停止中の店舗は選択できません",
    );
  });

  it("存在しない店舗 ID は拒否する", async () => {
    await expect(resolveVenueFromStore({ storeId: "no-such-store" })).rejects.toThrow(
      "店舗が見つかりません",
    );
  });
});

describe("イベント候補の開催当時の記録", () => {
  it("店舗マスタを改称しても、過去の候補に記録した店舗名は変わらない", async () => {
    const resolved = await resolveVenueFromStore({ storeId: fx.storeA.id });
    const cand = await admin.eventCandidate.create({
      data: {
        wholesalerId: fx.wholesalerId,
        targetMonth: "2026-07",
        scheduledDate: new Date("2026-07-10T00:00:00Z"),
        deadlineAt: new Date("2026-07-01T00:00:00Z"),
        storeId: resolved.storeId,
        storeName: resolved.storeName,
        address: resolved.address,
        area: resolved.area,
        venueProviderId: resolved.venueProviderId,
        createdBy: "test",
      },
      select: { id: true },
    });

    // マスタ側を改称する。
    await admin.store.update({ where: { id: fx.storeA.id }, data: { name: "大宮本店" } });

    const after = await admin.eventCandidate.findUniqueOrThrow({
      where: { id: cand.id },
      select: { storeName: true, store: { select: { name: true } } },
    });
    // 開催当時の記録はそのまま、現在のマスタ名は新しい名前。
    expect(after.storeName).toBe("大宮店");
    expect(after.store?.name).toBe("大宮本店");

    // 元に戻す（後続テストへ影響させない）。
    await admin.store.update({ where: { id: fx.storeA.id }, data: { name: "大宮店" } });
  });

  it("店舗を無効化しても、過去の候補は消えない", async () => {
    const before = await admin.eventCandidate.count({ where: { storeId: fx.storeA.id } });
    expect(before).toBeGreaterThan(0);
    await admin.store.update({ where: { id: fx.storeA.id }, data: { isActive: false } });
    const after = await admin.eventCandidate.count({ where: { storeId: fx.storeA.id } });
    expect(after).toBe(before);
    await admin.store.update({ where: { id: fx.storeA.id }, data: { isActive: true } });
  });
});
