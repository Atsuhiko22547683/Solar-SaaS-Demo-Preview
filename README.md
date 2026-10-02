# BizOrch — 太陽光卸・二次店営業管理 SaaS

太陽光パネルの卸業者（代理店）と、その営業活動を担う二次店（パートナー）事業者が共同で利用する **マルチテナント SaaS**。催事営業を主軸に、場所提供元との交渉 → イベント候補管理 → 二次店希望提出 → 開催体制決定 → 要員シフト → 顧客・アポ → マエカク → 商談・クロージング → 契約・契約明細スナップショット → 粗利・インセンティブ確定 → 月次クローズまでを一気通貫で扱う。

UI 上の製品名は **BizOrch**（`apps/web/lib/i18n/labels.ts` の `brand`）。リポジトリ名・パッケージ名は歴史的経緯から `Solar-SaaS-Demo` / `solar-saas` のままになっている。

---

## ドキュメント

| ファイル                                                                   | 内容                                                                  |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [`CLAUDE.md`](CLAUDE.md)                                                   | このリポジトリを変更するときの恒久ルール（構造・権限・DB・Git）       |
| [`HANDOFF.md`](HANDOFF.md)                                                 | ある時点の作業状態・実装途上の箇所・既知の問題                        |
| [`RELEASE.md`](RELEASE.md)                                                 | Railway へのデモリリース手順書                                        |
| [`docs/01-business-requirements.md`](docs/01-business-requirements.md)     | 業務要件                                                              |
| [`docs/02-functional-requirements.md`](docs/02-functional-requirements.md) | 機能要件                                                              |
| [`docs/03-tech-selection.md`](docs/03-tech-selection.md)                   | 技術選定                                                              |
| [`docs/04-ui-design.md`](docs/04-ui-design.md)                             | 画面設計                                                              |
| [`docs/05-program-design.md`](docs/05-program-design.md)                   | プログラム設計（DB / API / ジョブ / シーケンス）                      |
| [`docs/21-partner-operations.md`](docs/21-partner-operations.md)           | パートナー業務の一気通貫化（催事 ⇄ 依頼 ⇄ 配置 ⇄ 顧客 ⇄ 商談）        |
| [`docs/22-agency-data-integration.md`](docs/22-agency-data-integration.md) | 代理店側の業務データ統合（場所マスタ / 出店希望 / 報告 / アポイント） |
| [`docs/dev-plan.md`](docs/dev-plan.md) / [`docs/sprints/`](docs/sprints/)  | 開発計画とスプリント分解                                              |

---

## 技術スタック

- **Framework**: Next.js 15（App Router / Server Actions）+ React 19 + TypeScript 5 strict
- **Package manager**: pnpm workspace（`packageManager` でバージョン固定）
- **DB**: PostgreSQL 16 + Prisma 6
- **テナント分離**: Prisma Client extension（アプリ層）+ PostgreSQL RLS（DB 層）の二重防御
- **Auth**: Auth.js v5（Credentials Provider / JWT セッション）+ argon2id + TOTP 2FA + バックアップコード + パスワードリセット + 招待
- **Job queue**: graphile-worker（PostgreSQL-backed、Redis 不要）
- **Email**: Resend。テンプレートは `packages/email/src/templates/` に素の TypeScript として持つ。`NODE_ENV=test`、API キーが未設定またはプレースホルダ値、送信元アドレス未設定のいずれかなら stub にフォールバック
- **Object storage**: Cloudflare R2（S3 互換）— pre-signed URL で契約書・施工写真・添付を扱う
- **決済**: Stripe — BizOrch 自身の利用料（太陽光顧客の決済ではない）。テストキーのみ受理
- **UI**: Tailwind CSS + shadcn/ui 系プリミティブ + react-hook-form + Zod + lucide-react + sonner + recharts
- **Observability**: Sentry（`SENTRY_DSN` があるときのみ有効化）+ pino
- **外部連携（受け口のみ）**: 駅すぱあと Web サービス（公共交通の経路・所要時間）
- **Testing**: Vitest（ユニット・統合）/ Playwright（E2E）
- **Hosting**: Railway（Web サービス + Worker サービス + Postgres）

本プロジェクトは **AI ランタイムを持たない**通常の業務管理 Web アプリ。Anthropic / OpenAI などの LLM SDK は導入しない。

