# BizOrch — Claude Code 作業ルール

太陽光パネルの卸業者（代理店）と二次店（パートナー）が共同で利用する **マルチテナント SaaS**。催事営業を主軸に、場所交渉 → イベント候補 → 二次店希望提出 → 開催体制決定 → 要員シフト → 顧客・アポ → マエカク → 商談 → 契約・契約明細スナップショット → 粗利・インセンティブ確定 → 月次クローズまでを扱う。

**このファイルは「変更するときに守る恒久ルール」だけを置く。** システム概要・技術スタック・起動方法は [`README.md`](README.md)、ある時点の作業状態・実装途上の箇所・既知の問題は [`HANDOFF.md`](HANDOFF.md) にある。作業前に両方を読むこと。

## Mental model

このリポジトリに存在する「エージェント」は **Claude Code subagent（開発時のハーネス）だけ**。本体は AI ランタイムを内蔵しない通常の業務管理 Web アプリで、`packages/agents/` のようなランタイムエージェント層は持たない。「プログラマーエージェントを呼んで」は `Agent(subagent_type=programmer, ...)` を指す。

## システム構造（4 サイト / `APP_VARIANT`）

同じコードベース・同じ DB から 4 サイトを別プロセスで起動する。違うのは `APP_VARIANT` / `NEXT_DIST_DIR` / ポートの 3 つだけ（`apps/web/scripts/run-site.mjs`）。対応表は README を参照。

守ること:

1. **公開範囲の判定は `apps/web/lib/app-variant.ts` の純関数 1 か所**。`middleware.ts`（Edge）と各 layout（Node）が同じ関数を見る。判定ロジックを別の場所へ複製しない。
2. prefix 配列（`PARTNER_STAFF_PREFIXES` / `PARTNER_ADMIN_PREFIXES` / `SYSTEM_ADMIN_PREFIXES`）は `/p-*` `/s-*` 専用。
   - 新しい `/p-*` 画面 … `PARTNER_STAFF_PREFIXES` / `PARTNER_ADMIN_PREFIXES` への登録要否を確認する（登録しないとそのサイトから到達できない）。
   - 新しい `/s-*` 画面 … `SYSTEM_ADMIN_PREFIXES` への登録要否を確認する。
   - **`/p-*` `/s-*` 以外（代理店サイト用のパス）をこれらの配列へ追加してはならない。** 代理店サイトは `isAllowedInAgency()` の判定対象で登録は不要。追加すると二次店／運営サイトから代理店画面へ到達でき、`assertCan` では止まらない（例: `customer.read` は `ALL_DEALER_ROLES` を含む）。
3. **ナビから隠すことを遮断と見なさない。** サイドバーの非表示とは別に、`isPathAllowedForVariant` とページ側ガード（`assertCan`）の両方が必要。
4. 認証 Cookie 接頭辞はサイトごとに別名（`authjs` / `partner-authjs` / `partner-admin-authjs` / `system-admin-authjs`）。`domain` 指定で親ドメインへ広げない。
5. `APP_VARIANT` が値域外ならプロセスは起動しない。この挙動を「黙って `agency` に倒す」形へ変えない（打ち間違いが別サイトとして公開される事故を防ぐため）。
6. サイト区分はサーバーの起動設定だけで決まる。URL クエリやリクエストヘッダから切り替える経路を作らない。

## テナント分離と RLS

**全 DB アクセスは 3 段を通す。** 例外を作らない。

```ts
const ctx = await getTenantContext();              // セッション → テナント文脈
assertCan({ user: ctx, action: "customer.read" }); // 権限判定（落ちれば ForbiddenError）
const rows = await withTenant(ctx, async (tx) => { // RLS GUC を張った $transaction
  return tx.customer.findMany();
});
```

- `withTenant` は `$transaction` 内で RLS 用の `SET LOCAL app.*` を発行する（発行内容は `packages/db/src/with-tenant.ts` を参照）。`SET LOCAL` はトランザクション内でしか効かないので、トップレベルの client で呼ばない。正本はこのファイルで、`apps/web/lib/tenancy/with-tenant.ts` は再 export。
- 業務データの分離キーは `relationship_id`（卸業者 × 二次店）、マスタの分離キーは `wholesaler_id`。
- **RLS は全テーブルで有効**（現状 74 モデル / 74 テーブルで有効。migration の `ENABLE ROW LEVEL SECURITY` を一意化した数と `schema.prisma` の `model` 数が一致）。この現状を前提に、新テーブルを足す migration には `ENABLE ROW LEVEL SECURITY` と `CREATE POLICY` を含める。既存のポリシーを一括で無効化・削除しない。
- `isSaasAdmin` は `assertCan` を短絡し、`withTenant` の RLS も素通りする。会社横断の取得・更新は、**運営権限を検証した専用処理**（`apps/web/lib/system-admin/context.ts` の `requireSystemAdmin`）に限定する。業務画面のために `isSaasAdmin` を借りない。

