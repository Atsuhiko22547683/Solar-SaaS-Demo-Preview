"use client";

// 販売員一覧テーブル。
//
// 通常行は一覧性の高い短い項目だけ（氏名 / カナ / 加盟店番号 / 雇用形態 / 電話 / メール）。
// PII が濃い項目（生年月日・性別・現住所・住民票住所・営業経験歴）は行を展開したときだけ
// 出す（住所全文を常時表示しない — 表示値は loader でマスク済み）。
//
// 操作の切り分けは他一覧と同じ:
//   行のどこか / 右端のシェブロン → 展開・折りたたみ（アコーディオン: 1 行ずつ）
//   氏名リンク / バナーの「編集」 → 編集フォーム

import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import {
  COL_LG,
  COL_MD,
  COL_SM,
  COL_XL,
  LIST_ROW,
  LIST_TD,
  LIST_TD_NUM,
  LIST_TD_STRONG,
  LIST_TH,
} from "@/components/list/list-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate as fmtDate } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { DeleteSalespersonButton } from "./salesperson-actions";

import type { SalespersonListItem } from "./data";

/**
 * 氏名リンクの遷移先。スタッフ（Salesperson）の編集画面。
 * スタッフとシステムユーザーは別物として扱うので、User 由来の分岐は持たない。
 */
function staffHref(row: SalespersonListItem): string {
  return `/salespeople/${row.id}`;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return fmtDate(iso);
}

/** 展開バナー内の 1 項目（ラベル上・値下の縦読み）。未設定は "—"。 */
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

interface SalespersonTableProps {
  salespeople: SalespersonListItem[];
  /**
   * 自社スタッフタブか、二次店スタッフタブか。
   * 「加盟店名」は自社タブでは全行が自テナント名で同じ値になり、
   * 横幅だけ消費して何も区別しない。二次店タブでのみ意味を持つので、
   * そこだけ列を出す。
   */
  affiliation: "self" | "dealer";
}

