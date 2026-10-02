"use client";

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { formatMonthDayWithWeekday, formatTime } from "@/lib/format/date";
import { labels } from "@/lib/i18n/labels";

import { resolveNextAction } from "./next-action";

import type {
  ContractStatusValue,
  ConstructionStatusValue,
  CustomerListItem,
  MaekakuValue,
  SubsidyStatusValue,
} from "./constants";
import type { BadgeVariant } from "@/components/ui/badge";
import type { ReactNode } from "react";

export function maekakuVariant(v: MaekakuValue): BadgeVariant {
  return v === "present" ? "success" : "secondary";
}

export function contractVariant(v: ContractStatusValue): BadgeVariant {
  switch (v) {
    case "contracted":
      return "success";
    case "contract_pending":
    case "quote_presented":
    case "negotiating":
      return "default";
    case "pre_visit":
    case "lost":
      return "secondary";
    case "cancelled":
      return "destructive";
  }
}

export function constructionVariant(v: ConstructionStatusValue): BadgeVariant {
  switch (v) {
    case "done":
      return "success";
    case "in_progress":
      return "warning";
    case "surveyed":
      return "default";
    case "not_started":
      return "secondary";
  }
}

export function subsidyVariant(v: SubsidyStatusValue): BadgeVariant {
  switch (v) {
    case "completed":
      return "success";
    case "applied":
      return "default";
    case "revising":
      return "warning";
    case "preparing":
      return "default";
    case "not_applied":
      return "secondary";
  }
}

const TH = "px-4 py-2.5 text-left text-xs font-semibold text-mute-light";

// 一覧は DB の列ではなく、業務上の問いに対応させる:
//   顧客       … 誰の案件か（氏名。エリア・担当者は 2 段目に小さく添える）
//   進捗       … いま商談のどの段階か
//   次アクション … 次に何をするか（放置すると損失が出るものは注意色）
//   施工状況 / 申請状況 … 契約後の 2 つの工程。どちらが止まっているかを
//                        一覧のまま判別したいので、1 セルにまとめず分ける。
//
// 「次アクション」を契約状況より強く見せているのは、催事営業では
// アポの空きとマエカクの取りこぼしがそのまま失注につながるため。
const COL = {
  /** 常時 — 誰の案件か。 */
  customer: "",
  /**
   * 商談の現在地。スマホでは列を落とし、顧客セルの 2 行目にバッジを寄せる。
   * 狭い列に残すと「商／談／中」と 1 文字ずつ折り返してしまうため。
   */
  progress: "hidden sm:table-cell",
  /** 次に何をするか。狭い画面でも残す（この一覧の主目的）。 */
  nextAction: "",
  /** 契約後の工程。1024px 以上で 2 列に分けて追えるようにする。 */
  construction: "hidden lg:table-cell",
  subsidy: "hidden lg:table-cell",
} as const;

// 列幅は内容ではなくレイアウトで決める。
//
// 以前は table-layout: auto のままだったため、タブを切り替えるとその時点の
// データ内容で列幅が再計算され、ヘッダの x 座標が最大 45px 動いていた
// （例: 施工状況 171.6px〜216.7px）。同じ表なのに毎回ずれるので、
// 縦に目で追ったときに一覧としての安定感が無かった。
//
// table-fixed + 基準行（thead）の幅指定で列を固定する。幅の配分は
//   顧客        … 氏名 + エリア・担当者の 2 段が入る最大の列
//   次アクション … この一覧の主目的なので 2 番目に広く
//   進捗        … バッジ 1 個ぶん
//   施工 / 申請  … 4〜6 文字の状態ラベルが収まれば足りる
// という優先順位から決めた。
//
// 幅を colgroup ではなく th に置いているのは、<col> が table-column 要素で、
// そこへ hidden / table-cell のような display ユーティリティを当てると
// 列そのものが列リストから外れ、幅の割り当てが 1 つずれるため
// （施工状況が 46px、chevron が 172px になる不具合が実際に出た）。
//
// ブレークポイントごとに合計 100% になるよう 2 組持つ。
// lg 未満では施工/申請を出さないので、その分を残る列へ配分する。
// 表示する列数が breakpoint で変わるので、幅もそのつど配分し直す
// （PC 用の % をそのままスマホに残すと、どの列も狭すぎて溢れる）。
const COL_WIDTH = {
  customer: "w-[48%] sm:w-[40%] lg:w-[28%]",
  progress: "sm:w-[18%] lg:w-[13%]",
  nextAction: "w-[40%] sm:w-[36%] lg:w-[25%]",
  construction: "lg:w-[15%]",
  subsidy: "lg:w-[15%]",
  chevron: "w-[12%] sm:w-[6%] lg:w-[4%]",
} as const;

