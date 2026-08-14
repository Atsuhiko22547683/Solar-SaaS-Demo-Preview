"use client";

// アポイント一覧の検索・絞り込みバー。
// 構成・スタイルは S-032 顧客一覧の customer-filter.tsx と同型（ローカル state に
// 保持し、「検索」を押したときだけ URL クエリへ反映する）。

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  FILTER_INPUT_CLASS,
  FILTER_LABEL_CLASS,
  FILTER_SELECT_CLASS,
} from "@/components/list/list-shell";
import { Button } from "@/components/ui/button";
import { labels } from "@/lib/i18n/labels";

import { APPOINTMENT_STATUS_VALUES } from "./constants";

interface AssigneeOption {
  id: string;
  name: string;
}

interface AppointmentFilterProps {
  query: string;
  assigneeUserId: string;
  status: string;
  from: string;
  to: string;
  assignees: AssigneeOption[];
}

export function AppointmentFilter({
  query,
  assigneeUserId,
  status,
  from,
  to,
  assignees,
}: AppointmentFilterProps) {
  const router = useRouter();
  const t = labels.appointment.list.filters;
  const statusLabels = labels.appointment.statuses;

  const [queryValue, setQueryValue] = useState(query);
  const [assigneeValue, setAssigneeValue] = useState(assigneeUserId);
  const [statusValue, setStatusValue] = useState(status);
  const [fromValue, setFromValue] = useState(from);
  const [toValue, setToValue] = useState(to);

  function applyFilters() {
    const params = new URLSearchParams();
    const q = queryValue.trim();
    if (q) params.set("query", q);
    if (assigneeValue) params.set("assigneeUserId", assigneeValue);
    if (statusValue) params.set("status", statusValue);
    if (fromValue) params.set("from", fromValue);
    if (toValue) params.set("to", toValue);
    const qs = params.toString();
    router.push(qs ? `/appointments?${qs}` : "/appointments");
  }

  function clearFilters() {
    setQueryValue("");
    setAssigneeValue("");
    setStatusValue("");
    setFromValue("");
    setToValue("");
    router.push("/appointments");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        applyFilters();
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="appt-query" className={FILTER_LABEL_CLASS}>
            {t.customerName}
          </label>
          <input
            id="appt-query"
            type="search"
            value={queryValue}
            onChange={(e) => setQueryValue(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchPlaceholder}
            className={`${FILTER_INPUT_CLASS} w-56`}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="appt-assignee" className={FILTER_LABEL_CLASS}>
            {t.assignee}
          </label>
          <select
            id="appt-assignee"
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

        <div className="space-y-1">
          <label htmlFor="appt-status" className={FILTER_LABEL_CLASS}>
            {t.status}
          </label>
          <select
            id="appt-status"
            value={statusValue}
            onChange={(e) => setStatusValue(e.target.value)}
            className={FILTER_SELECT_CLASS}
          >
            <option value="">{t.all}</option>
            {APPOINTMENT_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="appt-from" className={FILTER_LABEL_CLASS}>
            {t.from}
          </label>
          <input
            id="appt-from"
            type="date"
            value={fromValue}
            onChange={(e) => setFromValue(e.target.value)}
            className={`${FILTER_INPUT_CLASS} w-40`}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="appt-to" className={FILTER_LABEL_CLASS}>
            {t.to}
          </label>
          <input
            id="appt-to"
            type="date"
            value={toValue}
            onChange={(e) => setToValue(e.target.value)}
            className={`${FILTER_INPUT_CLASS} w-40`}
          />
        </div>

        <Button type="submit">{t.search}</Button>
        <Button type="button" variant="outline" onClick={clearFilters}>
          {t.clear}
        </Button>
      </div>
    </form>
  );
}
