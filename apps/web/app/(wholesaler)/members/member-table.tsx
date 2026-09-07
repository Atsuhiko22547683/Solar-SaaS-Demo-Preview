// システムユーザー一覧の表（自社 / 取引先で共有）。
//
// 骨格・行高・罫線・列の折りたたみ規則はスタッフ一覧と同じ list-shell の定数を使う。
// 中身は完全に別物で、System User（ログイン・権限）だけを扱う。
// スタッフ（Salesperson）・担当件数・イベント配置は持ち込まない。
//
// 自社タブと取引先タブは列がほぼ同じなので表本体を共有し、差分だけ props で切り替える:
//   - 取引先タブは「所属取引先」列を出す
//   - 取引先タブは閲覧のみなので操作列を出さない

import {
  COL_LG,
  COL_MD,
  COL_XL,
  LIST_TD,
  LIST_TD_NUM,
  LIST_TD_STRONG,
  LIST_TH,
} from "@/components/list/list-shell";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { MemberRowActions } from "./member-row-actions";

import type { DealerMemberListItem, MemberListItem } from "./data";

const t = labels.memberManagement;

// 画面幅ごとの列。氏名・ロール・状態は常時（誰が何をできるかが一覧の主目的）。
// メールは識別に使うので早めに、2FA と最終ログインは必要時に見る列。
const COL = {
  email: COL_MD,
  dealerName: COL_MD,
  twoFactor: COL_XL,
  lastLoginAt: COL_LG,
} as const;

// 列幅は固定（table-fixed）。氏名やメールの長さで列位置が動かないようにする。
const W = {
  name: "w-[30%] md:w-[18%]",
  email: "md:w-[22%]",
  dealerName: "md:w-[16%]",
  roles: "w-[34%] md:w-[15%]",
  status: "w-[20%] md:w-[10%]",
  twoFactor: "xl:w-[8%]",
  lastLoginAt: "lg:w-[14%]",
  actions: "w-[16%] md:w-[9%]",
} as const;

export function MemberTable({
  users,
  variant,
}: {
  users: (MemberListItem | DealerMemberListItem)[];
  variant: "own" | "dealer";
}) {
  const isDealer = variant === "dealer";

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-hairline-light bg-surface-soft/50 border-b">
            <th scope="col" className={`${LIST_TH} ${W.name}`}>
              {t.fields.name}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.email} ${W.email}`}>
              {t.fields.email}
            </th>
            {isDealer ? (
              <th scope="col" className={`${LIST_TH} ${COL.dealerName} ${W.dealerName}`}>
                {t.dealerNameColumn}
              </th>
            ) : null}
            <th scope="col" className={`${LIST_TH} ${W.roles}`}>
              {t.fields.roles}
            </th>
            <th scope="col" className={`${LIST_TH} ${W.status}`}>
              {t.fields.status}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.twoFactor} ${W.twoFactor}`}>
              {t.fields.twoFactor}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.lastLoginAt} ${W.lastLoginAt}`}>
              {t.fields.lastLoginAt}
            </th>
            {isDealer ? null : (
              <th scope="col" className={`${LIST_TH} ${W.actions} text-right`}>
                {t.actionsColumn}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-hairline-light divide-y">
          {users.map((u) => (
            <tr key={u.id}>
              <td className={LIST_TD_STRONG}>{u.name}</td>
              <td className={`${LIST_TD} ${COL.email}`}>{u.email}</td>
              {isDealer ? (
                <td className={`${LIST_TD} ${COL.dealerName}`}>
                  {(u as DealerMemberListItem).dealerName}
                </td>
              ) : null}
              {/* ロールは 1 人 1 つ運用。主 status なのでここだけバッジを使う。 */}
              <td className={LIST_TD}>
                {u.roles.map((r) => t.wholesalerRoles[r] ?? r).join(" / ") || labels.customer.none}
              </td>
              <td className={LIST_TD}>
                {u.status === "ACTIVE" ? (
                  <span className="text-body-light">{t.statuses.ACTIVE}</span>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    {t.statuses[u.status] ?? u.status}
                  </Badge>
                )}
              </td>
              {/* 2FA は補助情報なので色を付けず、有効／無効の文字だけで表す。 */}
              <td className={`${LIST_TD} ${COL.twoFactor}`}>
                {u.twoFactorRequired ? t.twoFactorEnabled : t.twoFactorDisabled}
              </td>
              <td className={`${LIST_TD_NUM} ${COL.lastLoginAt}`}>
                {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : t.neverLoggedIn}
              </td>
              {isDealer ? null : (
                <td className={`${LIST_TD} text-right`}>
                  <MemberRowActions id={u.id} name={u.name} roles={u.roles} status={u.status} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