## 権限構造

- ロール（`AppRole`）: `SAAS_ADMIN` ＋ 正式 3 種 `OWNER` / `SYSTEM_ADMIN` / `GENERAL_USER` ＋ 旧ロール 7 種（`WHOLESALER_*` 5 種・`DEALER_ADMIN` / `DEALER_STAFF`）。**旧ロールは既存 `UserRole` 行が参照しているため残すが、新規付与はしない**（管理画面の選択肢にも出さない）。
- `OWNER` / `SYSTEM_ADMIN` / `GENERAL_USER` は単純な上下関係ではない。設定・決済の可否は `Capability`（`"settings" | "payment"`）を `hasCapability()` で個別判定する。包含判定を書かない。
- アクション表は **`apps/web/lib/permissions/can.ts` の 1 か所**。新機能はここにアクションを追加してから、ページと Server Action の両方で `assertCan` する。
- 運営管理サイトのアクション（`system_admin.*`）は `SAAS_ADMIN` のみ。**代理店管理者・パートナー管理者であるだけでは通らない**。この境界はテストで固定してある。
- 監査は `AuditLog` + `recordAudit(tx, input)`。`AuditAction` enum の値域内で記録する。履歴の編集・削除機能は作らない。パスワード・トークン・不要な個人情報は記録しない。
- 監査の `redactPii` は `name` / `phone` / `address` を落とす。会社名などマスクされたくない値は別のキー名（例 `companyName`）で記録する。

## 重要概念（混同しやすいもの）

| 概念 | 意味 |
|---|---|
| `Tenant` | 会社（卸業者 or 二次店）。`status` が `ACTIVE` でないとサインインできない |
| `Relationship` | 卸業者 × 二次店の取引関係。**1 つの二次店が複数の卸業者と取引できる（多対多）**。業務データの分離キー |
| `User` | このアプリにログインできる利用者。UI 上は「システムユーザー」 |
| `Salesperson` | 営業スタッフのマスタ。UI 上は「スタッフ」。`User` とは**別概念**（ログインしないスタッフも存在する） |
| `EventCandidate` / `Event` / `EventDay` | 催事の候補 → 確定イベント → 開催日。日報・アポは開催日に紐づく |
| `EventShift` / `EventSalesperson` | シフト（出退勤の実績 `startActual` / `endActual` / `status` を持つ）と、催事への要員割当。**別物。片方を他方の前提にしない** |
| `LanePreference` → `LanePreferenceAdoption` | 二次店の出店希望 → 採用。確定イベントはここから生まれる |

## Project layout

```
.claude/{agents,commands}/   開発ハーネス定義
docs/                        設計成果物（01..05, 21, 22, dev-plan, sprints/, wireframes/）
apps/web/                    Next.js（app / components / lib / scripts / public / __tests__）
  app/                       (auth)(onboarding)(wholesaler)(dealer)(partner)
                             (saas-admin)(system-admin)(common)(field)
apps/worker/                 graphile-worker 常駐（src/tasks/ + crontab.ts + task-list.ts）
packages/db/                 Prisma schema + migrations + RLS extension + withTenant + seed 群
packages/auth/               Auth.js v5 + argon2 + TOTP + 招待 + パスワードリセット
packages/contracts/          Zod schemas / DTO / 純関数サービス / jobs / logger
packages/storage/            Cloudflare R2 クライアント
packages/email/              Resend + メールテンプレート（stub fallback）
packages/ui/                 UI プリミティブの実体は apps/web/components/ui/
tests/e2e/                   Playwright specs（workers:1 + globalSetup 単一 seed）
```

**このレイアウト外に新しいトップレベル概念を作らない。** 必要なら先に `docs/05-program-design.md` への追記を提案する。

## DB 変更の原則

