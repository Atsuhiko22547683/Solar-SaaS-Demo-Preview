import { resolve } from "node:path";

import { config } from "dotenv";

// UC-01 用フィクスチャ — 「公開済み（OPEN）のイベント候補」を用意する。
//
// なぜ画面操作ではなく fixture なのか:
//   デモ向けの UI 刷新で、卸業者側のイベント候補詳細から
//     - PromoteForm（場所提供元対応 → 候補への昇格）
//     - 希望受付を開始（DRAFT → OPEN）
//     - VisibilityControl（二次店共有設定）
//   が取り除かれ、現在の画面には該当の操作導線が存在しない。
//   E2E をアプリの現行仕様へ合わせる方針なので、無い画面を叩くのではなく、
//   この前提状態だけを DB で用意し、画面が残っている工程
//   （二次店の希望提出 → 開催体制決定 → シフト）を UI で検証する。
//
// 生成物（すべて RUN_ID 付きの名前で一意化）:
//   EventCandidate（OPEN、pilotWholesaler 配下）
//   EventCandidateVisibility（ACTIVE な Relationship 全件に公開）
//
// 標準出力の最終行に JSON で { candidateId, storeName, relationshipIds } を返す。
// 後片付けは cleanup-uc01-candidate.ts。
//
// RLS を経由しない rawPrisma を使うのは seed/migration と同じ運用例外
// （既存の cleanup-*.ts / setup-e2e-event.ts と同じ方針）。

const REPO_ROOT = resolve(__dirname, "..", "..", "..");
config({ path: resolve(REPO_ROOT, ".env.local") });

// UC-01 の各 step が使う卸業者アカウント（seed 済み）。
const EVENT_TEAM_EMAIL = "wholesaler_event_team@solar-saas.dev";

export function uc01StoreName(runId: string): string {
  return `UC01候補${runId}`;
}

async function main(): Promise<void> {
  const { rawPrisma } = (await import("@solar/db")) as typeof import("@solar/db");

  const runId = process.argv[2];
  if (!runId || !/^\d+$/.test(runId)) {
    console.error("[setup-uc01-candidate] RUN_ID（数字のみ）を引数で渡してください");
    process.exit(1);
    return;
  }

  const owner = await rawPrisma.user.findFirst({
    where: { email: EVENT_TEAM_EMAIL },
    select: { id: true, tenantId: true },
  });
  if (!owner) {
    console.error(`[setup-uc01-candidate] ユーザーが見つかりません: ${EVENT_TEAM_EMAIL}`);
    process.exit(1);
    return;
  }
  const wholesalerId = owner.tenantId;

  const storeName = uc01StoreName(runId);
  const candidate = await rawPrisma.eventCandidate.create({
    data: {
      wholesalerId,
      targetMonth: "2027-03",
      scheduledDate: new Date("2027-03-10T00:00:00.000Z"),
      storeName,
      // 回答期限は十分先に置く（期限切れだと二次店の希望提出が 409 になる）。
      deadlineAt: new Date("2099-12-01T01:00:00.000Z"),
      status: "OPEN",
      publishedAt: new Date("2026-01-01T00:00:00.000Z"),
      createdBy: owner.id,
    },
    select: { id: true },
  });

  // この卸業者の ACTIVE な二次店関係すべてに公開する（画面の「すべて選択 → 公開する」相当）。
  const relationships = await rawPrisma.relationship.findMany({
    where: { wholesalerId, status: "ACTIVE" },
    select: { id: true },
  });
  if (relationships.length > 0) {
    await rawPrisma.eventCandidateVisibility.createMany({
      data: relationships.map((r) => ({
        eventCandidateId: candidate.id,
        relationshipId: r.id,
        isVisible: true,
      })),
      skipDuplicates: true,
    });
  }

  console.info(
    JSON.stringify({
      candidateId: candidate.id,
      storeName,
      relationshipIds: relationships.map((r) => r.id),
    }),
  );

  await rawPrisma.$disconnect();
}

main().catch((err) => {
  console.error("[setup-uc01-candidate] failed", err);
  process.exit(1);
});
