// パートナーポータルのサーバー側コンテキスト。
//
// 「どのパートナー会社として読み書きするか」を決める唯一の場所。画面・Server Action は
// すべてここを通し、フォームや URL から relationshipId / wholesalerId /
// createdByUserId を受け取らない（§3 データ整合性）。
//
// 複数代理店対応:
//   1 つのパートナー会社は複数の代理店（代理店 A・B）から依頼を受けられる。以前は
//   ACTIVE な Relationship がちょうど 1 件であることを前提に例外を投げていたが、
//   その前提を外した。
//   - 閲覧は relationshipIds（自社が当事者の全関係）を範囲にする。
//   - 書き込みは「どの代理店への提出か」を必ず確定させる。1 社しか無ければ自動、
//     複数社あれば呼び出し側が明示し、resolveRelationship でこの集合に属することを
//     検証する（送信値をそのまま信用しない）。
//   代理店 A のセッションから代理店 B の案件は見えない — 範囲は自社の関係だけ。
//
// 閲覧範囲（デモ段階の方針）:
//   所属パートナー会社が取り扱うデータは、通常スタッフ・ゲストスタッフとも全件閲覧できる。
//   「本人提出分のみ」「本人担当分のみ」「参加した催事のみ」は閲覧の制限には使わない。
//   本人・担当者・催事は絞り込み条件として使う（lib/partner/scope.ts）。
//   行の閲覧範囲と、項目単位のマスキング（氏名・電話・住所）は別扱い。
//   将来の制限追加に備え、所属会社・依頼元代理店・催事・担当者・登録者・ゲスト区分は
//   すべて行に残す。
//
// パートナー管理者 / スタッフの区分:
//   「どのサイトで動いているか（APP_VARIANT）」と「利用者のロール」の両方で決まる。
//   ロールだけでは決めない — 管理者ロールの利用者がスタッフサイトを開いても、
//   管理者専用の操作へ切り替わらないようにするため。
//   閲覧範囲は両サイトで同じ（自社全件）。違うのは実行できる操作。
//
// サイトとアクションの対応:
//   管理者サイト専用のアクションは ADMIN_SITE_ACTIONS に列挙し、スタッフサイトの
//   プロセスからは実行できないようにする。3 サイトは同じビルドから起動するため、
//   スタッフサイトのプロセスにも管理者用 Server Action のコードは入っている。
//   経路（middleware のパス表）だけでは塞げないので、ここでも site を見る。
//
// ログイン利用者と販売員の紐付け:
//   既存 Salesperson.userId（@unique）だけを根拠にする。氏名の一致などからの
//   推測紐付けはしない。紐付けが無いアカウントは salespersonId = null のまま動く。

import "server-only";

import { auth } from "@/auth";
import { partnerSiteFor, type PartnerSite } from "@/lib/app-variant";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { assertCan, type PermissionAction } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import { partnerRoleForSite, type PartnerRole } from "./role";

import type { DealerScope, TenantContext } from "@solar/db";

/** パートナー管理者サイトでしか実行できないアクション。 */
const ADMIN_SITE_ACTIONS: ReadonlySet<PermissionAction> = new Set([
  "partner_salesperson.read",
  "partner_salesperson.write",
  "partner_user.read",
  "partner_user.write",
  "partner_commission.read",
  "partner_customer.write",
  "partner_customer.delete",
  "partner_lane_preference.read",
  "partner_lane_preference.write",
  "partner_consultation.read",
  "partner_consultation.write",
  "partner_shift.write",
]);

/** パートナースタッフサイトでしか実行できないアクション（カタログは管理者の業務に無い）。 */
const STAFF_SITE_ACTIONS: ReadonlySet<PermissionAction> = new Set(["partner_catalog.read"]);

export type { PartnerRole } from "./role";

/** 自社が当事者になっている取引関係（= 依頼元代理店 1 社ぶん）。 */
export interface PartnerRelationship {
  /** Relationship.id。業務データの分離キー。 */
  id: string;
  /** 依頼元代理店のテナント id。 */
  wholesalerId: string;
  /** 依頼元代理店の表示名。 */
  wholesalerName: string;
  /** 加盟店番号（Relationship 由来。利用者には入力させない）。 */
  franchiseNo: string | null;
  /** 取引範囲（アポ取りまで / 初訪まで / 契約まで）。 */
  scope: DealerScope;
}

