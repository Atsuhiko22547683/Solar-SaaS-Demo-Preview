# 21. パートナー業務の一気通貫化（催事 ⇄ 依頼 ⇄ 配置 ⇄ 顧客 ⇄ 商談）

`docs/05-program-design.md` の §3.4（場所取り・イベント）/ §3.5（顧客・アポ）を、
デモ運用で実際に業務を回せる形へ広げるための追補。既存章の記述と食い違う箇所は
本章を優先する（該当箇所は各節の冒頭に明記）。

---

## 21.-1 デモの前提（**代理店 1 社 × 複数パートナー会社**）

今回のデモ構成はこれが前提で、以前の「複数代理店から受注する」前提に**優先する**。

| 項目 | 今回 |
|---|---|
| 代理店 | 1 社（株式会社サンライズソーラー） |
| パートナー会社 | 複数（グリーンフィールド / あおぞらエナジー） |
| 1 パートナー会社の ACTIVE な取引関係 | 1 件 |
| 代理店切替・代理店をまたぐ配置 | 対象外 |
| スタッフの時間重複防止 | 必要。**同じ代理店が主催する複数催事**で検証する |

### 依頼先代理店の決め方

提出フォームは代理店を**選ばせない**。ブラウザから代理店 ID を送らせず、サーバー側が決める。

1. 催事から登録した場合 … その催事の `EventDealer.relationshipId`（自社ぶん）
2. それ以外 … 認証情報から解決した ACTIVE な取引関係が**ちょうど 1 件**のときだけ、その 1 件
3. 1 件に決まらない … `ValidationError`。**先頭行を採用しない**

画面には `PartnerOriginNotice`（読み取り専用）で「どこ宛の提出になるか」だけを出す。
`resolveRelationship(partner, id)` に ID が渡された場合も、自社の取引関係に属するかを必ず
検証して不一致は拒否する（外部から直接 Server Action を叩かれた場合の防御）。

会社そのものに属するマスタ（`Salesperson`）の作成は `companyRelationship(partner)` を通し、
取引関係が 1 件に確定しているときだけ許す。

### 内部に維持した汎用構造

`PartnerContext.relationshipIds` / `lib/partner/scope.ts` / RLS の「取引関係経由」の枝は、
1 件でも複数でも同じ式で動くため**そのまま維持**する。適用済みマイグレーションの巻き戻しはしない。
今回の前提では relationshipIds の要素数が 1 になるだけで、権限・表示に影響しない。

### デモデータ

`packages/db/prisma/seed-demo-single-agency.ts`（id 接頭辞 `demo1_` / 表示 `[DEMO]`）。
実行時刻を起点に今日・今週・当月・翌月のデータを作る。複数代理店デモ（`bizflow_`）は削除せず、
グリーンフィールド × 東日本ソーラーの取引関係だけ `TERMINATED` にして前提を満たす
（`-- --restore-multi` で戻せる）。

## 21.0 背景と、変更した前提

| 旧前提 | 実際の業務 | 対応 |
|---|---|---|
| 1 パートナー会社 = 1 代理店 | 1 社が代理店 A・B の両方から依頼を受ける | `PartnerContext` を複数関係対応にし、RLS に「自社の取引関係経由」の枝を追加 |
| 閲覧は本人提出分・本人担当分のみ | 会社として案件を共有して回す | 所属パートナー会社が取り扱うデータは全件閲覧。本人・担当者・催事は「絞り込み条件」へ降格 |
| 催事 = 1 日 | 複数日開催があり、日ごとに開催時間が違う | `EventDay` を追加し、シフトを開催日に紐づける |
| 出店希望 = フラットな順位付きリスト | レーン単位の枠。順位とは別に店舗ごとの個別条件がある | `LanePreferenceItem.laneNo` / `conditionNote` を追加 |
| 出店希望は提出しっぱなし | 代理店が回答し、往復する | `LanePreferenceMessage` を追加（明細の入れ替えでも消えない） |
| 重複防止は開始時刻の UNIQUE | 開始がずれた重複・同時操作を止められない | 予定時間帯の EXCLUDE 制約へ置き換え |

---

## 21.1 複数代理店対応

### 21.1.1 コンテキスト

`apps/web/lib/partner/context.ts` の `PartnerContext`:

