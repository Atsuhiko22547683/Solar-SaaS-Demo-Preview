"use client";

// 契約一覧テーブル。行クリック / Enter・Space で既存の契約詳細（/contracts/[id]）へ遷移する。
// 列構成・行高・フォーカスリングは S-032 顧客一覧の customer-table.tsx と同型。
// 施工 / 設置申請は専用一覧（/constructions, /applications）へ集約したため列を持たない。
// 代わりに入金状況（ContractPayment.paymentStatus）を一覧から直接変更できる。

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

import { InlineSelectInput } from "@/components/list/inline-select-input";
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
import { formatDate as fmtDate } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { contractStatusVariant } from "./constants";
import { saveProjectContractAction } from "../customers/actions";

import type { ContractListItem } from "./data";

function formatDate(iso: string): string {
  return fmtDate(iso);
}

/** 契約金額（Decimal 文字列）→ "¥3,500,000"。小数は切り捨てず整数部のみ表示する。 */
function formatAmount(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

// 入金状況の選択肢（ContractPaymentStatus）。値域・表示名は顧客詳細の契約タブと共有する。
const PAYMENT_STATUS_OPTIONS = (["UNPAID", "PARTIAL", "PAID"] as const).map((v) => ({
  value: v,
  label: labels.customer.detail.projectInfo.paymentStatusLabels[v] ?? v,
}));

interface ContractTableProps {
  contracts: ContractListItem[];
}

export function ContractTable({ contracts }: ContractTableProps) {
  const t = labels.contract.list;
  const c = labels.customer;
  // 入金状況の「未設定」表記は顧客詳細の案件情報編集と共有する。
  const p = labels.customer.detail.projectInfo.edit;
  const router = useRouter();

  // 一覧は「横断して案件を探す場所」。詳細確認はその顧客の顧客詳細・契約タブへ寄せる
  // （契約専用ページ /contracts/[id] は他導線から使うので残している）。
  function goToDetail(customerId: string) {
    router.push(`/customers/${customerId}?tab=contract`);
  }

  // 契約一覧は「誰の契約か」と「いま何の段階か」が主。
  // 金額・入金はスクロールせずとも中型画面から見える位置に置く。
  const COL = {
    date: COL_SM,
    amount: COL_MD,
    payment: COL_LG,
    assignee: COL_XL,
  } as const;

  // 列幅は固定（table-fixed）。絞り込み結果や金額の桁数で列位置が動かないようにする。
  const W = {
    date: "sm:w-[12%]",
    customer: "w-[52%] lg:w-[24%]",
    assignee: "xl:w-[13%]",
    status: "w-[24%] lg:w-[14%]",
    amount: "md:w-[15%]",
    payment: "lg:w-[18%]",
    chevron: "w-[10%] lg:w-[4%]",
  } as const;

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-hairline-light bg-surface-soft/50 border-b">
            <th scope="col" className={`${LIST_TH} ${COL.date} ${W.date}`}>
              {t.columns.contractDate}
            </th>
            <th scope="col" className={`${LIST_TH} ${W.customer}`}>
              {t.columns.customerName}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.assignee} ${W.assignee}`}>
              {t.columns.assignee}
            </th>
            <th scope="col" className={`${LIST_TH} ${W.status}`}>
              {t.columns.status}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.amount} ${W.amount} text-right`}>
              {t.columns.contractAmount}
            </th>
            <th scope="col" className={`${LIST_TH} ${COL.payment} ${W.payment}`}>
              {t.columns.paymentStatus}
            </th>
            <th className={W.chevron} aria-hidden />
          </tr>
        </thead>
        <tbody className="divide-hairline-light divide-y">
          {contracts.map((row) => (
            <tr
              key={row.id}
              tabIndex={0}
              role="button"
              aria-label={`${row.customerName}${c.honorific} ${formatDate(row.contractDate)}`}
              className={LIST_ROW}
              onClick={() => goToDetail(row.customerId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  goToDetail(row.customerId);
                }
              }}
            >
              <td className={`${LIST_TD_NUM} ${COL.date}`}>{formatDate(row.contractDate)}</td>
              <td className={LIST_TD_STRONG}>
                {row.customerName} {c.honorific}
              </td>
              <td className={`${LIST_TD} ${COL.assignee}`}>{row.assigneeName ?? c.none}</td>
              {/* 契約状況は行の主 status。バッジはここ 1 つだけに絞る。 */}
              <td className={LIST_TD}>
                <Badge variant={contractStatusVariant(row.status)}>
                  {labels.contract.statuses[row.status]}
                </Badge>
              </td>
              <td className={`${LIST_TD_NUM} text-ink text-right ${COL.amount}`}>
                {formatAmount(row.contractAmount)}
              </td>
              {/* 入金状況 — 一覧から直接変更（保存先は ContractPayment.paymentStatus）。
                  決済の詳細確認は決済管理（/payments）が担当で、ここは契約業務の進行管理。 */}
              <td className={`${LIST_TD} ${COL.payment}`}>
                <InlineSelectInput
                  value={row.paymentStatus ?? ""}
                  options={PAYMENT_STATUS_OPTIONS}
                  unsetLabel={p.unset}
                  ariaLabel={` `}
                  onCommit={(next) =>
                    saveProjectContractAction({
                      customerId: row.customerId,
                      contractId: row.id,
                      paymentStatus: next as "UNPAID" | "PARTIAL" | "PAID",
                    })
                  }
                />
              </td>
              <td className={`${LIST_TD} text-right`}>
                <ChevronRight className="text-mute-light inline size-4" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