export function SalespersonTable({ salespeople, affiliation }: SalespersonTableProps) {
  const showCompany = affiliation === "dealer";

  // 画面幅ごとの列。氏名は常時。所属会社は二次店タブでの識別子なので早めに出す。
  // 雇用形態はシフト割当の判断に効くため次点。カナ・連絡先は必要時に見る列。
  const COL = {
    company: COL_SM, // 二次店タブのみ描画。会社の識別子
    employmentType: COL_MD, // 稼働可否の判断材料
    phone: COL_LG,
    kana: COL_XL, // 検索では使うが走査中は見ない
    email: COL_XL,
  } as const;
  // 列幅は固定（table-fixed）。氏名・会社名の長さで列位置が動かないようにする。
  // 所属会社列は二次店タブでだけ描くので、その分を氏名列に足す。
  const W = {
    name: showCompany ? "w-[34%] sm:w-[20%]" : "w-[34%] sm:w-[26%]",
    kana: "xl:w-[14%]",
    company: "sm:w-[18%]",
    employmentType: "md:w-[12%]",
    phone: "lg:w-[14%]",
    email: "xl:w-[18%]",
    chevron: "w-[10%] sm:w-[6%]",
  } as const;
  const t = labels.salespersonList;
  const c = labels.customer;

  // 展開状態は画面上の一時的な UI 状態（保存しない / リロードで閉じる）。
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-hairline-light bg-surface-soft/50 border-b">
            <th scope="col" className={`${LIST_TH} ${W.name}`}>
              {t.columns.name}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.kana} ${W.kana}`}>
              {t.columns.kana}
            </th>
            {showCompany ? (
              <th scope="col" className={`${LIST_TH} ${COL.company} ${W.company}`}>
                {t.columns.companyName}
              </th>
            ) : null}
            <th scope="col" className={`${LIST_TH} ${COL.employmentType} ${W.employmentType}`}>
              {t.columns.employmentType}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.phone} ${W.phone}`}>
              {t.columns.phone}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.email} ${W.email}`}>
              {t.columns.email}
            </th>
            <th className={W.chevron} aria-hidden />
          </tr>
        </thead>
        <tbody className="divide-hairline-light divide-y">
          {salespeople.map((row) => {
            const isExpanded = expandedId === row.id;
            const bannerId = `salesperson-row-detail-${row.id}`;
            const toggle = () => setExpandedId(isExpanded ? null : row.id);

            return [
              <tr
                key={row.id}
                className={`group ${LIST_ROW} ${isExpanded ? "bg-page" : ""}`}
                onClick={toggle}
              >
                {/* 氏名だけは編集リンク。行クリック（= 展開）と取り違えないよう伝播を止める。 */}
                <td className={LIST_TD_STRONG}>
                  <Link
                    href={staffHref(row)}
                    onClick={(e) => e.stopPropagation()}
                    className="focus-visible:ring-primary/40 rounded-sm underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2"
                  >
                    {row.name}
                  </Link>
                  {!row.isActive && (
                    <Badge variant="secondary" className="ml-2">
                      {t.inactiveBadge}
                    </Badge>
                  )}
                </td>
                <td className={`${LIST_TD} ${COL.kana}`}>{row.kana ?? c.none}</td>
                {/* 加盟店名は Relationship / 自テナントからの導出値（複製保存していない）。 */}
                {showCompany ? (
                  <td className={`${LIST_TD} ${COL.company}`}>{row.companyName}</td>
                ) : null}
                <td className={`${LIST_TD} ${COL.employmentType}`}>
                  {row.employmentType
                    ? (t.employmentTypeLabels[row.employmentType] ?? row.employmentType)
                    : c.none}
                </td>
                <td className={`${LIST_TD_NUM} ${COL.phone}`}>{row.phone ?? c.none}</td>
                <td className={`${LIST_TD} ${COL.email}`} title={row.email ?? undefined}>
                  <span className="block max-w-[220px] truncate">{row.email ?? c.none}</span>
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={bannerId}
                    aria-label={`${row.name} ${isExpanded ? t.expand.close : t.expand.open}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle();
                    }}
                    className="text-mute-light hover:bg-surface-soft hover:text-ink focus-visible:ring-primary/40 rounded-md p-1 transition-colors focus:outline-none focus-visible:ring-2"
                  >
                    <ChevronDown
                      className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                </td>
              </tr>,

              isExpanded ? (
                <tr key={`${row.id}-detail`} className="bg-surface-soft/40">
                  <td id={bannerId} colSpan={showCompany ? 8 : 7} className="px-6 py-4">
                    <div className="space-y-4">
                      {/* 住所はマスク済みの値（市区町村まで）。全文は編集フォームで確認する。 */}
                      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-5">
                        <StackedField
                          label={t.fields.gender}
                          value={row.gender ? (t.genderLabels[row.gender] ?? row.gender) : null}
                        />
                        {/* 生年月日は任意。未入力（null）は「未登録」と出す。 */}
                        <StackedField
                          label={t.fields.birthDate}
                          value={row.birthDate ? formatDate(row.birthDate) : t.birthDateUnset}
                        />
                        <StackedField label={t.fields.address} value={row.address} />
                        {/* 担当実績（Salesperson への明示リンク）。 */}
                        <StackedField
                          label={t.fields.tossUpCustomerCount}
                          value={`${row.tossUpCustomerCount.toLocaleString("ja-JP")}${t.customerCountSuffix}`}
                        />
                        <StackedField
                          label={t.fields.closingCustomerCount}
                          value={`${row.closingCustomerCount.toLocaleString("ja-JP")}${t.customerCountSuffix}`}
                        />
                        {/* イベント担当（EventSalesperson）。同じスタッフが同じ
                            イベントに二重登録されない一意制約があるので素直に数える。 */}
                        <StackedField
                          label={t.fields.eventAssignmentCount}
                          value={`${row.eventAssignmentCount.toLocaleString("ja-JP")}${t.customerCountSuffix}`}
                        />
                      </dl>

                      <div className="flex items-center justify-end gap-2">
                        <DeleteSalespersonButton id={row.id} name={row.name} />
                        <Button asChild size="default" className="px-5">
                          <Link href={staffHref(row)}>
                            {t.expand.detailLink}
                            <ArrowRight className="ml-1 size-4" aria-hidden />
                          </Link>
                        </Button>
                      </div>
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
