import { resolve } from "node:path";

import { config } from "dotenv";

// E2E フィクスチャ作成 — 販売員アサインの検証に必要な Event と Salesperson を
// テスト側で用意する。
//
// 本番シード (packages/db/prisma/seed.ts) は拡張しない。シードは全 E2E と手動
// 確認が共有する土台なので、1 スペックのためだけに行を足すと他の一覧の件数
// 前提が崩れる。ここで作ったものは cleanup-e2e-event.ts で必ず消す。
//
// 生成物（すべて RUN_ID 付きの名前で一意化）:
//   EventCandidate（DECIDED） → Event（SELF / PLANNED）
//   Salesperson 1 件（アサイン対象）
//
// 標準出力に JSON で { eventId, salespersonId, salespersonName } を返す。
// RLS を経由しない rawPrisma を使うのは seed/migration と同じ運用例外
// （既存の cleanup-*.ts と同じ方針）。

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
config({ path: resolve(REPO_ROOT, ".env.local") });

const DEMO_EMAIL = "demo@solar-saas.demo";

async function main(): Promise<void> {
  const { rawPrisma } = (await import("@solar/db")) as typeof import("@solar/db");

  const runId = process.argv[2];
  if (!runId || !/^\d+$/.test(runId)) {
    console.error("[setup-e2e-event] RUN_ID（数字のみ）を引数で渡してください");
    process.exit(1);
    return;
  }

  // デモユーザーの所属卸業者を土台にする（画面から見えるテナントに揃えるため）。
  const demoUser = await rawPrisma.user.findFirst({
    where: { email: DEMO_EMAIL },
    select: { id: true, tenantId: true },
  });
  if (!demoUser) {
    console.error(`[setup-e2e-event] デモユーザーが見つかりません: ${DEMO_EMAIL}`);
    process.exit(1);
    return;
  }
  const wholesalerId = demoUser.tenantId;

  const scheduledDate = new Date("2026-09-15T00:00:00.000Z");
  const candidate = await rawPrisma.eventCandidate.create({
    data: {
      wholesalerId,
      targetMonth: "2026-09",
      scheduledDate,
      storeName: `E2E催事${runId}`,
      deadlineAt: new Date("2026-09-01T00:00:00.000Z"),
      status: "DECIDED",
      createdBy: demoUser.id,
    },
    select: { id: true },
  });

  const event = await rawPrisma.event.create({
    data: {
      wholesalerId,
      eventCandidateId: candidate.id,
      mode: "SELF",
      status: "PLANNED",
      decidedBy: demoUser.id,
    },
    select: { id: true },
  });

  const salespersonName = `E2Eアサイン販売員${runId}`;
  const salesperson = await rawPrisma.salesperson.create({
    data: {
      wholesalerId,
      name: salespersonName,
      franchiseNo: `AS${String(runId).slice(-8)}`,
      isActive: true,
    },
    select: { id: true },
  });

  // spec 側が読み取る唯一の出力。ログ行と混ざらないよう JSON 1 行で出す。
  console.info(
    JSON.stringify({
      eventId: event.id,
      salespersonId: salesperson.id,
      salespersonName,
    }),
  );

  await rawPrisma.$disconnect();
}

main().catch((err) => {
  console.error("[setup-e2e-event] failed", err);
  process.exit(1);
});