```ts
interface PartnerContext {
  ctx: TenantContext;
  tenantId: string;                      // 所属パートナー会社
  relationships: PartnerRelationship[];  // 自社が当事者の全取引関係
  relationshipIds: string[];             // 閲覧範囲の基準
  soleRelationshipId: string | null;     // 1 社に確定しているときだけ
  userId: string;
  site: PartnerSite;                     // 起動設定（APP_VARIANT）だけで決まる
  role: PartnerRole;                     // site と 1 対 1
  salespersonId: string | null;          // Salesperson.userId の明示リンクのみ
  isGuest: boolean;
}
```

旧 `relationshipId` / `wholesalerId` / `franchiseNo` は**削除**した。単数のキーを残すと
「どちらの代理店か」を暗黙に決める箇所が残るため、型エラーとして全参照を洗い出した。

### 21.1.2 書き込み先の確定

```ts
resolveRelationship(partner, relationshipId?): PartnerRelationship
```

- 送信された `relationshipId` は必ずこの関数で自社の集合に属することを検証する。
- 未指定かつ取引先が 1 社なら自動。複数社あるなら `ValidationError`（推測で選ばない）。
- 催事から登録する場合は、催事側の `EventDealer.relationshipId` を優先する
  （担当者の選択を変えても依頼元は書き換わらない）。

会社そのものに属するマスタ（`Salesperson`）は `companyRelationship(partner)` を使い、
同じ人物を代理店ごとに複製しない。閲覧・照合は常に `relationshipIds` で行う。

---

## 21.2 閲覧範囲（`apps/web/lib/partner/scope.ts`）

一覧・詳細・件数・検索候補・関連データ取得のすべてがこの 1 か所を通る。

| 関数 | 対象 | 条件 |
|---|---|---|
| `relationshipScope` | `relationshipId` 列を持つ表 | `relationshipId IN (自社の関係)` |
| `customerScope` | `Customer` | `ownerRelationshipId` または `registeredByRelationshipId` が自社 |
| `eventScope` | `Event` | 自社が `EventDealer` として割り当てられている |
| `shiftScope` / `eventDayScope` | `EventShift` / `EventDay` | 親 `Event` 経由 |
| `salespersonScope` | `Salesperson` | `relationshipId IN (自社の関係)` |

絞り込み条件（範囲ではない）: `submittedByFilter` / `registeredByFilter` / `relationshipFilter`。

`customerScope` は `OR` を返すので、他の `OR` 条件と同居する where では **`AND: [customerScope(partner)]`**
として包む（スプレッドすると後勝ちで範囲指定が消える）。

項目単位のマスキング（氏名・電話・住所）は行の閲覧範囲とは別扱い。取引先が複数ある場合は
**最も厳しい水準へ倒す**（緩い側に合わせない）。

---

## 21.3 RLS の拡張

`packages/db/prisma/migrations/20260928010000_partner_multi_agency_rls`。

パートナー側セッションは `wholesalerId` を持たない（`AppRole` が DEALER のとき
`session.user.wholesalerId` は null）ため、`wholesalerId` 一本の述語では常に偽になっていた。
次の表に「自社の取引関係経由」の枝を追加した。代理店側セッションの判定は変えていない
（`relationship_ids` が空なので新しい枝は成立しない）。

| テーブル | 追加した枝 |
|---|---|
| `Event` | `EXISTS (EventDealer ed WHERE ed.eventId = Event.id AND ed.relationshipId = ANY(current_relationship_ids))` |
| `EventCandidate` | `EventCandidateVisibility` 経由、または確定済み `Event` の担当会社経由 |
| `EventShift` / `EventSalesperson` / `EventChange` / `EventDay` | 親 `Event` に同じ枝 |
| `Salesperson` | `relationshipId = ANY(current_relationship_ids)` |
| `Customer` | `ownerRelationshipId` または `registeredByRelationshipId` が一致 |

検証: `packages/db/__tests__/partner-multi-agency-isolation.test.ts`（`app_user` 権限で直接確認）。

> 注記: ローカル開発の DB ロール `solar` は SUPERUSER かつ BYPASSRLS なので、
> 開発時は RLS が実効しない。RLS の保証は上記の `app_user` テストが担う。

---

## 21.4 催事の開催日（`EventDay`）

```prisma
model EventDay {
  id        String    @id @default(cuid())
  eventId   String
  eventDate DateTime           // 暦日
  startAt   DateTime?          // その日の開催時間。未登録なら null
  endAt     DateTime?
  note      String?
  @@unique([eventId, eventDate])
}
```

