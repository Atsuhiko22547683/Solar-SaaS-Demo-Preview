"use client";

// コール一覧の検索・絞り込みパネル。
//
// 一覧を見るための画面領域を空けるため、初期状態は折りたたみ（ヘッダ「検索条件」だけ表示）。
// ヘッダをクリックすると展開する。展開状態は画面上の一時的な UI 状態で保存しない。
// ただし検索条件付きの URL で開いた場合は「今どの条件で絞り込まれているか」が分かるよう、
// 初期状態から開いておく（page.tsx が defaultOpen を渡す）。
//
// 絞り込みは 2 つのペアで構成する:
//   【対象項目】×【ステータス】 … 対象項目を変えるとステータスの選択肢が入れ替わる
//   【検索範囲（開始日 〜 終了日）】×【日付対象】… 日付対象の既定は「すべて」
// 並び替えはここではなく一覧直前（表示件数の横）の共通 ListSortSelect が持つ。
//
// 入力の反映方法・URL クエリ名は従来どおり（ローカル state → 「検索」で URL へ反映、
// 「クリア」で全解除）。検索ロジックには一切手を入れていない。

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ListDateRangeField, ListFilterPanel } from "@/components/list/list-filter-panel";
import {
  FILTER_INPUT_CLASS,
  FILTER_LABEL_CLASS,
  FILTER_SELECT_CLASS,
} from "@/components/list/list-shell";
import { labels } from "@/lib/i18n/labels";

import {
  CALL_DATE_FIELD_VALUES,
  CALL_TYPE_VALUES,
  DEFAULT_CALL_DATE_FIELD,
  DEFAULT_CALL_TYPE,
  STATUS_OPTIONS_BY_CALL_TYPE,
  UNSET_STATUS,
} from "./constants";

import type { CallTypeValue } from "./constants";

const BASE_PATH = "/customers/maekaku";

interface AssigneeOption {
  id: string;
  name: string;
}

interface CallFilterProps {
  query: string;
  assigneeUserId: string;
  callType: CallTypeValue;
  callStatus: string;
  dateField: string;
  dateFrom: string;
  dateTo: string;
  assignees: AssigneeOption[];
  /** 現在の表示件数。検索時も維持する（既定値のときは URL に載せない）。 */
  pageSize: number;
  defaultPageSize: number;
  /** 有効な検索条件の数。0 のときはヘッダにバッジを出さない。 */
  activeCount: number;
  /** 初期表示で開くか（検索条件付き URL で開いたときだけ true）。 */
  defaultOpen: boolean;
}

