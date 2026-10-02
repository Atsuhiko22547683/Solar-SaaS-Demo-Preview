// 二次店スタッフ向け E2E の追加フィクスチャ（ローカル DB 専用・冪等）。
//
// シード（packages/db/prisma/seed.ts）は触らず、スタッフ画面の検証に必要な最小限だけを
// 後から足す。追加するのは以下で、すべて「二次店アルファ」配下:
//   1. alpha-staff ↔ 販売員行（Salesperson.userId で明示リンク）
//   2. alpha-staff が担当（closingSalespersonId）の顧客 1 件 + 本人担当（ownerUserId）の商談 1 件
//   3. 既存イベントがあれば、その販売員への催事割当（EventSalesperson）1 件
//
// 実行: pnpm -F @solar/db exec tsx ../../tests/e2e/fixtures/partner-staff-fixture.ts
// （global-setup のシード後に spec から呼ぶ）

// DATABASE_URL の解決はシードと同じ preload（.env.local を探す）を使う。
// packages/db をカレントに実行するので相対パスで届く。
import "../../../packages/db/prisma/seed-env.js";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * alpha-admin に DEALER_STAFF ロールも持たせる（ローカル専用・冪等）。
 *
 * サイト分離後、スタッフサイトは DEALER_STAFF を持つ利用者しか使えない。
 * 「同じ二次店の別利用者が提出した報告は本人の一覧に出ない」を確かめるには、
 * スタッフサイトを使える別アカウントが要る。管理者がスタッフ業務も行う運用は
 * 実在するので、ロールを 2 つ持たせた状態を用意する。
 * 管理者サイトでは DEALER_ADMIN として動く（サイトごとに区分が決まる）。
 */
async function ensureAdminCanUseStaffSite() {
  const admin = await prisma.user.findUnique({
    where: { email: "alpha-admin@solar-saas.dev" },
    select: { id: true, roles: { select: { role: true } } },
  });
  if (!admin) throw new Error("fixture: alpha-admin が見つかりません");
  if (admin.roles.some((r: { role: string }) => r.role === "DEALER_STAFF")) return;
  await prisma.userRole.create({ data: { userId: admin.id, role: "DEALER_STAFF" } });
}

// アルファ（APPOINTMENT_ONLY）とガンマ（FULL_CLOSING）の両方に用意する。
// 商談編集の検証はスコープ制限の無いガンマで、報告・シフトの検証はアルファで行う。
const STAFF_EMAILS = ["alpha-staff@solar-saas.dev", "gamma-staff@solar-saas.dev"] as const;
const FIXTURE_TAG = "[E2E staff fixture]";

async function seedFor(staffEmail: string) {
  const staff = await prisma.user.findUnique({ where: { email: staffEmail } });
  if (!staff) throw new Error(`fixture: ${staffEmail} が見つかりません（先にシードを実行）`);

  const relationship = await prisma.relationship.findFirst({
    where: { dealerId: staff.tenantId, status: "ACTIVE" },
  });
  if (!relationship) throw new Error("fixture: alpha の取引関係が見つかりません");

  // 1. 販売員リンク（userId は @unique。既にあればそれを使う）
  let salesperson = await prisma.salesperson.findUnique({ where: { userId: staff.id } });
  if (!salesperson) {
    salesperson = await prisma.salesperson.create({
      data: {
        wholesalerId: relationship.wholesalerId,
        relationshipId: relationship.id,
        userId: staff.id,
        name: staff.name,
        kana: null,
        franchiseNo: relationship.franchiseNo,
        isActive: true,
      },
    });
  }

  // 2. 本人担当の顧客 + 商談（名前のタグで冪等にする）
  const customerName = `${FIXTURE_TAG} 担当顧客`;
  let customer = await prisma.customer.findFirst({
    where: { name: customerName, ownerRelationshipId: relationship.id },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        wholesalerId: relationship.wholesalerId,
        ownerRelationshipId: relationship.id,
        registeredByRelationshipId: relationship.id,
        registeredByUserId: staff.id,
        registeredByOrgType: "DEALER",
        closingRelationshipId: relationship.id,
        closingSalespersonId: salesperson.id,
        name: customerName,
        kana: "イーツーイー タントウコキャク",
        phone: "09000001111",
        mobilePhone: "09000001111",
        prefecture: "埼玉県",
        city: "さいたま市",
        addressLine: "浦和区1-1-1",
        channel: "OTHER",
      },
    });
  }
  const dealExists = await prisma.deal.findFirst({
    where: { customerId: customer.id, ownerUserId: staff.id },
  });
  if (!dealExists) {
    await prisma.deal.create({
      data: {
        customerId: customer.id,
        ownerType: "DEALER",
        ownerUserId: staff.id,
        ownerRelationshipId: relationship.id,
        status: "VISITED",
        note: FIXTURE_TAG,
      },
    });
  }

  // 「同じ二次店の別スタッフ担当」の顧客も 1 件用意する（本人には見えないことの確認用）。
  const admin = await prisma.user.findFirst({
    where: { tenantId: staff.tenantId, roles: { some: { role: "DEALER_ADMIN" } } },
  });
  const otherName = `${FIXTURE_TAG} 他担当顧客`;
  let other = await prisma.customer.findFirst({
    where: { name: otherName, ownerRelationshipId: relationship.id },
  });
  if (!other && admin) {
    other = await prisma.customer.create({
      data: {
        wholesalerId: relationship.wholesalerId,
        ownerRelationshipId: relationship.id,
        registeredByRelationshipId: relationship.id,
        registeredByUserId: admin.id,
        registeredByOrgType: "DEALER",
        name: otherName,
        phone: "09000002222",
        channel: "OTHER",
      },
    });
    await prisma.deal.create({
      data: {
        customerId: other.id,
        ownerType: "DEALER",
        ownerUserId: admin.id,
        ownerRelationshipId: relationship.id,
        status: "VISIT_PLANNED",
        note: FIXTURE_TAG,
      },
    });
  }

  // 3. 催事割当（既存イベントがある場合だけ）
  const event = await prisma.event.findFirst({
    where: { wholesalerId: relationship.wholesalerId },
    orderBy: { createdAt: "asc" },
  });
  if (event) {
    await prisma.eventSalesperson.upsert({
      where: { eventId_salespersonId: { eventId: event.id, salespersonId: salesperson.id } },
      update: {},
      create: { eventId: event.id, salespersonId: salesperson.id, note: FIXTURE_TAG },
    });
  }

  console.info(
    JSON.stringify({
      staff: staffEmail,
      salespersonId: salesperson.id,
      customerId: customer.id,
      otherCustomerId: other?.id ?? null,
      eventId: event?.id ?? null,
    }),
  );
}

async function main() {
  await ensureAdminCanUseStaffSite();
  for (const email of STAFF_EMAILS) await seedFor(email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