- 1 催事 = 1 日とは限らないため、開催日を行として持つ。開催時間は日ごとに違いうる。
- 時間が未定の日は `null` のまま。**架空の時間で埋めない**（画面は「開催時間未設定」と出す）。
- `EventShift.eventDayId` で「どの開催日の配置か」を持つ。旧データは `null`
  （マイグレーションで `EventCandidate.scheduledDate` から 1 日ぶんを backfill し、
  開始日が一致するシフトへ紐づけた）。
- 管理画面は `/events/[id]/days`（代理店）。

---

## 21.5 シフトの重複防止（三重）

| 層 | 実装 | 役割 |
|---|---|---|
| 候補表示 | `assign-form.tsx` の `busyReason` | 選んだ時間帯に入っているスタッフを選べなくする |
| 保存時 | `findBulkShiftConflicts` / `findShiftConflicts`（`@solar/contracts`） | 既存との重複と、同じ操作で作る区間同士の重複を検証 |
| DB | `EventShift_user_no_overlap`（EXCLUDE USING gist / `tsrange('[)')`） | 同時操作に対する最終的な保証 |

規則:

- 半開区間 `[start, end)`。「前の催事が 18:00 終了・次が 18:00 開始」は重複としない。
- 判定は `userId` 単位。催事・依頼元代理店では分けない（別代理店の催事でもその人は動けない）。
- 複数日催事は開催日ごとのシフト行なので、初日だけ重なる場合もその日の行同士でだけ衝突する。
- **重複判定は予定時間だけを見る**。実績を直しても将来の配置は変わらない。
- 編集中の行自身は重複相手にしない（`ignoreShiftId`）。

`btree_gist` 拡張が必要（マイグレーションが `CREATE EXTENSION IF NOT EXISTS` する）。

### 役割

`ShiftRole` に `TOSS` を追加。業務上の一次値域は **キャッチ（呼び込み）/ トス（説明・ヒアリング・
訪問日時の調整）** の 2 値。既存の `LEAD` / `RECEPTION` / `PITCH` / `OTHER` は別の意味を持つので
**キャッチ / トスへ読み替えず**、旧ラベルのまま表示する（選び直したときだけ置き換わる）。

### 勤務時間

予定（`startPlanned` / `endPlanned`）の初期値は開催日の開催時間。実績（`startActual` /
`endActual`）は別に記録し、**予定は上書きしない**（例: 予定 10:00〜18:00 / 実績 11:00〜17:00）。
勤怠・給与計算は対象外。

---

## 21.6 出店希望と、代理店との往復

### 構造

| 列・表 | 意味 |
|---|---|
| `LanePreferenceItem.laneNo` | 何レーン目か。レーンごとに独立した希望順位を持つ |
| `LanePreferenceItem.priority` | レーン内の希望順位（1 = 第一希望） |
| `LanePreferenceItem.desiredDates` | 希望日程。入力はレーン単位で、保存時にそのレーンの各明細へ同じ配列を書く |
| `LanePreferenceItem.conditionNote` | 店舗ごとの個別条件（例「上記日程のいずれか 2 日間を希望」）。**順位へ読み替えない** |
| `LanePreference.laneCount` | 希望レーン数の申告値。明細数から導出しない |
| `LanePreference.status` | `DRAFT` / `SUBMITTED` / `ANSWERED` / `CONFIRMED` |
| `LanePreferenceMessage` | 提出の記録（`SUBMISSION`）・代理店の回答（`ANSWER`）・連絡（`MESSAGE`） |

再提出は明細の入れ替えだが、**やり取りは親側にぶら下がるので失われない**。提出のたびに
`SUBMISSION` の記録を残すので、何をいつ出し直したかを追える。

### 書き込み口の一本化

旧 `saveLanePreference`（`app/(wholesaler)/lane-preferences/data.ts`）は
「取引先 1 社固定」を前提にしており、複数代理店では必ず失敗した。また明細の全件入れ替えで
回答も失われていた。同じ表に対する書き込み口を 2 つ残さないため**削除**し、
`app/(partner)/p-lane-preferences/actions.ts` に一本化した。代理店側は閲覧と回答だけを担う。

### 場所確保の相談

`VenueConsultation` + `VenueConsultationMessage`。月次の希望提出とは別建てで、対象月は任意。
汎用のチャットサービスではなく、相談 1 件に紐づくスレッドだけを扱う。

---

## 21.7 催事起点の顧客・アポ登録

