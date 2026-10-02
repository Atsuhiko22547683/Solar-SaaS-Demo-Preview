# HANDOFF — BizOrch 引き継ぎ（2026-10-02 時点）

このファイルは **ある時点の作業状態**を記録したもの。システム概要・構成・起動方法は [`README.md`](README.md)、変更時に守る恒久ルールは [`CLAUDE.md`](CLAUDE.md) にある。

記載内容はすべて実測値。確認できていないものは [Unknown / Not Verified](#unknown--not-verified) に分けてある。**推測は含めない。**

---

## Snapshot

| 項目                                     | 値                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| 日付                                     | 2026-10-02                                                                   |
| ブランチ                                 | `feature/partner-portal`                                                     |
| **HEAD**                                 | `1af74c2ce93a05f66d30f937d5fe0d143cb059d9`（短縮 `1af74c2`）                 |
| HEAD のコミット                          | `chore(db): デモデータ生成とE2E後処理を整理`                                 |
| remote `origin`                          | `https://github.com/Atsuhiko22547683/Solar-SaaS-Demo-Preview.git`            |
| remote `upstream`                        | `https://github.com/Festal-KM/Solar-SaaS-Demo.git`                           |
| `main` / `origin/main` / `upstream/main` | すべて `00193f1`（2026-07-10）                                               |
| `main..HEAD`                             | **23 ahead / 0 behind**                                                      |
| 当該ブランチの upstream 設定             | **なし**（`git push` は remote とブランチを明示する必要がある）              |
| 最終 fetch                               | 2026-09-07（`.git/FETCH_HEAD`）。ローカルの `origin/*` / `upstream/*` は古い |
| **push**                                 | **未実施**                                                                   |
| working tree                             | `README.md` / `CLAUDE.md` / `HANDOFF.md` の 3 件のみ（このコミットで解消）   |
| staged / stash / conflict                | **0 / 0 / 0**                                                                |

---

## Git 整理：完了

着手時点で **394 実ファイル**（`git status --porcelain` では 301 エントリ）が未コミットだった。これを「同じ機能として一緒に存在しないと成立しない変更」の単位へ分類し、**16 コミット**に整理した。

### 作成したコミット（古い順）

| #   | hash      | message                                                   | 件数 |
| --- | --------- | --------------------------------------------------------- | ---- |
| 1   | `4d7a129` | `feat(db): schema と migration 9 本をまとめて追加`        | 14   |
| 2   | `71fdd25` | `feat(i18n): パートナー・管理機能向け日本語ラベルを追加`  | 1    |
| 3   | `a4d8068` | `feat(transit): 駅すぱあと連携の受け口を追加`             | 1    |
| 4   | `c042511` | `feat(contracts): パートナー業務向け共有スキーマを追加`   | 32   |
| 5   | `9c72fb1` | `feat(permissions): パートナー・運営管理向け権限を拡張`   | 7    |
| 6   | `f06cb02` | `feat(sites): APP_VARIANTで4サイト構成を追加`             | 20   |
| 7   | `f42f8a6` | `fix(ui): スマホ幅での一覧・認証画面表示を改善`           | 19   |
| 8   | `3ff1650` | `feat(billing): Stripe利用料決済と利用制限を追加`         | 22   |
| 9   | `727c659` | `feat(catalog): 製品カタログを6分類のDB管理へ移行`        | 16   |
| 10  | `d7d2679` | `feat(partner): パートナースタッフ・管理者ポータルを追加` | 127  |
| 11  | `aac8749` | `feat(partner): ホーム・出退勤・個人設定を追加`           | 13   |
| 12  | `c14f256` | `feat(members): システムユーザーとロール階層管理を追加`   | 11   |
| 13  | `1242b55` | `feat(system-admin): BizOrch運営管理サイトを追加`         | 32   |
| 14  | `f82683e` | `feat(agency): パートナー報告を代理店業務へ統合`          | 60   |
| 15  | `eaf6325` | `refactor: 二次店の呼称をパートナーへ統一`                | 4    |
| 16  | `1af74c2` | `chore(db): デモデータ生成とE2E後処理を整理`              | 10   |

> 件数はコミットに含まれるパス数。`package.json` / `apps/web/package.json` / `.gitignore` は hunk 分割のため複数コミットに登場する。

### コミットしなかったもの（8 ファイル）

| 分類                         | 対象                                                                                                                                                               | 処置                                                                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **整形のみ（意味変更ゼロ）** | `packages/contracts/src/schemas/` の `application.ts` / `commission-rate.ts` / `contract-item.ts` / `deal.ts` / `incentive-adjust.ts` / `pre-call-notification.ts` | 空白・カンマ・セミコロンを無視すると HEAD と同一であることを確認し **restore（破棄）**                                                                                                                                                         |
| **用途不明の一時スクリプト** | `packages/db/prisma/_diag.ts`                                                                                                                                      | 参照 0・`package.json` 未登録・`tsconfig` の include 外。調査対象だった場所マスタの参照整合は migration と `venue-master-link.test.ts` で解決済みのため **削除**                                                                               |
| **旧版シード**               | `packages/db/prisma/seed-partner-flow.ts`                                                                                                                          | 参照 0。後継は `seed-demo-single-agency.ts` で、`demo-data-origin.ts` が `bizflow_` / `[BIZ]` を purge 対象（old-demo）に分類している。多代理店の検証は `partner-multi-agency-isolation.test.ts` が自前フィクスチャでカバー済みのため **削除** |

### hunk 分割した共有ファイル

| ファイル                   | 分割先                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| `package.json`（ルート）   | `dev:*` / `build:sites` → `f06cb02` ／ `ops:create-operator` → `1242b55` ／ `demo:*` → `1af74c2` |
| `apps/web/package.json`    | `dev:*` `build:*` `start:*` 12 本 → `f06cb02` ／ `"stripe"` 依存 → `3ff1650`                     |
| `.gitignore`               | `.next-partner*` `.next-system-admin` → `f06cb02` ／ `tests/e2e/screenshots/` → `f42f8a6`        |
| `packages/db/package.json` | `ops:create-operator` → `1242b55` ／ `demo:*` → `1af74c2`                                        |

`packages/db/prisma/schema.prisma` は**安全優先で分割せず**、migration 9 本と同一コミット（`4d7a129`）に入れた。

### 整理中に行った最小 lint 修正（husky / lint-staged 対応・いずれも挙動不変）

| 対象                                                                         | 内容                                                                                                                                                        |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/e2e/partner-lists.spec.ts`                                            | 未使用の `const ADMIN` を削除（宣言 1 件のみで参照 0）                                                                                                      |
| `tests/e2e/fixtures/partner-{admin,report-events,shift,staff}-fixture.ts`    | `console.log` → `console.info`（4 件）。出力する JSON の内容・対象・回数・stdout を使う点は不変（`execSync` 側が stdout を読む設計を維持）                  |
| `apps/web/app/(wholesaler)/event-detail/[id]/decide/event-decision-form.tsx` | 未使用 import `useRef` を削除                                                                                                                               |
| `apps/web/app/(wholesaler)/dashboard/data.ts`                                | 売上推移ループ内の未使用 `const m` を削除（`trendMonths` は `d` を使うため結果不変）                                                                        |
| `packages/db/prisma/demo-data-origin.ts`                                     | 日本語氏名の正規表現 `[ 　]` の全角スペースを `　` エスケープへ。**regex の `source` が同一**で、半角・全角どちらの区切りも従来どおり一致することを実証済み |
| `packages/db/prisma/seed-demo-single-agency.ts`                              | `console.log` → `console.info`（11 件）                                                                                                                     |

`--no-verify` は一度も使っていない。**全 16 コミットが husky + lint-staged（`eslint --fix --max-warnings=0` + `prettier --write`）を通過**している。

---

## migration 9 本

`schema.prisma` と同一コミット（`4d7a129`）に含めた。**どのコミット時点でも schema と migration が揃い、`prisma migrate deploy` が完全に適用できる**状態を保つため。

| migration                                                 | 対応機能                     | 実装コミット               |
| --------------------------------------------------------- | ---------------------------- | -------------------------- |
| `20260909000000_product_catalog_fields`                   | 製品カタログ                 | `727c659`                  |
| `20260910000000_tenant_stripe_customer`                   | Stripe 利用料決済            | `3ff1650`                  |
| `20260915000000_partner_visit_and_contract`               | パートナー訪問アポ・成約報告 | `d7d2679`                  |
| `20260924000000_dealer_commission_rate_dealer_read`       | パートナー手数料閲覧         | `d7d2679`                  |
| `20260928000000_partner_event_days_and_lane_threads`      | 開催日・出店希望の往復       | `d7d2679`                  |
| `20260928010000_partner_multi_agency_rls`                 | 1 社 × 複数代理店の RLS 分離 | `d7d2679` / `f82683e` 共有 |
| `20260928020000_customer_activity_event_link`             | 商談履歴の催事紐付け         | `f82683e`                  |
| `20260929000000_venue_master_link_and_report_integration` | 場所マスタ正本化・報告統合   | `f82683e`                  |
| `20260929010000_appointment_sort_relations`               | アポ一覧の並べ替え           | `f82683e`                  |

### 開発 DB の適用状態（実測）

```
_prisma_migrations : 81 migrations / finished 81 / rolled_back 0 / in_progress 0
disk               : 81 migrations  →  drift 0
prisma migrate status: "Database schema is up to date!"
```

9 本すべて `applied`。pending / failed / rolled back / 未記録はいずれも 0 件。

---

## テスト結果（2026-10-02 実測・最終）

### PASS

| コマンド                                                                                                           | 結果                                                            |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `pnpm -F @solar/web test`                                                                                          | **111 files / 1128 tests / 1128 passed / 0 failed / 0 skipped** |
| `pnpm -F @solar/auth test`                                                                                         | **4 files / 28 tests / 28 passed / 0 failed**                   |
| `pnpm -F @solar/worker test`                                                                                       | 5 files / 25 tests PASS                                         |
| `pnpm -F @solar/email test`                                                                                        | 1 file / 21 tests PASS                                          |
| `pnpm -F @solar/storage test`                                                                                      | 1 file / 14 tests PASS                                          |
| `pnpm -F <pkg> typecheck`（db / contracts / auth / email / storage / ui / worker / web の **8 パッケージすべて**） | **すべて OK**                                                   |

`@solar/contracts` のテストは `apps/web` の Vitest suite に含まれる（`packages/contracts/package.json` の `test` script がそう宣言しており、`apps/web/vitest.config.ts:22` の `include` が `../../packages/contracts/__tests__/**` を指す）。contracts のテストは **35 files / FAIL 0**。

### FAIL（既知・1 件のみ）

| コマンド                 | 結果                                                                   |
| ------------------------ | ---------------------------------------------------------------------- |
| `pnpm -F @solar/db test` | **14 files / 160 tests / 157 passed / 3 failed / 0 skipped**（EXIT 1） |

**失敗 3 件はすべて `packages/db/__tests__/seed.test.ts`：**

```
seedAll() > creates 5 tenants, 3 relationships and 12 users on first run
seedAll() > is idempotent — running twice yields the same row counts
seedAll() > uses the documented dealer scope distribution across the 3 relationships
  → expect(byDealer.get("二次店アルファ")).toBe("APPOINTMENT_ONLY") が undefined
```

**整理開始前の HEAD `ec2a127` 由来の既存問題。** HEAD の `seed.ts` が作る会社名は 株式会社サンライズソーラー / 株式会社グリーンフィールド / 株式会社スマイル電設 で、`seed.test.ts` が期待する「二次店アルファ / ベータ / ガンマ」は整理開始前から存在しない。

`seed.test.ts` は**追跡済み・未変更**のため 394 ファイルの台帳のどのコミットにも属さず、修正は別作業。

### E2E：未実行

**環境は整っているが意図的に実行していない。**

| 前提                  | 状態                                                                    |
| --------------------- | ----------------------------------------------------------------------- |
| PostgreSQL            | ✅ `solar-saas-pg` healthy / `localhost:5434`                           |
| Playwright / ブラウザ | ✅ 1.60.0 / `chromium-1223` ほか                                        |
| fixtures の依存解決   | ✅ 実行時は `execSync("pnpm -F @solar/db exec tsx …")` 経由で解決される |

**理由：現在の `tests/e2e/global-setup.ts` が開発 DB（`solar_saas_dev`）を再シードする。**

```
global-setup.ts:16  execSync("pnpm db:seed")
global-setup.ts:23  execSync("… tsx prisma/seed-demo-single-agency.ts")
seed-env.ts         ENV_CANDIDATES = [ .env.local, apps/web/.env.local, .env ]
                    → DATABASE_URL は solar_saas_dev を指す
```

E2E を実行すると**最小デモ A/B のデータが上書きされる**。実行前に最小デモの扱いを決める必要がある。

### 4 サイトの起動確認（実測）

| サイト        | port | `APP_VARIANT`   | `NEXT_DIST_DIR`       | `GET /login` |
| ------------- | ---- | --------------- | --------------------- | ------------ |
| agency        | 3100 | `agency`        | `.next`               | **200**      |
| partner       | 3200 | `partner`       | `.next-partner`       | **200**      |
| partner-admin | 3300 | `partner-admin` | `.next-partner-admin` | **200**      |
| system-admin  | 3400 | `system-admin`  | `.next-system-admin`  | **200**      |

4 サイト同時起動で **variant の混線なし**（他サイトのパスは各 variant のホームへ遮断される。遮断テスト 7/7 が期待どおり）。4 つの dist dir が独立して更新され、`.next` の共有は起きていない。

---

## Known Issues

### 1. 駅すぱあと連携は未接続

`apps/web/lib/transit/index.ts`（コミット `a4d8068`）はインターフェースのみ。`EKISPERT_API_KEY` の有無に関わらず `status: "unavailable"` を返し、**実通信は行わない**（公式仕様を未確認のまま推測で組み立てない方針）。被参照 0 件で、配置画面（`p-shifts/assign/assign-form.tsx`）は `labels.ts` の固定文言「経路情報は未取得（駅すぱあと未接続）」を表示している。残作業 5 項目はファイル冒頭に記載。

### 2. DB 接続の環境変数名が不一致

```
packages/db/prisma/schema.prisma:23   directUrl = env("DATABASE_URL_DIRECT")
.env.example / .env.local             DIRECT_URL      ← 名前が違う
```

**整理開始前の HEAD `ec2a127` 由来の既存問題。** `.env.example` から `.env` を作っても `directUrl` は解決されない。

- **Web アプリの起動には影響しない**（Prisma Client は `url = env("DATABASE_URL")` のみ使う。4 サイト起動で DB 接続エラー 0 件）
- 影響するのは **`pnpm db:validate` / `pnpm db:migrate:deploy` を素で実行したとき**のみ（P1012）
- テストが通るのは `packages/db/__tests__/setup-env.ts:21` / `packages/auth/__tests__/setup-env.ts:23` / `apps/web/__tests__/setup-env.ts:10` が `DATABASE_URL_DIRECT` を明示設定しているため
- 文書は `RELEASE.md:44` が schema と一致、`docs/03-tech-selection.md:335` と `docs/sprints/SP-07` が `DIRECT_URL`（不一致）
- `README.md` は `DATABASE_URL_DIRECT` が正であることと、この不一致を注記済み

### 3. Prisma CLI は `.env.local` を読まない

Prisma CLI は `.env` のみを読む。リポジトリに `.env` / `packages/db/.env` / `packages/db/prisma/.env` はいずれも無く、シェル環境にも DB 系変数が無いため、CLI 系コマンドは素では動かない。`packages/db/prisma/seed-env.ts` の `.env.local` 読み込みは `tsx` 経由のスクリプト専用。

**回避**: `DATABASE_URL` と `DATABASE_URL_DIRECT` をシェル環境で渡す。`pnpm db:generate` は `directUrl` の解決を要求しないため素で通る。

### 4. MFA の強制ゲートが未実装

`packages/auth/src/config.ts` が `mfaSetupRequired` / `mfaVerified` を算出して JWT に載せ、`/mfa` と `/mfa/setup` の画面も存在する。しかし **`middleware.ts` に MFA 判定が無く、`redirect("/mfa")` 相当のコードがリポジトリ全体で 0 件**。`mfaSetupRequired` の参照先は `(common)/profile/page.tsx` の表示のみ。

→ **`twoFactorRequired=true` でも 2FA が強制されない。** 運営者 MFA を本番公開時の必須要件とするなら、これが前提になる。

### 5. agency サイトのみ、復号できない Cookie で 500 になる

無効な（復号できない）セッション Cookie が残っている状態で agency の画面を開くと **500**。partner / partner-admin / system-admin は `/login` へ redirect する。

```
JWEInvalid: Invalid Compact JWE
  → auth() がセッションなしを返す
  → getBillingSnapshot (lib/billing/resolve.ts:170) が UnauthorizedError を throw
     at (wholesaler)/layout.tsx:27 / dashboard/page.tsx:32
```

通常利用では発生しない（Cookie 無し → middleware が `/login` へ redirect、有効 Cookie → 正常表示）。再現するのは `AUTH_SECRET` のローテーション後や Cookie 破損時。**回避**: ブラウザの `localhost` の Cookie を削除する。

### 6. Worker の cron に未登録タスクが 3 件

`apps/worker/src/crontab.ts` の 4 エントリのうち、`buildTaskList()` に登録があるのは `reminder.dispatch` のみ。

| cron のタスク名                 | 状態                                       |
| ------------------------------- | ------------------------------------------ |
| `monthly.aggregate_all_tenants` | **未登録**（登録名は `monthly.aggregate`） |
| `security.purge_login_attempts` | **未登録**（実装ファイルも無い）           |
| `notification.purge`            | **未登録**（実装ファイルも無い）           |

`LoginAttempt` の掃除と `Notification` の物理削除が動いていない可能性がある。

### 7. 実装途上の画面

| 箇所                         | 状態                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ComingSoon 4 ルート          | `/audit-logs` `/bi` `/bi/analysis` `/relationships`。`BIツール` は `nav-items.ts` の `HIDDEN_NAV_LABELS` でナビからも除外                                                                   |
| `/commissions`（手数料一覧） | `commissions/data.ts` は `SAMPLE / PLACEHOLDER data.` と明記された in-memory 配列。DB に触らないため `withTenant` も `assertCan` も通っていない。実データ化はインセンティブ集計モデルに依存 |
| LINE 通知                    | `notification.send_line.ts` はログ出力のみの noop。`FEATURE_LINE_NOTIFICATIONS=false`                                                                                                       |
| 表示時のデモ値生成           | `buildDemoResultReport` が `(wholesaler)/events/[id]/page.tsx:295` で使用中。`buildDemoCustomerReport` は参照 0 のデッドコード                                                              |
| `packages/ui`                | 空。UI プリミティブの実体は `apps/web/components/ui/`                                                                                                                                       |
| TODO / FIXME                 | 7 件（SP-07 相当の監査ログ・PII フィルタ・UI 移行の残り）                                                                                                                                   |

### 8. 到達経路のない UI

| 箇所                                                                                                | 状態                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/app/(field)/page.tsx`                                                                     | `app/page.tsx` と同じ `/` に解決され、ビルド成果物では `app/page.tsx` 側が採用される。`app/page.tsx` に現場要員（`WHOLESALER_FIELD_STAFF`）の分岐が無く `/dashboard` へ送られるため、`(field)` レイアウトは `/shifts` `/quick-appointment` を直接 URL で開いたときだけ現れる |
| `/deals/dealer-reports`                                                                             | 流入リンク 0 件（自ページ内のクエリ生成のみ）。ナビにも無い                                                                                                                                                                                                                  |
| `/masters/installers` `/masters/incentive-rates` `/masters/wholesaler-settings` `/masters/products` | 通常ナビからの流入が無い。`/masters` のタブは 開催場所・店舗 / エリア設定 / 場所提供元 の 3 つのみ。`masters/data.ts:6-7` に「これらの画面へ遷移する設計」というコメントはあるがリンクは未実装。E2E は直接 URL で到達している                                                |
| `partner-admin` のサイドバー                                                                        | `/p-profile` が無いのに `PARTNER_ADMIN_PREFIXES` は公開対象に含む                                                                                                                                                                                                            |

### 9. CI の不足（`.github/workflows/ci.yml`）

| 問題                               | 内容                                                                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma-validate` がプレースホルダ | 中身が `echo "(prisma-validate) wired in T-01-03 / T-01-04 once schema.prisma exists"`                                                               |
| `unit` ジョブに DB が無い          | `pnpm -r --parallel run test` を PostgreSQL サービスなしで実行する                                                                                   |
| E2E ジョブが無い                   | Playwright は CI で動いていない                                                                                                                      |
| `build` が 1 サイトのみ            | `pnpm -F @solar/web build`（agency 相当）。partner / partner-admin / system-admin のビルド検証が無い                                                 |
| 全体コマンドが失敗する             | `typecheck` / `lint` / `format` はワークスペース全体のコマンドを使うため、下記 10・11 がそのまま CI の失敗になる想定（Linux 環境での実結果は未確認） |

### 10. lint の現状（実測）

| パッケージ                                                      | 結果                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@solar/auth` / `@solar/email` / `@solar/storage` / `@solar/ui` | **OK**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `@solar/contracts`                                              | 8 problems（1 error / 7 warnings）。**整理では解消しなかった**。対象は今回 stage していない既存ファイル（`__tests__/customer-call-status` `customer-hearing-f063` `equipment-amount-construction` `project-info` の `import/order`、`src/services/contract-snapshot.ts` の `import/order`、`src/services/masking.ts:110` の `no-irregular-whitespace`）。lint-staged は staged ファイルだけを直すため、`c042511` で stage した 32 件は解消済み                                                                                                                         |
| `@solar/worker`                                                 | 5 problems（3 errors — 未使用 `currentMonth` `in7days` `in14days`）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `@solar/db`                                                     | 14 problems（13 errors / 1 warning）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `@solar/web`                                                    | 3157 problems。**ただし問題ファイル 96 のうち 90 は `.next-system-admin/` のビルド出力**。原因は `eslint.config.mjs` の `ignores` に `.next-system-admin` が無いこと（`.next/` `.next-partner/` `.next-partner-admin/` はある）。実ソースの指摘は**既存テスト 5 ファイルのみ**（`(common)/notifications/settings/__tests__/actions.test.ts` / `(wholesaler)/events/[id]/shifts/__tests__/actions.test.ts` / `lib/audit/__tests__/audit-service.test.ts` / `lib/domain/__tests__/monthly-report.test.ts` / `lib/notifications/__tests__/notification-service.test.ts`） |
| `@solar/e2e`                                                    | `lint` が `echo "(e2e) lint placeholder"` で実際には lint していない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

### 11. その他の設定の不整合

| 問題                                               | 内容                                                                                                                                                                                                                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`（全体）が失敗                     | `@solar/e2e` のみ。`tests/e2e/package.json` の devDependencies に `dotenv` と `@prisma/client` が宣言されていない。他 8 パッケージは単体で OK                                                                                                                    |
| `pnpm format:check` が失敗                         | CRLF と `.prettierrc` の `endOfLine: "lf"` の衝突（`core.autocrlf=true` かつ `.gitattributes` なし）。Linux CI で再現するかは未確認                                                                                                                              |
| `eslint.config.mjs` の ignores 漏れ                | `.next-system-admin` が無い（上記 10）                                                                                                                                                                                                                           |
| ルート `package.json` に `dev:system-admin` が無い | 起動は `pnpm -F @solar/web dev:system-admin`。`build:sites` も 3 サイトのみ                                                                                                                                                                                      |
| `.env.example` が system-admin 未反映              | `system-admin` / 3400 の記述が 0 件。`SYSTEM_ADMIN_APP_URL`（`lib/site-urls.ts:25-30` が読む実在の変数）も無い。未設定時は `http://localhost:3400` へフォールバックし、運営管理の「稼働状況」が実環境を指さない                                                  |
| `packages/db/tsconfig.json` の include が狭い      | `prisma/seed.ts` と `prisma/seed-env.ts` のみ。コミットした `seed-demo-minimal.ts` / `demo-data-origin.ts` / `purge-e2e-data.ts` / `create-system-operator.ts` / `seed-demo-single-agency.ts` は型チェック対象外                                                 |
| `--restore-multi` が no-op                         | `seed-demo-single-agency.ts` の `--restore-multi` は `bizflow_rel_b_alpha` を ACTIVE に戻すオプションだが、`seed-partner-flow.ts` を削除したため対象行が作られない。`demo-data-origin.ts` の `bizflow_` / `[BIZ]` 分類も何にもマッチしなくなった（いずれも無害） |
| 製品名の不統一                                     | UI は `BizOrch`（`labels.ts` の `brand`）、`package.json` は `solar-saas`、`apps/web/public/site.webmanifest` は `"Solar SaaS"`                                                                                                                                  |
| `/` のルート衝突                                   | `app/page.tsx` と `app/(field)/page.tsx` が同じ `/` に解決される（上記 8）                                                                                                                                                                                       |
| `apps/worker` の `build` が成果物を出さない        | `echo "(@solar/worker) consumed via tsx — no emit step"`。本番も `tsx` で実行する前提                                                                                                                                                                            |

---

## Unknown / Not Verified

**確認できていない**事項。断定せず実測すること。

1. **E2E（Playwright 75 spec）の合否** — 環境は整っているが、開発 DB を再シードするため意図的に未実行（上記「E2E：未実行」）
2. **CI（Ubuntu / LF チェックアウト）での `format:check` と `unit` ジョブの結果** — ローカルの CRLF 差分が CI で再現するかは未検証
3. **partner / partner-admin / system-admin のプロダクションビルド成否** — 確認済みは `build:agency`（EXIT 0・186 ルート）のみ
4. **`labels.ts` への UI 文言集約の網羅性** — 全画面でハードコードが無いかは未検証
5. **remote（GitHub）の現在の実体** — 最終 fetch が 2026-09-07 のため古い
6. **`pnpm db:generate` の再実行** — 最終検証時に `EPERM: operation not permitted, rename … query_engine-windows.dll.node` で失敗した。**4 サイトの dev server が Prisma エンジン DLL をロックしているため**で、コードの問題ではない。`schema.prisma` は `4d7a129` 以降変更されておらず、生成物（mtime 20:59）は schema（mtime 09-29）より新しく最新。dev server を止めれば通る見込みだが未確認
7. **`packages/db/__tests__/seed.test.ts` 3 件の修正方針** — 既存問題であることは確定したが、期待値を現行シードに合わせるか、シードを戻すかは未決

---

## 次の担当者が最初にやること

### 1. 動かす（DB → 4 サイト）

```bash
pnpm install
cp .env.example .env.local
cp .env.example apps/web/.env.local
pnpm db:up                           # PostgreSQL 16（localhost:5434 / solar_saas_dev）
pnpm db:generate
pnpm db:seed                         # または pnpm demo:minimal（A/B 最小構成）

pnpm dev:agency                      # http://localhost:3100
pnpm dev:partner                     # http://localhost:3200
pnpm dev:partner-admin               # http://localhost:3300
pnpm -F @solar/web dev:system-admin  # http://localhost:3400
```

`pnpm db:migrate:deploy` を使う場合は Known Issues 2・3 のとおり `DATABASE_URL` と `DATABASE_URL_DIRECT` をシェル環境で渡すこと。

### 2. 検証の基準線を把握する

```bash
pnpm -F @solar/web typecheck     # PASS
pnpm -F @solar/web test          # 111 files / 1128 tests 全 PASS
pnpm -F @solar/auth test         # 4 files / 28 tests 全 PASS
pnpm -F @solar/db test           # seed.test.ts の 3 件だけ FAIL（既知）
```

**ワークスペース全体の `pnpm typecheck` / `pnpm lint` / `pnpm format:check` は既知の理由で失敗する**（Known Issues 10・11）。完了判定は変更スコープのコマンドで行う。

### 3. push する前に

- このブランチに upstream 設定が無い（`git push -u origin feature/partner-portal` などで明示する）
- `main..HEAD` は 23 ahead。`origin/main` は 2026-07-10 の `00193f1` で、最終 fetch が 2026-09-07 なので**先に `git fetch` して remote の現状を確認する**

### 4. 着手の優先順位（依存関係と安全性の順）

| 順    | 内容                                                                                                                  | 理由                                                                                                                                                                                   |
| ----- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | `eslint.config.mjs` に `.next-system-admin` を追加 ／ `tests/e2e/package.json` に `dotenv` と `@prisma/client` を追加 | 判定の土台。これで `pnpm lint` の大半（90 ファイル分）と `pnpm typecheck` 全体が通るようになり、以降「壊れたかどうか」を全体コマンドで判定できる                                       |
| **2** | CRLF / LF 方針の決定（`.gitattributes` を置くか、`format:check` の運用を変えるか）                                    | Git 整理が完了したので、ここで一括変換しても差分レビューを壊さない                                                                                                                     |
| **3** | MFA の強制ゲート（Known Issues 4）                                                                                    | `twoFactorRequired` が実質無効。運営者 MFA を必須要件とするならこれが前提                                                                                                              |
| **4** | Worker cron の未登録タスク 3 件（Known Issues 6）                                                                     | `LoginAttempt` の掃除と `Notification` の物理削除が動いていない可能性                                                                                                                  |
| **5** | `seed.test.ts` 3 件（Unknown 7）                                                                                      | 期待値を現行シードに合わせるか決める。CI の `unit` ジョブに DB を付ける作業と併せて判断                                                                                                |
| **6** | 配線漏れ（Known Issues 8・11）                                                                                        | ルート `package.json` の `dev:system-admin` ／ `.env.example` の system-admin と `SYSTEM_ADMIN_APP_URL` ／ `partner-admin` ナビの `/p-profile` ／ `(field)` と `/masters/*` の到達経路 |
| **7** | E2E を一度通す                                                                                                        | 開発 DB を再シードするため、最小デモの扱いを決めてから                                                                                                                                 |
| **8** | `docs/` への system-admin 設計の反映                                                                                  | `docs/` 全体に `system-admin` / `運営管理` / `3400` の記述が 0 件                                                                                                                      |

### 5. 変更するときに必ず読むもの

[`CLAUDE.md`](CLAUDE.md) の **Git 作業のルール**（未コミット変更を消さない・破壊的 git 操作の禁止・secrets を入れない・CRLF を保つ）と **Hard rules 10 項目**（マルチテナント／文言集約／契約明細スナップショット／仕入値非開示／PII マスキング／インセンティブ確定／AI ランタイム禁止 ほか）。

---

## 調査・検証に使ったコマンド（再現用）

```bash
# Git
git log --oneline main..HEAD
git rev-list --count --left-right main...HEAD
git status --porcelain

# migration の適用状態（読み取りのみ。env を補って実行する）
DATABASE_URL=… DATABASE_URL_DIRECT=… \
  pnpm -F @solar/db exec prisma migrate status --schema=prisma/schema.prisma
docker exec solar-saas-pg psql -U solar -d solar_saas_dev -c \
  "SELECT count(*), count(finished_at), count(rolled_back_at) FROM _prisma_migrations;"

# テスト / 型
pnpm -F @solar/web test
pnpm -F @solar/web typecheck
pnpm -F @solar/auth test
pnpm -F @solar/db test
pnpm -F @solar/contracts typecheck

# lint（パッケージ単位。全体コマンドは既知の理由で失敗する）
pnpm -F <pkg> lint
npx eslint <path>

# 4 サイトの起動確認
for p in 3100 3200 3300 3400; do \
  curl -s -o /dev/null -w "$p %{http_code}\n" "http://localhost:$p/login"; done
```
