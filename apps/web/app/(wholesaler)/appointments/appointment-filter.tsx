"use client";

// アポイント一覧の検索・絞り込みバー。
//
// 構成・スタイルは S-032 顧客一覧の customer-filter.tsx と同型（ローカル state に
// 保持し、「検索」を押したときだけ URL クエリへ反映する）。
//
// ここでの決め事:
//  - よく使う条件を上段に、それ以外は「詳細条件」に畳む（全項目を横一列に並べない）。
//  - 期間は「アポ予定日」「登録日」を別の見出しにする。どちらの日付か分からない
//    「検索範囲」という名前は使わない。
//  - 選択式には必ず「すべて」を置く。0 件でも条件欄とクリア操作は残す
//    （ListFilterPanel が常に描画する）。
//  - 期間の前後が逆のときはエラーを出す。黙って入れ替えたり 0 件にしたりしない。
//  - 並べ替え・ページは URL に残っているものを引き継ぐ。条件を変えたときだけ
//    1 ページ目へ戻す（並び順が変わると「何ページ目か」の意味が変わるため）。

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ListFilterPanel } from "@/components/list/list-filter-panel";
import {
  FILTER_INPUT_CLASS,
  FILTER_LABEL_CLASS,
  FILTER_SELECT_CLASS,
} from "@/components/list/list-shell";
import { labels } from "@/lib/i18n/labels";

import {
  APPOINTMENT_STATUS_VALUES,
  PARTNER_APPOINTMENT_KIND_VALUES,
  PRE_CALL_FILTER_VALUES,
} from "./constants";
import { APPOINTMENT_BASE_PATH, EMPTY_APPOINTMENT_QUERY, toSearchParams } from "./query";

import type { AppointmentFilterOptions } from "./data";
import type { AppointmentQuery } from "./query";

interface AssigneeOption {
  id: string;
  name: string;
}

interface AppointmentFilterProps {
  value: AppointmentQuery;
  assignees: AssigneeOption[];
  options: AppointmentFilterOptions;
  activeCount: number;
  defaultOpen: boolean;
  rangeErrors: { scheduled: boolean; created: boolean };
}