- トップの「この催事からアポ登録」は `?eventId=&eventDayId=` を渡す。**店舗名の文字列では結ばない**。
- `resolvePartnerEvent`（`lib/partner/events.ts`）が自社担当の催事かを確認し、初期入力に使う値を返す。
- 初期入力: 催事場所 / 催事日程 / 販売チャネル（EVENT）/ ブース場所 / 依頼元代理店 / 所属会社 /
  担当者・アポ獲得者（ログイン利用者）。
- 担当者・アポ獲得者の候補は**その催事・その開催日に配置されているスタッフ**に限る
  （管理者が追加したゲストも配置されていれば含まれる）。別の催事のスタッフは混ぜない。
- 催事が決まっていないときは候補を並べて選ばせる。**ログイン利用者だけを根拠に対象催事を確定しない**。
- 実際に操作した利用者（`registeredByUserId` / `acquiredByUserId`）と、接客した担当者
  （`tossUpSalespersonId` / `closingSalespersonId`）は別に記録する。

---

## 21.8 商談履歴（接点の積み重ね）

`CustomerActivity` に `eventId`（どこで）と `updatedByUserId`（誰が直したか）を追加。

- 接点 1 回 = 1 行。古い順の通番が「1 回目 / 2 回目 …」になる。
- **既存行の修正では行が増えないので商談回数は変わらない**。
- 引継ぎ・共同対応: 自社が取り扱う顧客なら登録者以外も追記・修正できる。
  `createdByUserId` は書き換えず、`updatedByUserId` に直した人を残す。
- 「訪問アポ = 2 回目以降の接点」という定義は未確定なので、**商談回数からフォーム区分を自動判定しない**。

### 契約済と成約報告

- 顧客の `contractStatus = "contracted"`（＋ `status = CONTRACTED`）への変更が、業務上の契約済の判定。
- これは**成約報告の提出とは別**。ステータス変更で `DealerContractReport` は作られないし、
  金額・粗利・インセンティブに関わる正式な `Contract` も作られない。画面にもその旨を出す。

---

## 21.9 ゲストスタッフ

`Salesperson.isGuest`。登録・招待・催事への追加は管理者だけ（`partner_salesperson.write` /
`partner_user.write` は管理者サイト限定）。当面の閲覧範囲は通常スタッフと同じで、
**独自の自動失効ルールは設けない**。受け入れ会社は `relationshipId`、参加催事は
`EventShift` / `EventSalesperson` で分かる。

---

## 21.10 移動条件（駅すぱあと）

`apps/web/lib/transit/index.ts`。**現時点では未接続**。

- 契約・API キー・エンドポイント設定が存在しないため、`fetchTransitRoute` は常に
  `status: "unavailable"` を返す。
- 直線距離や推定値を「公共交通機関の検索結果」として返さない。画面は
  「経路情報は未取得（駅すぱあと未接続）」と出す。
- 出発地点はスタッフの自宅住所（`Salesperson.address`）、移動手段は公共交通機関を想定。
  最終的な配置は管理者が判断する（自動割当はしない）。

残っている接続作業は同ファイル冒頭のコメントに列挙。

---

## 21.11 追加した権限アクション

| アクション | ロール | サイト |
|---|---|---|
| `partner_lane_preference.write` | `DEALER_ADMIN` | 管理者のみ |
| `partner_consultation.read` / `.write` | `DEALER_ADMIN` | 管理者のみ |
| `partner_shift.write` | `DEALER_ADMIN` | 管理者のみ |
| `lane_preference.answer` | `WHOLESALER_ADMIN` / `WHOLESALER_EVENT_TEAM` | 代理店 |

`partner_shift.read` は両区分（閲覧は会社全件、配置は管理者だけ）。

---

## 21.12 マイグレーション

| 名前 | 内容 |
|---|---|
| `20260928000000_partner_event_days_and_lane_threads` | `EventDay` / `EventShift.eventDayId` / EXCLUDE 制約 / `ShiftRole.TOSS` / レーン番号・個別条件・提出状態 / `LanePreferenceMessage` / `VenueConsultation(+Message)` / `Salesperson.isGuest` / 既存 Event の開催日 backfill |
| `20260928010000_partner_multi_agency_rls` | 上記 §21.3 の RLS 拡張 |
| `20260928020000_customer_activity_event_link` | `CustomerActivity.eventId` / `.updatedByUserId` / `ExistingEquipmentCategory` に IH・エアコン・蓄電池 |

いずれも既存データは破壊しない（追加列はすべて NULL 許容、列挙は追加のみ）。
ロールバック手順は各 migration.sql の冒頭コメントに記載。