---

## 4 サイト構成（`APP_VARIANT`）

同じコードベース・同じ DB から、**4 つのサイトを別プロセスとして**起動する。プロセスごとに違うのは `APP_VARIANT` / ビルド出力先 / ポートの 3 つだけ（`apps/web/scripts/run-site.mjs`）。

| `APP_VARIANT`              | 用途                                                     | ローカルポート | ビルド出力先          | 認証 Cookie 接頭辞     | ホーム         | 公開パス                  |
| -------------------------- | -------------------------------------------------------- | -------------- | --------------------- | ---------------------- | -------------- | ------------------------- |
| `agency`（未設定時の既定） | 一次代理店サイト。二次店（`/d-*`）と SaaS 運営画面も同居 | 3100           | `.next`               | `authjs`               | `/dashboard`   | `/p-` と `/s-` 以外       |
| `partner`                  | 二次店スタッフサイト                                     | 3200           | `.next-partner`       | `partner-authjs`       | `/p-home`      | `/p-*` のうちスタッフ向け |
| `partner-admin`            | 二次店管理者サイト                                       | 3300           | `.next-partner-admin` | `partner-admin-authjs` | `/p-home`      | `/p-*` のうち管理者向け   |
| `system-admin`             | システム提供者の運営管理サイト                           | 3400           | `.next-system-admin`  | `system-admin-authjs`  | `/s-dashboard` | `/s-*` のみ               |

「公開パス」列はそのサイト固有の範囲。これに加えて **全サイト共通で通るパス**がある（`apps/web/lib/app-variant.ts` の `isPublicPath()` / `isSelfServicePath()` が正）。

- 認証系: `/login` `/signup` `/forgot-password` `/reset-password` `/reset` `/invite`
- API: `/api/auth`（Auth.js）`/api/health`
- アカウント自身の操作: `/profile`
- `/`（そのサイトのホームへ振り分けるだけ）

- 公開範囲の判定は **`apps/web/lib/app-variant.ts` の純関数 1 か所**に集約されており、`middleware.ts`（Edge）と各 layout（Node）が同じ関数を見る。画面を隠すのではなく、URL 直打ちを含めて経路ごと遮断する。
- 認証 Cookie 名をサイトごとに分けているので、同じブラウザで 4 サイトへ同時にログインできる。Cookie を親ドメインへ広げる設定（`domain` 指定）は使わない。
- `APP_VARIANT` に値域外の文字列を渡すとプロセスは起動しない（打ち間違いが「別サイトとして公開される」事故を防ぐため）。

---

## モノレポ構成

```
.claude/              開発ハーネス定義（agents / commands）
docs/                 設計成果物（01..05, 21, 22, dev-plan, sprints/, wireframes/）
apps/
  web/                Next.js — UI + Server Actions + API Route Handlers
    app/              ルートグループ (auth)(onboarding)(wholesaler)(dealer)(partner)
                      (saas-admin)(system-admin)(common)(field)
    components/       画面共通コンポーネント（ui / layout / partner / system-admin / reports …）
    lib/              app-variant / tenancy / permissions / i18n / billing / stripe /
                      audit / masking / notifications / jobs / transit / system-admin …
    scripts/          run-site.mjs（サイトごとに Next を起動する)
  worker/             graphile-worker 常駐プロセス（通知送信 / インセンティブ / 月次集計 / リマインダ）
packages/
  db/                 Prisma schema + migrations + Client + RLS extension + withTenant + seed 群
  auth/               Auth.js v5 + argon2 + TOTP + 招待 + パスワードリセット
  contracts/          Zod schemas / DTO / 純関数サービス / ジョブ定義 / logger（packages 横断共有）
  storage/            Cloudflare R2 (S3 互換) pre-signed URL クライアント
  email/              Resend クライアント + メールテンプレート（stub fallback 付き）
  ui/                 プレースホルダ。UI プリミティブの実体は apps/web/components/ui/
tests/
  e2e/                Playwright specs（workers:1 + globalSetup 単一 seed 方針）
```

各パッケージは `@solar/<name>` 命名（`@solar/web`, `@solar/worker`, `@solar/db`, `@solar/auth`, `@solar/contracts`, `@solar/storage`, `@solar/email`, `@solar/ui`, `@solar/e2e`）。