/** 次アクションの強さに対応する文字色。high だけが色を持つ。 */
const URGENCY_CLASS = {
  high: "text-danger font-medium",
  normal: "text-ink",
  none: "text-slate-400",
} as const;

// 「対象外」を表す記号は 1 箇所に集約し、色も位置も全列で同じにする。
// 契約前の行では施工・申請がまだ始まっていないため値を持たないが、
// 空セルにすると行が抜けて見えるので、淡い記号で位置だけ揃える。
const NOT_APPLICABLE_CLASS = "text-slate-300";

/**
 * 行の縦位置を決めるアンカー。
 *
 * 顧客セルだけは必ず 2 段（氏名 + エリア・担当者）で描き、この高さが
 * 行全体の高さを決める。他のセルは意味に合った行数のままでよく、
 * 全セルを top 揃えにすることで 1 段のセルも 2 段セルの 1 行目と
 * 同じベースラインに乗る（行の中央に浮かない）。
 */
function CustomerCell({
  name,
  meta,
  badge,
}: {
  name: string;
  meta: string;
  /** スマホでのみ 2 行目に出す進捗バッジ（sm 以上では専用列が担当する）。 */
  badge: ReactNode;
}) {
  return (
    <span className="block">
      <span className="text-ink block truncate text-sm font-medium leading-5">{name}</span>
      <span className="flex h-4 items-center gap-1.5 text-xs leading-4">
        <span className="text-mute-light min-w-0 truncate">{meta}</span>
        <span className="shrink-0 sm:hidden">{badge}</span>
      </span>
    </span>
  );
}

/** 次アクションの補足に載せる短い日時（例: 8/15 (金) 17:11）。 */
function formatAppointmentShort(iso: string): string {
  return `${formatMonthDayWithWeekday(iso)} ${formatTime(iso)}`;
}

interface CustomerTableProps {
  customers: CustomerListItem[];
}