/** 開始日 〜 終了日。見出しで「何の日付か」を必ず名乗る。 */
function DateRange({
  idPrefix,
  label,
  from,
  to,
  onFrom,
  onTo,
  error,
}: {
  idPrefix: string;
  label: string;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  error?: string;
}) {
  const lc = labels.listCommon;
  return (
    <div className="space-y-1">
      <span className={FILTER_LABEL_CLASS}>{label}</span>
      <div className="flex items-center gap-2">
        <input
          id={`${idPrefix}-from`}
          type="date"
          value={from}
          onChange={(e) => onFrom(e.target.value)}
          aria-label={`${label} ${lc.dateRangeFrom}`}
          aria-invalid={error ? true : undefined}
          className={`${FILTER_INPUT_CLASS} w-40`}
        />
        <span aria-hidden className="text-mute-light text-sm">
          {lc.rangeSeparator}
        </span>
        <input
          id={`${idPrefix}-to`}
          type="date"
          value={to}
          onChange={(e) => onTo(e.target.value)}
          aria-label={`${label} ${lc.dateRangeTo}`}
          aria-invalid={error ? true : undefined}
          className={`${FILTER_INPUT_CLASS} w-40`}
        />
      </div>
      {error ? (
        <p role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Select({
  id,
  label,
  value,
  onChange,
  children,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className={FILTER_LABEL_CLASS}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FILTER_SELECT_CLASS}
        aria-describedby={hint ? `${id}-hint` : undefined}
      >
        {children}
      </select>
      {hint ? (
        <p id={`${id}-hint`} className="text-mute-light text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function AppointmentFilter({
  value,
  assignees,
  options,
  activeCount,
  defaultOpen,
  rangeErrors,
}: AppointmentFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = labels.appointment.list.filters;
  const statusLabels = labels.appointment.statuses;
  const kindLabels = labels.appointment.list.partnerKindLabels;
  const preCallLabels = labels.preCall.resultBadges;

  const [v, setV] = useState<AppointmentQuery>(value);
  const [showMore, setShowMore] = useState(defaultOpen && hasAdvanced(value));

  function set<K extends keyof AppointmentQuery>(key: K, next: AppointmentQuery[K]) {
    setV((prev) => ({ ...prev, [key]: next }));
  }

  /** 並べ替えは検索条件ではないので、条件を変えても引き継ぐ。ページだけ 1 に戻す。 */
  function push(next: AppointmentQuery) {
    const sp = toSearchParams(next);
    const sortField = searchParams.get("sortField");
    const sortDir = searchParams.get("sortDir");
    if (sortField) sp.set("sortField", sortField);
    if (sortDir) sp.set("sortDir", sortDir);
    const qs = sp.toString();
    router.push(qs ? `${APPOINTMENT_BASE_PATH}?${qs}` : APPOINTMENT_BASE_PATH);
  }

  return (
    <ListFilterPanel
      idPrefix="appt"
      activeCount={activeCount}
      defaultOpen={defaultOpen}
      onSubmit={() => push(v)}
      onClear={() => {
        setV(EMPTY_APPOINTMENT_QUERY);
        push(EMPTY_APPOINTMENT_QUERY);
      }}
    >
      {/* よく使う条件 */}
      <div className="space-y-1">
        <label htmlFor="appt-query" className={FILTER_LABEL_CLASS}>
          {t.customerName}
        </label>
        <input
          id="appt-query"
          type="search"
          value={v.query}
          onChange={(e) => set("query", e.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          className={`${FILTER_INPUT_CLASS} w-56`}
        />
      </div>

      <DateRange
        idPrefix="appt-scheduled"
        label={t.scheduledRange}
        from={v.from}
        to={v.to}
        onFrom={(x) => set("from", x)}
        onTo={(x) => set("to", x)}
        error={rangeErrors.scheduled ? t.invalidRange : undefined}
      />

      <Select
        id="appt-status"
        label={t.status}
        value={v.status}
        onChange={(x) => set("status", x as AppointmentQuery["status"])}
      >
        <option value="">{t.all}</option>
        {APPOINTMENT_STATUS_VALUES.map((s) => (
          <option key={s} value={s}>
            {statusLabels[s]}
          </option>
        ))}
      </Select>

      <Select
        id="appt-assignee"
        label={t.assignee}
        value={v.assigneeUserId}
        onChange={(x) => set("assigneeUserId", x)}
      >
        <option value="">{t.all}</option>
        {assignees.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>

      <Select
        id="appt-precall"
        label={t.preCall}
        value={v.preCall}
        onChange={(x) => set("preCall", x as AppointmentQuery["preCall"])}
      >
        <option value="">{t.all}</option>
        {PRE_CALL_FILTER_VALUES.map((p) => (
          <option key={p} value={p}>
            {p === "NONE" ? t.preCallNone : preCallLabels[p]}
          </option>
        ))}
      </Select>

      {/* 詳細条件 — 全項目を横一列に並べないための折りたたみ。 */}
      <div className="w-full">
        <button
          type="button"
          aria-expanded={showMore}
          aria-controls="appt-more"
          onClick={() => setShowMore((x) => !x)}
          className="text-link-light text-sm underline underline-offset-2"
        >
          {t.moreTitle}
        </button>
      </div>

      {showMore ? (
        <div id="appt-more" className="flex w-full flex-wrap items-end gap-4">
          <DateRange
            idPrefix="appt-created"
            label={t.createdRange}
            from={v.createdFrom}
            to={v.createdTo}
            onFrom={(x) => set("createdFrom", x)}
            onTo={(x) => set("createdTo", x)}
            error={rangeErrors.created ? t.invalidRange : undefined}
          />

          <Select id="appt-area" label={t.area} value={v.area} onChange={(x) => set("area", x)}>
            <option value="">{t.all}</option>
            {options.areas.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </Select>

          <Select
            id="appt-company"
            label={t.company}
            value={v.relationshipId}
            onChange={(x) => set("relationshipId", x)}
            hint={t.companyHint}
          >
            <option value="">{t.all}</option>
            {options.companies.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>

          <Select
            id="appt-type"
            label={t.appointmentType}
            value={v.appointmentType}
            onChange={(x) => set("appointmentType", x)}
          >
            <option value="">{t.all}</option>
            {options.appointmentTypes.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </Select>

          <Select
            id="appt-kind"
            label={t.partnerKind}
            value={v.partnerKind}
            onChange={(x) => set("partnerKind", x as AppointmentQuery["partnerKind"])}
          >
            <option value="">{t.all}</option>
            {PARTNER_APPOINTMENT_KIND_VALUES.map((k) => (
              <option key={k} value={k}>
                {kindLabels[k]}
              </option>
            ))}
          </Select>

          <Select
            id="appt-event"
            label={t.event}
            value={v.eventId}
            onChange={(x) => set("eventId", x)}
          >
            <option value="">{t.all}</option>
            {options.events.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </Select>

          <div className="space-y-1">
            <label htmlFor="appt-event-query" className={FILTER_LABEL_CLASS}>
              {t.eventQuery}
            </label>
            <input
              id="appt-event-query"
              type="search"
              value={v.eventQuery}
              onChange={(e) => set("eventQuery", e.target.value)}
              aria-describedby="appt-event-query-hint"
              className={`${FILTER_INPUT_CLASS} w-56`}
            />
            <p id="appt-event-query-hint" className="text-mute-light text-xs">
              {t.eventQueryHint}
            </p>
          </div>
        </div>
      ) : null}
    </ListFilterPanel>
  );
}

/** 詳細条件のどれかが使われているか（条件付き URL で開いたときに開いた状態にする）。 */
function hasAdvanced(q: AppointmentQuery): boolean {
  return Boolean(
    q.createdFrom ||
    q.createdTo ||
    q.area ||
    q.relationshipId ||
    q.appointmentType ||
    q.partnerKind ||
    q.eventId ||
    q.eventQuery,
  );
}