---

## 主要機能

一部の画面は実装途上にある。現在の実装状況は [`HANDOFF.md`](HANDOFF.md) を参照。

### 代理店サイト（`agency`）

- **ホーム** — 当月の催事・契約・インセンティブのダッシュボード
- **イベント管理** — レーンイベント一覧 / 単発イベント一覧 / 場所取り対応状況（場所提供元との交渉）/ 取引先希望一覧（二次店の出店希望 → 回答 → 採用 → 確定イベント）、開催日（`EventDay`）とシフト配置
- **顧客管理** — 顧客一覧 / コール一覧（マエカク）/ アポイント一覧 / 契約一覧（契約明細・粗利・インセンティブ・施工・申請の各タブ）/ ローン審査一覧 / 施工一覧 / 申請一覧
- **手数料管理** — 手数料一覧 / 手数料設定（二次店ごとの料率と改定履歴）
- **製品カタログ** — PV / BT / エコキュート / IH / プレゼント品 / その他
- **決済管理** — BizOrch 利用料の支払状態と Stripe 請求ポータル
- **設定** — スタッフ一覧（`Salesperson`）/ 取引先管理（`Relationship`）/ システムユーザー（`User`）/ エリア・場所管理（エリア / 開催場所・店舗 / 場所提供元）
- **SaaS 運営（運営ロール限定）** — テナント一覧 / プラン管理 / 請求状況

### 二次店向け（代理店サイトに同居・`/d-*`）

ホーム / 公開イベント・担当イベント / 自社顧客・アポ・商談・契約 / 成績 / 月次報告 / インセンティブ / メンバー / マエカク結果。

### パートナーポータル（`partner` / `partner-admin`・`/p-*`）

- **スタッフ** — ホーム（当日の催事シフト・週間カレンダー・出退勤打刻）/ アポイント / 成約報告 / 催事日報 / カタログ / 顧客情報 / シフト / 個人設定
- **管理者** — アポイント管理 / 成約報告管理 / 催事日報管理 / スタッフ情報管理 / 利用者アカウント管理 / 手数料管理 / 自社顧客管理 / 希望ラインの提出 / 場所確保の相談 / シフト管理

1 つの二次店が複数の代理店と取引できる（多対多）。書き込み先の代理店はコンテキストから確定する。

### 運営管理サイト（`system-admin`・`/s-*`）

ダッシュボード / 会社管理 / 利用者管理 / 運営者管理 / 操作履歴 / 稼働状況。会社・利用者は業務サイトと同じテーブルを共有し、管理用の別テーブルは作らない。運営権限（`SAAS_ADMIN`）をページ・API・Server Action で検証する。

### 横断機能

認証（2FA / バックアップコード / 招待 / パスワードリセット / アカウントロック）、権限（ロール × capability）、監査ログ、個人情報マスキング、通知（アプリ内 / メール / LINE 枠）、R2 添付、月次集計・リマインダの定期ジョブ。

### 規模感

Prisma は催事・顧客・商談・契約・施工・申請・インセンティブ・月次・通知・監査を 1 スキーマでカバーし、**全テーブルで RLS を有効化**している。UI 文言は `apps/web/lib/i18n/labels.ts` に全集約（コンポーネント内ハードコード禁止）。権限は `apps/web/lib/permissions/can.ts` のアクション表 1 か所で定義する。

---

## ローカル開発セットアップ

### 前提

- Node.js **22+**（`.nvmrc` 参照）
- pnpm **10 系**（`package.json` の `packageManager` で固定。`corepack enable` 推奨）
- Docker Desktop（Postgres コンテナ用）

### 手順

```bash
# 1. 依存インストール
pnpm install

# 2. 環境変数ファイルを作成（どちらも gitignored）
cp .env.example .env.local
cp .env.example apps/web/.env.local

# 3. Postgres 16 を起動（localhost:5434 / DB: solar_saas_dev）
pnpm db:up

# 4. Prisma Client 生成 + マイグレーション適用
pnpm db:generate
pnpm db:migrate:deploy

# 5. シード投入（いずれか）
pnpm db:seed        # マスタ + 業務デモデータのフルシード
pnpm demo:minimal   # A/B 2 系統だけの最小デモ（画面間の関連を追いやすい）
```

### サイト別に起動する

