"use client";

// システムユーザー一覧の表（自社 / 取引先で共有）。
//
// 操作体系はスタッフ一覧（salesperson-table.tsx）と同一:
//   行のどこか / 右端のシェブロン → 展開・折りたたみ（アコーディオン: 1 行ずつ）
//   展開バナー → 詳細の確認と管理操作（編集 / 削除）
// 骨格・行高・罫線・余白・列の折りたたみ規則も list-shell の共有定数をそのまま使う。
//
// 中身は完全に別物で、System User（ログイン・権限）だけを扱う。
// スタッフ（Salesperson）・担当件数・イベント配置は持ち込まない。
//
// 自社タブと取引先タブは列がほぼ同じなので表本体を共有し、差分だけ props で切り替える:
//   - 取引先タブは「所属取引先」列を出す
//   - 取引先タブは閲覧のみなので、展開しても編集・削除を出さない

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import {
  COL_MD,
  COL_SM,
  COL_XL,
  LIST_CHEVRON_BUTTON,
  LIST_CHEVRON_TD,
  LIST_ROW,
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

// 画面幅ごとの列。氏名・ロール・状態・最終ログインは
// 「誰が何をできて、いま使われているか」の判断に要るので常時。
// メールと所属取引先は識別用なので、幅に余裕があるときだけ出す（展開側にも出る）。
const COL = {
  email: COL_XL,
  dealerName: COL_MD,
  // スマホでは「誰が / どの権限か」だけ見えれば足りる。
  // 状態と最終ログインは展開バナーにも出しているので、狭い画面では列を落とす。
  status: COL_SM,
  lastLoginAt: COL_MD,
} as const;

/** 展開バナー内の 1 項目（ラベル上・値下の縦読み）。スタッフ一覧と同じ密度。 */
function StackedField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-mute-light text-[11px] leading-tight">{label}</dt>
      <dd className="text-body-light break-words text-sm">
        {value && value.length > 0 ? value : labels.customer.none}
      </dd>
    </div>
  );
}

export function MemberTable({
  users,
  variant,
  assignableRoles,
}: {
  users: (MemberListItem | DealerMemberListItem)[];
  variant: "own" | "dealer";
  /** ログイン中ユーザーが指定できるロール（編集ダイアログの選択肢）。 */
  assignableRoles: string[];
}) {
  const isDealer = variant === "dealer";

  // 展開状態は画面上の一時的な UI 状態（保存しない / リロードで閉じる）。
  // 一覧性を優先してアコーディオン方式にする（1 行開くと他は閉じる）。
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 列幅は固定（table-fixed）。氏名やメールの長さで列位置が動かないようにする。
  // 非表示にした列にも必ず w-0 を置く。展開行の colSpan は非表示列にも
  // 幅を配分するので、幅指定が無いと展開時だけ列が痩せて chevron の
  // x 座標がずれる。
  const W = {
    name: isDealer ? "w-[52%] sm:w-[34%] md:w-[22%]" : "w-[52%] sm:w-[34%] xl:w-[24%]",
    email: "w-0 xl:w-[22%]",
    dealerName: "w-0 md:w-[20%]",
    roles: "w-[32%] sm:w-[24%] md:w-[16%]",
    status: "w-0 sm:w-[20%] md:w-[12%]",
    lastLoginAt: "w-0 md:w-[18%]",
    chevron: "w-[16%] sm:w-[10%] md:w-[6%]",
  } as const;

  // 氏名 / メール / (所属取引先) / ロール / ステータス / 最終ログイン / シェブロン。
  const colSpan = isDealer ? 7 : 6;

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
            <th scope="col" className={`${LIST_TH} ${COL.status} ${W.status}`}>
              {t.fields.status}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.lastLoginAt} ${W.lastLoginAt}`}>
              {t.fields.lastLoginAt}
            </th>
            <th className={W.chevron} aria-hidden />
          </tr>
        </thead>
        <tbody className="divide-hairline-light divide-y">
          {users.map((u) => {
            const isExpanded = expandedId === u.id;
            const bannerId = `member-row-detail-${u.id}`;
            const toggle = () => setExpandedId(isExpanded ? null : u.id);
            const roleText =
              u.roles.map((r) => t.wholesalerRoles[r] ?? r).join(" / ") || labels.customer.none;

            return [
              <tr
                key={u.id}
                className={`group ${LIST_ROW} ${isExpanded ? "bg-page" : ""}`}
                onClick={toggle}
              >
                <td className={LIST_TD_STRONG}>{u.name}</td>
                <td className={`${LIST_TD} ${COL.email}`} title={u.email}>
                  <span className="block truncate">{u.email}</span>
                </td>
                {isDealer ? (
                  <td className={`${LIST_TD} ${COL.dealerName}`}>
                    {(u as DealerMemberListItem).dealerName}
                  </td>
                ) : null}
                {/* ロールは 1 人 1 つ運用。権限そのものなので文字で正確に出す。 */}
                <td className={LIST_TD}>{roleText}</td>
                {/* 有効は既定状態なので色を付けず、停止中・招待済みだけバッジで拾える。 */}
                <td className={`${LIST_TD} ${COL.status}`}>
                  {u.status === "ACTIVE" ? (
                    <span className="text-body-light">{t.statuses.ACTIVE}</span>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      {t.statuses[u.status] ?? u.status}
                    </Badge>
                  )}
                </td>
                <td className={`${LIST_TD_NUM} ${COL.lastLoginAt}`}>
                  {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : t.neverLoggedIn}
                </td>
                <td className={LIST_CHEVRON_TD}>
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={bannerId}
                    aria-label={`${u.name} ${isExpanded ? t.expand.close : t.expand.open}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle();
                    }}
                    className={LIST_CHEVRON_BUTTON}
                  >
                    <ChevronDown
                      className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                </td>
              </tr>,

              isExpanded ? (
                <tr key={`${u.id}-detail`} className="bg-surface-soft/40">
                  <td id={bannerId} colSpan={colSpan} className="px-6 py-4">
                    <div className="space-y-4">
                      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-5">
                        <StackedField label={t.fields.email} value={u.email} />
                        {isDealer ? (
                          <StackedField
                            label={t.dealerNameColumn}
                            value={(u as DealerMemberListItem).dealerName}
                          />
                        ) : null}
                        <StackedField label={t.fields.roles} value={roleText} />
                        <StackedField
                          label={t.fields.status}
                          value={t.statuses[u.status] ?? u.status}
                        />
                        <StackedField
                          label={t.fields.twoFactor}
                          value={u.twoFactorRequired ? t.twoFactorEnabled : t.twoFactorDisabled}
                        />
                        <StackedField
                          label={t.fields.lastLoginAt}
                          value={u.lastLoginAt ? formatDateTime(u.lastLoginAt) : t.neverLoggedIn}
                        />
                      </dl>

                      {/* 管理操作は展開側に置く（通常行は情報確認に徹する）。
                          取引先のアカウントは自テナントの管轄外なので操作を出さない。
                          自分より上位のロールを持つ相手も同様に操作を出さない
                          （disabled ではなく、そもそも描かない）。 */}
                      {isDealer ? (
                        <p className="text-mute-light text-[13px]">{t.dealerReadOnly}</p>
                      ) : u.canManage ? (
                        <div className="flex items-center justify-end gap-2">
                          <MemberRowActions
                            id={u.id}
                            name={u.name}
                            roles={u.roles}
                            status={u.status}
                            assignableRoles={assignableRoles}
                          />
                        </div>
                      ) : (
                        <p className="text-mute-light text-[13px]">{t.upperRoleReadOnly}</p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : null,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