export interface PartnerContext {
  /** withTenant に渡すテナント文脈（RLS の GUC 設定元）。 */
  ctx: TenantContext;
  /**
   * 操作者の所属テナント（＝パートナー会社）。利用者アカウント管理など、
   * relationship ではなく User 側でそろえる必要がある問い合わせで使う。
   */
  tenantId: string;
  /**
   * 自社が取引する全代理店との関係。1 件以上。閲覧範囲の基準。
   * 表示順は代理店名の昇順で安定させる。
   */
  relationships: PartnerRelationship[];
  /** relationships の id 一覧。where 句にそのまま使う。 */
  relationshipIds: string[];
  /**
   * 取引先が 1 社に確定しているときだけその id。複数社と取引があるときは null で、
   * 書き込み側が依頼元を明示する必要がある（推測で 1 件目を選ばない）。
   */
  soleRelationshipId: string | null;
  /** 操作者。 */
  userId: string;
  /** 稼働しているサイト（スタッフ / 管理者）。 */
  site: PartnerSite;
  /** そのサイトでの利用区分。site と 1 対 1（ロール単独では決まらない）。 */
  role: PartnerRole;
  /** 操作者に紐づく販売員（Salesperson.userId 由来）。未紐付けなら null。 */
  salespersonId: string | null;
  /** 操作者がゲストスタッフか（Salesperson.isGuest 由来）。 */
  isGuest: boolean;
}

/**
 * パートナーポータルの実行文脈を解決する。
 *
 * 1. 認証必須
 * 2. パートナー会社テナントであること（代理店アカウントはここへ来ない）
 * 3. サイト区分 × アクション、ロール × サイト
 * 4. 指定アクションの権限
 * 5. ACTIVE な Relationship が 1 件以上であること
 */
export async function requirePartnerContext(action: PermissionAction): Promise<PartnerContext> {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError({
      code: "INVALID_CREDENTIALS",
      message: "Session missing — sign in is required",
    });
  }

  // サイト区分は起動設定だけで決まる。リクエストからは変えられない。
  const site = partnerSiteFor();
  if (!site) {
    throw new ForbiddenError("パートナーサイトでのみ利用できます", { action });
  }
  if (site === "STAFF" && ADMIN_SITE_ACTIONS.has(action)) {
    throw new ForbiddenError("この操作はパートナー管理者サイトでのみ利用できます", { action });
  }
  if (site === "ADMIN" && STAFF_SITE_ACTIONS.has(action)) {
    throw new ForbiddenError("この操作はパートナースタッフサイトでのみ利用できます", { action });
  }

  // そのサイトの利用対象となるロールを持っているか。
  // 管理者ロールしか持たない利用者はスタッフサイトの対象外（逆も同じ）。
  const role = partnerRoleForSite(site, session.user.roles);
  if (!role) {
    throw new ForbiddenError("このサイトの利用対象ではありません", { action });
  }

  const ctx = await getTenantContext();

  // SaaS 運営者も含め、パートナー会社テナント以外はこのポータルの対象外。
  // 代理店アカウントは variant ガードで先に止まるが、Server Action を直接
  // 叩かれた場合に備えてここでも落とす。
  if (!ctx.dealerId || !ctx.tenantId) {
    throw new ForbiddenError("パートナー会社のアカウントでのみ利用できます", { action });
  }
  const tenantId = ctx.tenantId;
  const dealerId = ctx.dealerId;

  assertCan({
    user: {
      userId: ctx.actorUserId,
      roles: session.user.roles,
      isSaasAdmin: ctx.isSaasAdmin,
      tenantId: ctx.tenantId,
      wholesalerId: ctx.wholesalerId,
      dealerId: ctx.dealerId,
      relationshipIds: ctx.relationshipIds,
    },
    action,
  });

  if ((ctx.relationshipIds ?? []).length === 0) {
    throw new ForbiddenError("取引先の代理店が設定されていません。代理店にご確認ください");
  }

  // Relationship の実在と、それが本当に自社のものかを DB 側でも確認する。
  // 複数代理店との取引をそのまま受け入れる（1 社固定の前提は外した）。
  const { rows, salesperson } = await withTenant(ctx, async (tx) => {
    const rows = await tx.relationship.findMany({
      where: { id: { in: ctx.relationshipIds }, dealerId, status: "ACTIVE" },
      orderBy: { wholesaler: { name: "asc" } },
      select: {
        id: true,
        wholesalerId: true,
        franchiseNo: true,
        defaultScope: true,
        wholesaler: { select: { name: true } },
      },
    });
    // 本人の販売員行。userId の明示リンクだけを見る（氏名一致などでは探さない）。
    // Salesperson.userId は @unique なので、複数代理店でも 1 行に決まる。
    const salesperson = await tx.salesperson.findFirst({
      where: { userId: ctx.actorUserId },
      select: { id: true, isGuest: true },
    });
    return { rows, salesperson };
  });

  if (rows.length === 0) {
    throw new ForbiddenError("有効な取引関係が見つかりません");
  }

  const relationships: PartnerRelationship[] = rows.map((r) => ({
    id: r.id,
    wholesalerId: r.wholesalerId,
    wholesalerName: r.wholesaler.name,
    franchiseNo: r.franchiseNo,
    scope: r.defaultScope,
  }));
  const relationshipIds = relationships.map((r) => r.id);

  return {
    ctx,
    tenantId,
    relationships,
    relationshipIds,
    soleRelationshipId: relationships.length === 1 ? relationshipIds[0]! : null,
    userId: ctx.actorUserId,
    site,
    role,
    salespersonId: salesperson?.id ?? null,
    isGuest: salesperson?.isGuest ?? false,
  };
}