```bash
pnpm dev:agency                       # http://localhost:3100  代理店
pnpm dev:partner                      # http://localhost:3200  二次店スタッフ
pnpm dev:partner-admin                # http://localhost:3300  二次店管理者
pnpm -F @solar/web dev:system-admin   # http://localhost:3400  運営管理
pnpm dev:worker                       # graphile-worker 常駐プロセス
```

4 サイトは同時に起動できる（ビルド出力先と Cookie 名が分かれている）。1 つだけ動かすなら `pnpm dev:agency` でよい。

### よく使うコマンド

| コマンド                            | 内容                                                       |
| ----------------------------------- | ---------------------------------------------------------- |
| `pnpm db:up` / `pnpm db:down`       | Postgres コンテナの起動 / 停止（`docker-compose.dev.yml`） |
| `pnpm db:migrate:dev`               | マイグレーション作成 + 適用（開発時）                      |
| `pnpm db:studio`                    | Prisma Studio                                              |
| `pnpm demo:purge-e2e`               | E2E が投入したデータの後片付け                             |
| `pnpm ops:create-operator`          | ローカル専用。運営管理サイトの初期運営者を作成             |
| `pnpm build`                        | 全ワークスペースのビルド（`@solar/db` を先に生成）         |
| `pnpm build:sites`                  | サイトごとのプロダクションビルド                           |
| `pnpm format` / `pnpm format:check` | Prettier                                                   |

### デモアカウント

シードを実行すると、以下の**種別**のログインアカウントが作成される。

| 区分                 | 種別                                                     |
| -------------------- | -------------------------------------------------------- |
| 卸業者（代理店）     | 管理者 / イベントチーム / コールチーム / 直販 / 現場要員 |
| 二次店（パートナー） | 管理者 / スタッフ（複数社ぶん）                          |
| SaaS 運営            | 運営者                                                   |

- 実際のメールアドレスは [`packages/db/prisma/seed.ts`](packages/db/prisma/seed.ts) および `prisma/seed-demo-*.ts` を参照。
- パスワードは `SEED_PILOT_PASSWORD`（卸業者・運営）と `SEED_DEMO_PASSWORD`（デモ用アカウント）で指定する。**既定値は dev 専用。本番では必ず上書きすること。**
- 運営管理サイトの初期運営者は公開登録や自己昇格では作れない。ローカルで `pnpm ops:create-operator` を実行する。

---

## 環境変数

`.env.example` がテンプレート。ローカルはリポジトリ直下と `apps/web/` の両方に `.env.local` を置く。本番値は Railway の環境変数に設定し、**値の入った `.env` は絶対にコミットしない**。

| 区分                                                          | 変数                                                                                                                                                                                                              |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| サイト区分                                                    | `APP_VARIANT`                                                                                                                                                                                                     |
| サイト URL（招待リンク・サイト間リンク・稼働状況の probe 先） | `AGENCY_APP_URL`, `PARTNER_APP_URL`, `PARTNER_ADMIN_APP_URL`, `SYSTEM_ADMIN_APP_URL`                                                                                                                              |
| DB                                                            | `DATABASE_URL`（アプリ用・プール可）, **`DATABASE_URL_DIRECT`**（非プール接続。`prisma migrate deploy` 用）                                                                                                       |
| Auth.js v5                                                    | `AUTH_SECRET`, `AUTH_URL`, `AUTH_TRUST_HOST`, `AUTH_SESSION_MAX_AGE_SEC`, `NEXT_PUBLIC_APP_URL`                                                                                                                   |
| 2FA / 暗号                                                    | `TOTP_ISSUER`, `PII_ENCRYPTION_KEY`（AES-256-GCM 用の 64 hex）                                                                                                                                                    |
| Email                                                         | `RESEND_API_KEY`, `RESEND_FROM_ADDRESS` / `RESEND_FROM`, `RESEND_TEST_MODE`                                                                                                                                       |
| Object storage                                                | `R2_ENDPOINT` または `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`                                                                                               |
| 決済                                                          | `STRIPE_SECRET_KEY`（テストキーのみ）, `BILLING_STATUS_OVERRIDE`（dev / E2E 専用）                                                                                                                                |
| Observability                                                 | `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN`（source-map アップロード時のみ）, `LOG_LEVEL`, `LOG_PRETTY` |
| Worker                                                        | `WORKER_CONCURRENCY`, `WORKER_POLL_INTERVAL_MS`                                                                                                                                                                   |
| フィーチャーフラグ                                            | `FEATURE_LINE_NOTIFICATIONS`, `FEATURE_CSV_IMPORT`                                                                                                                                                                |
| シード                                                        | `SEED_PILOT_PASSWORD`, `SEED_DEMO_PASSWORD`, `SEED_BUSINESS_DEMO`                                                                                                                                                 |
| 外部連携                                                      | `EKISPERT_API_KEY`（駅すぱあと。未設定なら経路情報は「未取得」と表示する）                                                                                                                                        |
| 実行環境                                                      | `NODE_ENV`                                                                                                                                                                                                        |

