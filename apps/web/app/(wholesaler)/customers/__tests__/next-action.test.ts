import { describe, expect, it } from "vitest";

import { resolveNextAction } from "../next-action";

import type { CustomerListItem } from "../constants";
import type { NextActionLabels } from "../next-action";

// 実際の文言に依存しないよう、テスト内では識別しやすい値を使う。
const T: NextActionLabels = {
  closed: "—",
  appointmentSet: "アポ設定",
  appointmentMissing: "未設定",
  appointmentNext: "次回アポ",
  maekaku: "マエカク実施",
  maekakuPending: "未実施",
  survey: "現地調査",
  surveyPending: "未実施",
  construction: "施工",
  constructionPending: "着工待ち",
  constructionRunning: "進行中",
  subsidySubmit: "申請提出",
  subsidyUnsubmitted: "未提出",
  subsidyResult: "申請結果",
  subsidyInReview: "審査中",
  completed: "完了",
  none: "—",
};

const fmt = (iso: string) => `[${iso}]`;

type Row = Pick<
  CustomerListItem,
  "contractStatus" | "constructionStatus" | "subsidyStatus" | "maekaku" | "nextAppointmentAt"
>;

function row(over: Partial<Row> = {}): Row {
  return {
    contractStatus: "negotiating",
    constructionStatus: "not_started",
    subsidyStatus: "not_applied",
    maekaku: "present",
    nextAppointmentAt: "2026-08-15T17:11:00.000Z",
    ...over,
  };
}

describe("resolveNextAction — 表示文法", () => {
  it("全ての分岐で label（何をするか）が日付そのものにならない", () => {
    const cases: Row[] = [
      row(),
      row({ nextAppointmentAt: null }),
      row({ maekaku: "absent" }),
      row({ contractStatus: "contracted" }),
      row({ contractStatus: "contracted", constructionStatus: "surveyed" }),
      row({ contractStatus: "contracted", constructionStatus: "in_progress" }),
      row({ contractStatus: "contracted", constructionStatus: "done" }),
      row({ contractStatus: "contracted", constructionStatus: "done", subsidyStatus: "applied" }),
      row({ contractStatus: "contracted", constructionStatus: "done", subsidyStatus: "completed" }),
      row({ contractStatus: "lost" }),
    ];
    for (const c of cases) {
      const r = resolveNextAction(c, T, fmt);
      expect(r.label, JSON.stringify(c)).not.toMatch(/^\[/); // 整形済み日時が label に来ていない
      expect(typeof r.detail).toBe("string");
      expect(["high", "normal", "none"]).toContain(r.urgency);
    }
  });
});

describe("resolveNextAction — 契約前", () => {
  it("次回アポあり: label=次回アポ / detail=日時 / urgency=normal", () => {
    expect(resolveNextAction(row(), T, fmt)).toEqual({
      type: "appointment",
      label: "次回アポ",
      detail: "[2026-08-15T17:11:00.000Z]",
      urgency: "normal",
    });
  });

  it("アポ未設定: label=アポ設定 / detail=未設定 / urgency=high", () => {
    expect(resolveNextAction(row({ nextAppointmentAt: null }), T, fmt)).toEqual({
      type: "appointment",
      label: "アポ設定",
      detail: "未設定",
      urgency: "high",
    });
  });

  it("マエカク未実施: label=マエカク実施 / detail=未実施 / urgency=high", () => {
    expect(resolveNextAction(row({ maekaku: "absent" }), T, fmt)).toEqual({
      type: "maekaku",
      label: "マエカク実施",
      detail: "未実施",
      urgency: "high",
    });
  });

  it("優先順位は従来どおり: アポ未設定 > マエカク未実施", () => {
    const r = resolveNextAction(row({ nextAppointmentAt: null, maekaku: "absent" }), T, fmt);
    expect(r.type).toBe("appointment");
    expect(r.label).toBe("アポ設定");
  });
});

describe("resolveNextAction — 契約済", () => {
  const contracted = (over: Partial<Row> = {}) =>
    resolveNextAction(row({ contractStatus: "contracted", ...over }), T, fmt);

  it("現地調査前: label=現地調査 / detail=未実施", () => {
    expect(contracted({ constructionStatus: "not_started" })).toEqual({
      type: "survey",
      label: "現地調査",
      detail: "未実施",
      urgency: "normal",
    });
  });

  it("施工前・施工中は施工として現在地を出す", () => {
    expect(contracted({ constructionStatus: "surveyed" })).toEqual({
      type: "construction",
      label: "施工",
      detail: "着工待ち",
      urgency: "normal",
    });
    expect(contracted({ constructionStatus: "in_progress" })).toEqual({
      type: "construction",
      label: "施工",
      detail: "進行中",
      urgency: "normal",
    });
  });

  it("完工済みで申請未提出だけ urgency=high", () => {
    for (const subsidyStatus of ["not_applied", "preparing"] as const) {
      expect(contracted({ constructionStatus: "done", subsidyStatus })).toEqual({
        type: "subsidy",
        label: "申請提出",
        detail: "未提出",
        urgency: "high",
      });
    }
  });

  it("申請済み・修正中は審査待ちなので normal", () => {
    for (const subsidyStatus of ["applied", "revising"] as const) {
      const r = contracted({ constructionStatus: "done", subsidyStatus });
      expect(r).toEqual({
        type: "subsidy",
        label: "申請結果",
        detail: "審査中",
        urgency: "normal",
      });
    }
  });

  it("要対応が何も無い（完工かつ申請完了）は完了として静かに出す", () => {
    expect(contracted({ constructionStatus: "done", subsidyStatus: "completed" })).toEqual({
      type: "done",
      label: "完了",
      detail: "",
      urgency: "none",
    });
  });
});

describe("resolveNextAction — 終了案件", () => {
  it("失注・キャンセルは行動を促さない", () => {
    for (const contractStatus of ["lost", "cancelled"] as const) {
      expect(resolveNextAction(row({ contractStatus }), T, fmt)).toEqual({
        type: "closed",
        label: "—",
        detail: "",
        urgency: "none",
      });
    }
  });

  it("失注ならアポが無くても「アポ設定」にはしない", () => {
    const r = resolveNextAction(row({ contractStatus: "lost", nextAppointmentAt: null }), T, fmt);
    expect(r.type).toBe("closed");
  });
});
