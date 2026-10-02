// システムユーザー一覧（設定配下） — F-006 / 卸業者側。
//
// 「本アプリへログインできる User」の一覧。イベントに立つスタッフ全般を扱う
// スタッフ一覧（/salespeople）とは別概念で、User 情報を複製もしない。
// 招待・ロール管理はこの画面の責務で、スタッフ一覧側には持ち込まない。
//
// 画面の骨格はスタッフ一覧と共通:
//   タイトル + 説明 + 右上アクション → 所属タブ → 表示件数 → テーブル。
// 検索・並び替え・ページャは、この画面に対応する既存のクエリ条件が無いため
// 置いていない（UI のためだけに絞り込みロジックを新設しない）。
//
// 所属で 2 タブに分ける:
//   自社   … 自テナントの User。招待・ロール管理までできる。
//   取引先 … Relationship で繋がっている取引先テナントの User。閲覧のみ。
//
// assertCan は data.ts のローダー内で実施（member.read）。

import {
  ListPageHeader,
  ListResultCount,
  ListTableCard,
  ListTabs,
} from "@/components/list/list-shell";
import { labels } from "@/lib/i18n/labels";
import { assertSettingsAccess } from "@/lib/permissions/settings-guard";

import { listAssignableMemberRoles, listDealerMembers, listWholesalerMembers } from "./data";
import { InviteMemberDialog } from "./invite-member-dialog";
import { MemberTable } from "./member-table";
import { RoleGuide } from "./role-guide";

export const dynamic = "force-dynamic";

const BASE_PATH = "/members";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function SystemUsersPage({ searchParams }: PageProps) {
  // 設定配下は OWNER / SYSTEM_ADMIN のみ。URL 直打ちもここで 403 にする。
  await assertSettingsAccess();

  const params = await searchParams;
  const tab = params.tab === "dealer" ? "dealer" : "own";
  const t = labels.memberManagement;

  // 取引先タブのときだけ取引先 User を読む（不要なクロステナント参照を避ける）。
  const [users, dealerUsers] = await Promise.all([
    tab === "own" ? listWholesalerMembers() : Promise.resolve([]),
    tab === "dealer" ? listDealerMembers() : Promise.resolve([]),
  ]);
  // 招待・編集で指定できるロールは「自分と同じか下位」だけ。
  const invitableRoles = await listAssignableMemberRoles();
  const rows = tab === "own" ? users : dealerUsers;

  return (
    <div className="space-y-6">
      <ListPageHeader
        title={t.wholesalerTitle}
        subtitle={t.wholesalerSubtitle}
        // 招待は自社アカウントに対する操作なので、自社タブでだけ出す。
        action={tab === "own" ? <InviteMemberDialog roles={invitableRoles} /> : undefined}
      />

      {/* 権限の早見表。編集ダイアログのロール選択肢と同じ 3 種類。 */}
      <RoleGuide />

      <ListTabs
        current={tab}
        ariaLabel={t.tabs.ariaLabel}
        items={[
          { value: "own", label: t.tabs.own, href: BASE_PATH },
          { value: "dealer", label: t.tabs.dealer, href: `${BASE_PATH}?tab=dealer` },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ListResultCount total={rows.length} template={t.resultCount} />
        {/* 取引先タブは閲覧のみ。編集できない理由をその場に書いておく。 */}
        {tab === "dealer" && rows.length > 0 ? (
          <p className="text-mute-light text-[13px]">{t.dealerTabNote}</p>
        ) : null}
      </div>

      <ListTableCard
        isEmpty={rows.length === 0}
        emptyTitle={tab === "own" ? t.empty : t.dealerTabEmpty}
        emptyBody={tab === "own" ? t.emptyCta : t.dealerTabEmptyCta}
      >
        <MemberTable users={rows} variant={tab} assignableRoles={invitableRoles} />
      </ListTableCard>
    </div>
  );
}