export function CallFilter({
  query,
  assigneeUserId,
  callType,
  callStatus,
  dateField,
  dateFrom,
  dateTo,
  assignees,
  pageSize,
  defaultPageSize,
  activeCount,
  defaultOpen,
}: CallFilterProps) {
  const router = useRouter();
  const t = labels.customer.calls.filters;
  const c = labels.customer.calls;
  // ステータスの表示ラベルは顧客詳細コールタブと共有（新しい値域を作らない）。
  const p = labels.customer.detail.projectInfo;

  const [queryValue, setQueryValue] = useState(query);
  const [assigneeValue, setAssigneeValue] = useState(assigneeUserId);
  const [callTypeValue, setCallTypeValue] = useState<CallTypeValue>(callType);
  const [statusValue, setStatusValue] = useState(callStatus);
  const [dateFieldValue, setDateFieldValue] = useState(dateField);
  const [fromValue, setFromValue] = useState(dateFrom);
  const [toValue, setToValue] = useState(dateTo);

  /**
   * 選択中の対象項目に対応するステータス CODE → 表示ラベル。
   * すべて = 統合ラベル / マエカク = maekakuStatusDisplayLabels / 他 = callPhaseStatusLabels。
   */
  function statusLabel(code: string): string {
    if (code === UNSET_STATUS) return p.edit.unset;
    if (callTypeValue === "all") return c.combinedStatusLabels[code] ?? code;
    if (callTypeValue === "maekaku") return p.maekakuStatusDisplayLabels[code] ?? code;
    return p.callPhaseStatusLabels[code] ?? code;
  }

  // 対象項目を変えると旧ステータス CODE が値域外になりうるので選択を解除する
  // （例: サンキューコールの not_done を選んだままマエカクへ切り替えた場合）。
  function onCallTypeChange(next: CallTypeValue) {
    setCallTypeValue(next);
    if (!STATUS_OPTIONS_BY_CALL_TYPE[next].includes(statusValue)) {
      setStatusValue("");
    }
  }

  function applyFilters() {
    const params = new URLSearchParams();
    const q = queryValue.trim();
    if (q) params.set("query", q);
    if (assigneeValue) params.set("assigneeUserId", assigneeValue);
    if (callTypeValue !== DEFAULT_CALL_TYPE) params.set("callType", callTypeValue);
    if (statusValue) params.set("callStatus", statusValue);
    // 日付対象は期間が指定されているときだけ意味を持つので、その場合のみ URL に載せる。
    if (fromValue || toValue) {
      if (dateFieldValue !== DEFAULT_CALL_DATE_FIELD) params.set("dateField", dateFieldValue);
      if (fromValue) params.set("dateFrom", fromValue);
      if (toValue) params.set("dateTo", toValue);
    }
    if (pageSize !== defaultPageSize) params.set("pageSize", String(pageSize));
    const qs = params.toString();
    router.push(qs ? `${BASE_PATH}?${qs}` : BASE_PATH);
  }

  function clearFilters() {
    setQueryValue("");
    setAssigneeValue("");
    setCallTypeValue(DEFAULT_CALL_TYPE);
    setStatusValue("");
    setDateFieldValue(DEFAULT_CALL_DATE_FIELD);
    setFromValue("");
    setToValue("");
    router.push(BASE_PATH);
  }

  return (
    <ListFilterPanel
      idPrefix="call"
      activeCount={activeCount}
      defaultOpen={defaultOpen}
      onSubmit={applyFilters}
      onClear={clearFilters}
    >
      <div className="space-y-1">
        <label htmlFor="call-query" className={FILTER_LABEL_CLASS}>
          {t.customerName}
        </label>
        <input
          id="call-query"
          type="search"
          value={queryValue}
          onChange={(e) => setQueryValue(e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          className={`${FILTER_INPUT_CLASS} w-56`}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="call-assignee" className={FILTER_LABEL_CLASS}>
          {t.assignee}
        </label>
        <select
          id="call-assignee"
          value={assigneeValue}
          onChange={(e) => setAssigneeValue(e.target.value)}
          className={FILTER_SELECT_CLASS}
        >
          <option value="">{t.all}</option>
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {/* 【対象項目】×【ステータス】— 対象項目に応じてステータスの選択肢が入れ替わる。 */}
      <div className="space-y-1">
        <label htmlFor="call-type" className={FILTER_LABEL_CLASS}>
          {t.callType}
        </label>
        <select
          id="call-type"
          value={callTypeValue}
          onChange={(e) => onCallTypeChange(e.target.value as CallTypeValue)}
          className={FILTER_SELECT_CLASS}
        >
          {CALL_TYPE_VALUES.map((v) => (
            <option key={v} value={v}>
              {c.callTypeLabels[v] ?? v}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="call-status" className={FILTER_LABEL_CLASS}>
          {t.callStatus}
        </label>
        <select
          id="call-status"
          value={statusValue}
          onChange={(e) => setStatusValue(e.target.value)}
          className={FILTER_SELECT_CLASS}
        >
          <option value="">{t.all}</option>
          {STATUS_OPTIONS_BY_CALL_TYPE[callTypeValue].map((code) => (
            <option key={code} value={code}>
              {statusLabel(code)}
            </option>
          ))}
        </select>
      </div>

      {/* 【検索範囲】→【日付対象】の順に置く。日付対象は「どの日時に期間を掛けるか」の
                補足なので、期間の右側に添える。既定は「すべて」= 検索できる日時を横断。
                折り返しで左右が入れ替わらないよう、この 2 つは同じコンテナに入れる。 */}
      <div className="flex flex-wrap items-end gap-3">
        <ListDateRangeField
          idPrefix="call"
          from={fromValue}
          to={toValue}
          onFromChange={setFromValue}
          onToChange={setToValue}
        />

        <div className="space-y-1">
          <label htmlFor="call-date-field" className={FILTER_LABEL_CLASS}>
            {t.dateField}
          </label>
          <select
            id="call-date-field"
            value={dateFieldValue}
            onChange={(e) => setDateFieldValue(e.target.value)}
            className={FILTER_SELECT_CLASS}
          >
            {CALL_DATE_FIELD_VALUES.map((v) => (
              <option key={v} value={v}>
                {c.dateFieldLabels[v] ?? v}
              </option>
            ))}
          </select>
        </div>
      </div>
    </ListFilterPanel>
  );
}