/**
 * 依頼元代理店（Relationship）を確定する。
 *
 * 送信された id は必ずこの関数で自社の集合に属することを検証する。未指定のときは、
 * 取引先が 1 社に確定していればそれを使い、複数社あるなら選択を促す
 * （どれかを推測で選ぶと、別の代理店の配下にデータが入る事故になる）。
 */
export function resolveRelationship(
  partner: PartnerContext,
  relationshipId: string | null | undefined,
): PartnerRelationship {
  if (!relationshipId) {
    const sole = partner.relationships[0];
    if (partner.soleRelationshipId && sole) return sole;
    throw new ValidationError("依頼元の代理店を選択してください", {
      field: "relationshipId",
    });
  }
  const found = partner.relationships.find((r) => r.id === relationshipId);
  if (!found) {
    // 他社の id、または取引終了済みの関係。存在を教えない。
    throw new ValidationError("選択された代理店は利用できません", { field: "relationshipId" });
  }
  return found;
}

/**
 * 会社そのものに属するマスタ（スタッフ = Salesperson）を作るときの所属関係。
 *
 * Salesperson は「人」が単位なので、行は複製しない。既存モデルの relationshipId は
 * 1 社ぶんしか持てないため、取引関係が 1 件に確定しているときだけ作成を許す。
 * 先頭行を黙って採用しない — どちらの配下に入れるかを推測すると、別の代理店の
 * 配下にスタッフが入る事故になる。
 *
 * 閲覧・照合は常に relationshipIds（自社の全関係）で行うので、作成後はどの催事にも配置できる。
 */
export function companyRelationship(partner: PartnerContext): PartnerRelationship {
  const sole = partner.soleRelationshipId
    ? partner.relationships.find((r) => r.id === partner.soleRelationshipId)
    : null;
  if (!sole) {
    throw new ValidationError(
      "所属先の代理店が特定できないため登録できません。代理店にご確認ください",
    );
  }
  return sole;
}

/** 代理店名の解決（一覧の表示用）。見つからない id は呼び出し側で「—」にする。 */
export function wholesalerNameMap(partner: PartnerContext): Map<string, string> {
  return new Map(partner.relationships.map((r) => [r.id, r.wholesalerName]));
}

/**
 * 加盟店番号の表示文字列。取引先が複数あるときは代理店名を添えて並べる
 * （1 社固定の前提が外れたので「加盟店番号」単独では意味が決まらない）。
 * 番号が 1 つも登録されていなければ null。
 */
export function franchiseNoLabel(partner: PartnerContext): string | null {
  const withNo = partner.relationships.filter((r) => r.franchiseNo);
  if (withNo.length === 0) return null;
  if (withNo.length === 1 && partner.relationships.length === 1) {
    return withNo[0]!.franchiseNo;
  }
  return withNo.map((r) => `${r.wholesalerName}: ${r.franchiseNo}`).join(" / ");
}
