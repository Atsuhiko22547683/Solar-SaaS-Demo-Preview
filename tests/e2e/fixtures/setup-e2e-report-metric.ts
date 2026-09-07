import { resolve } from "node:path";

import { config } from "dotenv";

// E2E フィクスチャ — 追加集計項目（EventReportMetric）の画面操作に必要な
// 「イベント + 提出済みの成果報告（WHOLESALER）」を用意する。
//
// 本番シード (packages/db/prisma/seed.ts) は拡張しない。シードは全 E2E と手動
// 確認が共有する土台なので、1 スペックのためだけに行を足さない。
// ここで作ったものは cleanup-e2e-report-metric.ts で必ず消す。
//
// 標準出力の最終行に JSON で { eventId, reportId } を返す。
// RLS を経由しない rawPrisma を使うのは seed/migration と同じ運用例外。

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
config({ path: resolve(REPO_ROOT, ".env.local") });

const DEMO_EMAIL = "demo@solar-saas.demo";

async function main(): Promise<void> {
  const { rawPrisma } = (await import("@solar/db")) as typeof import("@solar/db");

  const runId = process.argv[2];
  if (!runId || !/^\d+$/.test(runId)) {
    console.error("[setup-e2e-report-metric] RUN_ID（数字のみ）を引数で渡してください");
    process.exit(1);
    return;
  }

  const demo = await rawPrisma.user.findFirst({
    where: { email: DEMO_EMAIL },
    select: { id: true, tenantId: true },
  });
  if (!demo) {
    console.error(`[setup-e2e-report-metric] デモユーザーが見つかりません: ${DEMO_EMAIL}`);
    process.exit(1);
    return;
  }

  const candidate = await rawPrisma.eventCandidate.create({
    data: {
      wholesalerId: demo.tenantId,
      targetMonth: "2027-04",
      scheduledDate: new Date("2027-04-12T00:00:00.000Z"),
      storeName: `E2E集計催事${runId}`,
      deadlineAt: new Date("2027-04-01T00:00:00.000Z"),
      status: "DECIDED",
      createdBy: demo.id,
    },
    select: { id: true },
  });

  const event = await rawPrisma.event.create({
    data: {
      wholesalerId: demo.tenantId,
      eventCandidateId: candidate.id,
      mode: "SELF",
      status: "PLANNED",
      decidedBy: demo.id,
    },
    select: { id: true },
  });

  // 追加集計項目は成果報告にぶら下がるので、提出済みの RESULT を 1 件用意する。
  // 固定集計項目は従来どおり payload 側に持つ（このスペックでは触らない）。
  const report = await rawPrisma.eventReport.create({
    data: {
      eventId: event.id,
      type: "RESULT",
      reporterUserId: demo.id,
      reporterOrgType: "WHOLESALER",
      payload: {
        approachCount: 30,
        surveyCount: 15,
        totalAppts: 5,
        validAppts: 3,
        invalidAppts: 2,
        comment: null,
      },
    },
    select: { id: true },
  });

  console.info(JSON.stringify({ eventId: event.id, reportId: report.id }));

  await rawPrisma.$disconnect();
}

main().catch((err) => {
  console.error("[setup-e2e-report-metric] failed", err);
  process.exit(1);
});