`AUTH_URL` は本番では各サービス自身のホストを指す値を設定する（プロキシ配下では `AUTH_TRUST_HOST="true"` と併用）。

**DB 接続変数の注意**: Prisma が読むのは `packages/db/prisma/schema.prisma` の定義です。

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_URL_DIRECT")
}
```

- 非プール接続（`prisma migrate deploy` が使う）の変数名は **`DATABASE_URL_DIRECT`** です。
- 現在の `.env.example` は同じ用途を `DIRECT_URL` という名前で記載しており、**schema と一致していません**。`.env.example` をコピーしただけでは `directUrl` が解決されず、`pnpm db:validate` / `pnpm db:migrate:deploy` が `P1012: Environment variable not found: DATABASE_URL_DIRECT` で失敗します。この不一致の扱いは [`HANDOFF.md`](HANDOFF.md) の Known Repository Issues を参照してください。
- また **Prisma CLI は `.env.local` を読みません**（`.env` のみ）。CLI 系コマンドを使うときは `.env` を用意するか、`DATABASE_URL` と `DATABASE_URL_DIRECT` をシェル環境で渡してください。テストは `packages/db/__tests__/setup-env.ts` が両方を設定するため、この影響を受けません。

---

## テスト

```bash
pnpm -F @solar/web test        # Vitest。@solar/contracts のテストもここで走る（DB 不要）
pnpm -F @solar/worker test     # Vitest（DB 不要）
pnpm -F @solar/email test
pnpm -F @solar/storage test
pnpm -F @solar/db test         # 実 PostgreSQL が必要（solar_saas_test）
pnpm -F @solar/auth test       # 実 PostgreSQL が必要（solar_saas_test）
pnpm test:e2e                  # Playwright。dev サーバー + DB が必要
pnpm -F @solar/web typecheck   # 変更したパッケージ単位で型チェック
```

- `@solar/contracts` 自体は vitest を持たない。contracts のテストは web ワークスペースの vitest 設定から読み込まれる。
- DB を使うテストは**開発 DB とは別の `solar_saas_test`** に接続する（既定値は `packages/db/__tests__/setup-env.ts`、`packages/db/.env.test` で上書き可）。RLS 経路を検証するため、アプリ用ロールと管理ロールの 2 本の接続を使う。
- Playwright は `workers: 1` / `fullyParallel: false` で、`globalSetup` が 1 回だけシードする。パートナーサイト用の設定は `staff`(3200) / `admin`(3300) の 2 プロジェクトを持つ。

---

## 本番デプロイ（Railway）

`railway.toml` に Web サービスの設定が入っている。

- Build: `pnpm install --frozen-lockfile && pnpm -w run build`
- Pre-deploy: `pnpm db:migrate:deploy`（失敗すればデプロイ中止、現行インスタンスが配信を継続）
- Start: `pnpm --filter @solar/web start`
- Healthcheck: `/api/health`（DB に `SELECT 1` を打ち、到達不能なら 503）
- Worker は同じリポジトリから 2 つ目のサービスを作り、Start Command を `pnpm --filter @solar/worker start` にする（HTTP リスナなし）

手順の詳細とデプロイ後のスモークチェックは [`RELEASE.md`](RELEASE.md) を参照。

---

## 開発ハーネス

本リポジトリは Claude Code subagent による開発ハーネスを同梱している（`.claude/agents/` と `.claude/commands/`）。変更時の恒久ルールとあわせて [`CLAUDE.md`](CLAUDE.md) を参照。

---

## License

Proprietary — Festal-KM. All rights reserved.