1. `schema.prisma` と migration は**必ずセット**で変更する。`prisma db push` は使わない（migration 運用に揃えるための方針。リポジトリの現状から導いたもので、明文の決定事項ではない）。
2. migration ディレクトリ名は既存と同じ `YYYYMMDDHHMMSS_snake_case` 形式に合わせる。
3. RLS ポリシー・インデックス・enum 追加は手書き SQL を migration に含める（上記「テナント分離と RLS」参照）。
4. 開発 DB は `solar_saas_dev`（`localhost:5434`）、テスト DB は `solar_saas_test`。**テストが開発 DB を触る形にしない。**
5. 既存マイグレーションを書き換えない。訂正は新しい migration で行う（Prisma の標準運用に合わせた方針。リポジトリの現状から導いたもので、明文の決定事項ではない）。
6. `ContractItem` の契約明細スナップショット列（`purchasePrice` / `dealerPrice` / `listPrice`）の意味を壊さない（下記 Hard rules 4）。
7. シードは `packages/db/prisma/seed.ts`（フル）と `seed-demo-minimal.ts`（A/B 最小構成）が入口。確認用データを増やすときは、既存のデモ構成を壊さず、後片付けできる形にする。

## Git 作業のルール

- **作業ツリーには未コミットの変更が大量に残っていることがある**（量と内訳は `HANDOFF.md` の Snapshot を見る）。未追跡ファイルは git 履歴に存在せず、消したら復元できない。
- **`git reset --hard` / `git restore` / `git checkout -- <path>` / `git clean` / `git stash` を実行しない。** 「不要そうに見える」ファイル（未追跡の migration、`docs/` の新規ファイル、スクラッチ用スクリプト）を独断で削除しない。
- `git add` / `git commit` / `git push` は、ユーザーが明示的に求めたときだけ行う。勝手にコミット単位を決めない。
- `main` へ直接コミットしない。作業は `feature/*` ブランチで行う（既存のブランチ運用から導いた方針。リモートのブランチ保護設定は未確認）。
- **secrets をコミットしない。** `.env.local` / `.env.production` は gitignored。コミットできるのは `.env.example` だけ。実キー・実パスワード・トークンをコード・テスト・ドキュメントに書かない。
- Windows 環境では改行コードが CRLF 混在（`core.autocrlf=true`、`.gitattributes` なし）。**ファイルを書き換えるスクリプトは元ファイルの改行コードを保つこと。** LF で書き戻すと差分が全行になる。

## Hard rules

1. **マルチテナント SaaS。** 複数の卸業者テナント + 二次店テナントが共存する。全 DB アクセスで `getTenantContext` → `assertCan` → `withTenant` を通し、RLS と Prisma extension の二重防御を破らない。
2. **日本語が一次言語。** UI 文言・メール本文・通知テキストはすべて日本語で、`apps/web/lib/i18n/labels.ts` に集約する（コンポーネント内ハードコード禁止）。コード・コメントは英語可。
3. **レイアウト外のファイルを作らない。** 新しいトップレベル概念が必要なら、先に `docs/05-program-design.md` への追記を提案する。
4. **契約明細スナップショット。** 契約成立時の `purchasePrice` / `dealerPrice` / `listPrice` を `ContractItem` の snapshot 列へコピー保持し、商品マスタ改定後も過去契約の粗利が変わらないようにする。
5. **仕入値は二次店に絶対表示しない。** API レスポンスから物理除外する（DTO 層で destructure-and-rest。`Object.keys` に出さない）。実装例は `packages/contracts/src/dto/product.ts` の `ProductForDealerDto = Omit<..., "purchasePrice">` と `dto/lane-preference.ts`。`null` で埋めるのではなくキー自体を消す。
6. **個人情報マスキング。** 電話は下 4 桁・住所は市区町村まで・氏名は姓のみが MVP 既定。pino redact と Sentry `beforeSend` で監査ログ・エラー報告にも適用する。`REVEAL_PII` は監査ログへ記録する。
7. **インセンティブ確定は契約成立時。** キャンセル期限は既定 8 日（卸業者が上書き可、特商法準拠）。期限内は取消し、期限後は負調整。共同開催は案件ごと手動調整。
8. **secrets をコミットしない。** 本番値は Railway の環境変数に置く（上記「Git 作業のルール」参照）。
9. **AI ランタイムを使わない。** Claude / OpenAI / 画像生成 API は導入しない。`token_usage` 相当のテーブルも作らない。LLM 呼び出しを伴うコードは原則受け入れない。
10. **UI を新規作成・修正するときは必ず `ui-ux-pro-max` スキルを使う。** 画面・コンポーネント・モーダル・レイアウト・配色・タイポグラフィ・余白・インタラクションなど「見た目／操作感」に関わる変更では、着手前にスキルを参照し、情報階層・データ密度・アクセシビリティ（コントラスト 4.5:1 / フォーカス / キーボード）・モーション指針に沿って実装する。ルール 2 の文言集約と併せて遵守する。
    なお **このスキルの定義はこのリポジトリ内には無い**（`.claude/` には `agents/` と `commands/` のみ）。利用環境に存在すれば使う。存在しない場合は `docs/04-ui-design.md` と `docs/design-tokens.md` の設計指針を優先する。