export function CustomerTable({ customers }: CustomerTableProps) {
  const t = labels.customer;
  const router = useRouter();

  // 行クリック / Enter・Space で顧客詳細へ遷移。
  function goToDetail(id: string) {
    router.push(`/customers/${id}`);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-hairline-light bg-surface-soft/50 border-b">
            <th scope="col" className={`${TH} ${COL_WIDTH.customer}`}>
              {t.columns.customer}
            </th>
            <th scope="col" className={`${TH} ${COL.progress} ${COL_WIDTH.progress}`}>
              {t.columns.progress}
            </th>
            <th scope="col" className={`${TH} ${COL_WIDTH.nextAction}`}>
              {t.columns.nextAction}
            </th>
            <th scope="col" className={`${TH} ${COL.construction} ${COL_WIDTH.construction}`}>
              {t.columns.constructionStatus}
            </th>
            <th scope="col" className={`${TH} ${COL.subsidy} ${COL_WIDTH.subsidy}`}>
              {t.columns.subsidyStatus}
            </th>
            <th className={`px-3 py-2.5 ${COL_WIDTH.chevron}`} aria-hidden />
          </tr>
        </thead>
        <tbody className="divide-hairline-light divide-y">
          {customers.map((row) => {
            const next = resolveNextAction(row, t.nextActions, formatAppointmentShort);
            // 施工・申請は契約後にしか意味を持たない。契約前の行で工程名を
            // 出すと、実際には始まっていない工程が進行中に見えてしまう。
            const contracted = row.contractStatus === "contracted";
            // 完工済みで申請が出ていない行だけ、止まっている側を強調する。
            const subsidyBlocked =
              contracted &&
              row.constructionStatus === "done" &&
              (row.subsidyStatus === "not_applied" || row.subsidyStatus === "preparing");
            return (
              <tr
                key={row.id}
                tabIndex={0}
                role="button"
                aria-label={`${row.name}${t.honorific}`}
                className="hover:bg-page active:bg-surface-soft focus-visible:bg-page focus-visible:ring-primary/60 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                onClick={() => goToDetail(row.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    goToDetail(row.id);
                  }
                }}
              >
                {/* 顧客 — 行の高さを決めるアンカー。 */}
                <td className="px-4 py-2 align-top">
                  <CustomerCell
                    name={`${row.name} ${t.honorific}`}
                    meta={[row.area, row.assigneeName].filter(Boolean).join("・")}
                    badge={
                      <Badge variant={contractVariant(row.contractStatus)}>
                        {t.contractStatusLabels[row.contractStatus]}
                      </Badge>
                    }
                  />
                </td>

                {/* 進捗 — 一覧で badge を使うのはここだけに絞る。
                    h-5 は顧客セルの 1 行目と同じ高さで、上端が揃う。 */}
                <td className={`px-4 py-2 align-top ${COL.progress}`}>
                  <span className="flex h-5 items-center">
                    <Badge variant={contractVariant(row.contractStatus)}>
                      {t.contractStatusLabels[row.contractStatus]}
                    </Badge>
                  </span>
                </td>

                {/* 次アクション — この一覧の主目的。
                    補足が無い行（完了 / 対象外）は 2 段目を描かない。行の高さは
                    顧客セルが決めるので、空の 2 段目を確保する必要は無い。 */}
                <td className="px-4 py-2 align-top">
                  <span className="block">
                    <span
                      className={`block truncate text-sm leading-5 ${URGENCY_CLASS[next.urgency]}`}
                    >
                      {next.label}
                    </span>
                    {next.detail ? (
                      <span
                        className={`block truncate text-xs leading-4 ${
                          next.urgency === "high" ? "text-danger" : "text-mute-light tabular-nums"
                        }`}
                      >
                        {next.detail}
                      </span>
                    ) : null}
                  </span>
                </td>

                {/* 施工状況 — 通常は muted な素のテキスト（badge を増やさない）。 */}
                <td className={`px-4 py-2 align-top ${COL.construction}`}>
                  <span
                    className={`block truncate text-sm leading-5 ${contracted ? "text-mute-light" : NOT_APPLICABLE_CLASS}`}
                  >
                    {contracted ? t.constructionStatusLabels[row.constructionStatus] : t.none}
                  </span>
                </td>

                {/* 申請状況 — 完工済みで未提出のときだけ、止まっている側を強調。 */}
                <td className={`px-4 py-2 align-top ${COL.subsidy}`}>
                  <span
                    className={`block truncate text-sm leading-5 ${
                      subsidyBlocked
                        ? "text-danger font-medium"
                        : contracted
                          ? "text-mute-light"
                          : NOT_APPLICABLE_CLASS
                    }`}
                  >
                    {contracted ? t.subsidyStatusLabels[row.subsidyStatus] : t.none}
                  </span>
                </td>

                <td className="px-3 py-2 align-top">
                  <span className="flex h-5 items-center justify-end">
                    <ChevronRight className="text-mute-light size-4" />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