## 作業完了時の確認

- **変更したパッケージ単位で**型チェック: `pnpm -F <pkg> typecheck`。
- **変更したパッケージ単位で**テスト: `pnpm -F @solar/web test` など。`@solar/contracts` のテストは web ワークスペースの vitest から走る（contracts 単体に vitest は無い）。
- lint は変更ファイルに限定する（`npx eslint <path>`）。
- **変更完了の判定は、まず変更スコープの typecheck / test / lint で行う。** ワークスペース全体のコマンド（`pnpm typecheck` / `pnpm lint` / `pnpm format:check` / `pnpm test`）が失敗する場合は `HANDOFF.md` の Tests を確認し、リポジトリ全体の既知の問題なのか今回の変更による問題なのかを切り分ける。全体が通ることを完了条件にしない。
- DB を変えたら: migration があるか / RLS ポリシーがあるか / `pnpm db:validate` が通るか。
- UI を変えたら: `ui-ux-pro-max` の指針に沿っているか / 文言が `labels.ts` にあるか / スマホ幅で崩れないか。
- 権限を変えたら: `can.ts` のアクション追加 / ページ側ガード / `app-variant.ts` の公開パス。
- **「未取得の情報」「未実装の機能」を完了扱いにしない。** 根拠なく「正常」「0 件」と表示・報告しない。取得できないものは「未取得」「未連携」と出す。
- 全テスト・全ビルドを反復しない。変更スコープと直接関係する範囲に絞る。

## やらないこと

- 既存のデータアクセス制御・RLS の一括解除、`isSaasAdmin` の便宜的な流用
- ダミー顧客・架空日時・架空契約・架空の打刻を自動生成して画面を埋めること
- 推測値・直線距離を「経路検索結果」として表示すること（`apps/web/lib/transit/` の方針）
- 生の検証エラー JSON を画面に出すこと（項目別の日本語メッセージにする）
- 不明な enum 値を既定値へ黙って変換すること、エラーを消すために必須条件を外すこと
- 一般利用者向けの「未紐付けデータ修復」メニューを作ること
- AI / LLM 呼び出し、画像生成 API の導入

## 開発ハーネス

`.claude/agents/` に設計・実装・レビュー用の subagent 定義（`biz-requirements` / `functional-requirements` / `tech-selection` / `ui-design` / `designer` / `program-design` / `pm` / `design-reviewer` / `programmer` / `code-reviewer` / `e2e-tester`）、`.claude/commands/` に `/iterate`（programmer → code-reviewer → e2e-tester のループ）と `/design-iterate`（設計エージェント → design-reviewer のループ）がある。

**各ループの合否判定プロトコル・最大反復回数・差し戻し手順は、それぞれの定義ファイル（`.claude/agents/<name>.md` / `.claude/commands/<name>.md`）を参照すること。** ここには再掲しない。

## 参照ドキュメント

| 用途 | ファイル |
|---|---|
| 概要・構成・起動方法 | [`README.md`](README.md) |
| 現在の作業状態・実装途上の箇所・既知の問題 | [`HANDOFF.md`](HANDOFF.md) |
| 業務要件 / 機能要件 / 技術選定 / 画面設計 / プログラム設計 | `docs/01` 〜 `docs/05` |
| パートナー業務の一気通貫化 | `docs/21-partner-operations.md` |
| 代理店側の業務データ統合・最小デモ構成 | `docs/22-agency-data-integration.md` |
| 開発計画・スプリント | `docs/dev-plan.md` / `docs/sprints/` |
| 一次資料 | `product-proposal.md` |
