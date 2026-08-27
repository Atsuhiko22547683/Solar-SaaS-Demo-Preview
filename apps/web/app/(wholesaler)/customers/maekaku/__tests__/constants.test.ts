// コール一覧の値域正規化 + バッジ配色のリグレッションガード。
//
// 一覧の絞り込み・並び替えは URL クエリ由来なので、不正値が where / orderBy に
// そのまま流れないことをここで固定する。ステータスの値域は顧客詳細コールタブと
// 共有しているため、値が増減したらこのテストが落ちる（=気付ける）ようにしてある。

import { describe, expect, it } from "vitest";

import {
  CALL_DATE_FIELD_VALUES,
  CALL_SORT_FIELD_VALUES,
  CALL_STATUS_VALUES,
  CALL_TYPE_VALUES,
  COMBINED_STATUS_VALUES,
  DEFAULT_CALL_DATE_FIELD,
  DEFAULT_CALL_SORT_FIELD,
  DEFAULT_CALL_TYPE,
  DEFAULT_SORT_DIRECTION,
  MAEKAKU_STATUS_VALUES,
  STATUS_OPTIONS_BY_CALL_TYPE,
  UNSET_STATUS,
  callStatusVariant,
  computeNextTask,
  defaultDirectionFor,
  isOpenCallStatus,
  normalizeCallDateField,
  normalizeCallType,
  normalizeDateParam,
  normalizeSortDirection,
  normalizeSortField,
  normalizeStatusForCallType,
} from "../constants.js";

import type { NextTaskSource } from "../constants.js";

describe("コール一覧 — 値域", () => {
  it("コールステータスは顧客詳細と同じ 3 値（not_done/done/unnecessary）", () => {
    expect([...CALL_STATUS_VALUES]).toEqual(["not_done", "done", "unnecessary"]);
  });

  it("マエカクステータスは顧客詳細と同じ 3 値（pending/done/unnecessary）", () => {
    expect([...MAEKAKU_STATUS_VALUES]).toEqual(["pending", "done", "unnecessary"]);
  });

  it("対象項目は すべて + 4 種のコール", () => {
    expect([...CALL_TYPE_VALUES]).toEqual([
      "all",
      "maekaku",
      "thank_you",
      "loan_completion",
      "post_completion",
    ]);
    expect(DEFAULT_CALL_TYPE).toBe("all");
  });

  it("対象項目ごとのステータス選択肢は 未設定 + その種別の値域", () => {
    expect(STATUS_OPTIONS_BY_CALL_TYPE.maekaku).toEqual([
      UNSET_STATUS,
      "pending",
      "done",
      "unnecessary",
    ]);
    for (const type of ["thank_you", "loan_completion", "post_completion"] as const) {
      expect(STATUS_OPTIONS_BY_CALL_TYPE[type], type).toEqual([
        UNSET_STATUS,
        "not_done",
        "done",
        "unnecessary",
      ]);
    }
    // すべて は 4 種横断なので統合値（マエカク pending と他 not_done を 1 つに束ねる）。
    expect(STATUS_OPTIONS_BY_CALL_TYPE.all).toEqual([UNSET_STATUS, ...COMBINED_STATUS_VALUES]);
  });

  it("日付対象は すべて + 4 コールの希望日時 + 次回アポイント + 最終架電日時", () => {
    expect([...CALL_DATE_FIELD_VALUES]).toEqual([
      "all",
      "maekaku_preferred_at",
      "thank_you_preferred_at",
      "loan_completion_preferred_at",
      "post_completion_preferred_at",
      "next_appointment_at",
      "last_called_at",
    ]);
    // 既定は「すべて」= 検索できる日時を横断して OR で絞り込む。
    expect(DEFAULT_CALL_DATE_FIELD).toBe("all");
  });

  it("並び替え項目は 更新日時 / 顧客名 / 4 コール希望日時 / 次回アポイント日", () => {
    expect([...CALL_SORT_FIELD_VALUES]).toEqual([
      "updated_at",
      "name",
      "maekaku_preferred_at",
      "thank_you_preferred_at",
      "loan_completion_preferred_at",
      "post_completion_preferred_at",
      "next_appointment_at",
    ]);
    // 最終架電日時は Prisma の orderBy に落とせないため並び替え項目には含めない。
    expect(CALL_SORT_FIELD_VALUES).not.toContain("last_called_at");
  });

  it("既定の並び順は 更新日時の降順（従来の既定を維持）", () => {
    expect(DEFAULT_CALL_SORT_FIELD).toBe("updated_at");
    expect(DEFAULT_SORT_DIRECTION).toBe("desc");
  });

  it("項目を切り替えたときの既定方向は 更新日時=降順 / 日時・顧客名=昇順", () => {
    expect(defaultDirectionFor("updated_at")).toBe("desc");
    expect(defaultDirectionFor("name")).toBe("asc");
    expect(defaultDirectionFor("maekaku_preferred_at")).toBe("asc");
    expect(defaultDirectionFor("next_appointment_at")).toBe("asc");
  });
});

describe("コール一覧 — URL クエリの正規化", () => {
  it("normalizeCallType は値域外・未指定を既定（すべて）へ丸める", () => {
    expect(normalizeCallType("maekaku")).toBe("maekaku");
    expect(normalizeCallType("thank_you")).toBe("thank_you");
    expect(normalizeCallType("__evil__")).toBe(DEFAULT_CALL_TYPE);
    expect(normalizeCallType(undefined)).toBe(DEFAULT_CALL_TYPE);
  });

  it("normalizeStatusForCallType は対象項目に属さない CODE を弾く", () => {
    expect(normalizeStatusForCallType("maekaku", "pending")).toBe("pending");
    expect(normalizeStatusForCallType("maekaku", "unset")).toBe("unset");
    // マエカクに not_done は無い（サンキュー側の CODE）。
    expect(normalizeStatusForCallType("maekaku", "not_done")).toBeUndefined();
    expect(normalizeStatusForCallType("thank_you", "not_done")).toBe("not_done");
    // サンキューに pending は無い（マエカク側の CODE）。
    expect(normalizeStatusForCallType("thank_you", "pending")).toBeUndefined();
    // すべて は統合値のみ（pending は取らない）。
    expect(normalizeStatusForCallType("all", "not_done")).toBe("not_done");
    expect(normalizeStatusForCallType("all", "pending")).toBeUndefined();
    expect(normalizeStatusForCallType("all", "")).toBeUndefined();
    expect(normalizeStatusForCallType("all", undefined)).toBeUndefined();
  });

  it("normalizeCallDateField は値域外を既定へ丸める", () => {
    expect(normalizeCallDateField("last_called_at")).toBe("last_called_at");
    expect(normalizeCallDateField("drop table")).toBe(DEFAULT_CALL_DATE_FIELD);
    expect(normalizeCallDateField(undefined)).toBe(DEFAULT_CALL_DATE_FIELD);
  });

  it("normalizeSortField / normalizeSortDirection は値域外を既定へ丸める", () => {
    expect(normalizeSortField("name")).toBe("name");
    expect(normalizeSortField("next_appointment_at")).toBe("next_appointment_at");
    // 旧 UI の sort 値（maekaku_asc）は値域外なので既定に落ちる。
    expect(normalizeSortField("maekaku_asc")).toBe(DEFAULT_CALL_SORT_FIELD);
    expect(normalizeSortField(undefined)).toBe(DEFAULT_CALL_SORT_FIELD);

    expect(normalizeSortDirection("asc")).toBe("asc");
    expect(normalizeSortDirection("desc")).toBe("desc");
    expect(normalizeSortDirection("sideways")).toBe(DEFAULT_SORT_DIRECTION);
    expect(normalizeSortDirection(undefined)).toBe(DEFAULT_SORT_DIRECTION);
  });

  it("normalizeSortDirection の既定はその項目にとって自然な向き", () => {
    // sortField だけの URL（?sortField=name）は「あいうえお順」= 昇順で解釈する。
    expect(normalizeSortDirection(undefined, "name")).toBe("asc");
    expect(normalizeSortDirection(undefined, "maekaku_preferred_at")).toBe("asc");
    expect(normalizeSortDirection(undefined, "updated_at")).toBe("desc");
    // 明示された向きは項目に関係なくそのまま通す。
    expect(normalizeSortDirection("desc", "name")).toBe("desc");
    expect(normalizeSortDirection("asc", "updated_at")).toBe("asc");
  });

  it("normalizeDateParam は YYYY-MM-DD のみ通す", () => {
    expect(normalizeDateParam("2026-08-24")).toBe("2026-08-24");
    expect(normalizeDateParam(" 2026-08-24 ")).toBe("2026-08-24");
    expect(normalizeDateParam("2026/08/24")).toBeUndefined();
    expect(normalizeDateParam("2026-08")).toBeUndefined();
    expect(normalizeDateParam(undefined)).toBeUndefined();
  });
});

describe("コール一覧 — 次回対応の算出", () => {
  // 2026/08/24 12:00 を「現在」とする固定基準（Date.now() には依存させない）。
  const NOW = new Date("2026-08-24T12:00:00.000Z").getTime();
  const at = (iso: string) => new Date(iso).toISOString();

  /** 全て未設定・日時なしの素の入力。テストごとに必要な部分だけ上書きする。 */
  function source(over: Partial<NextTaskSource> = {}): NextTaskSource {
    const blank = { status: null, preferredAt: null, note: null };
    return {
      maekaku: blank,
      thankYouCall: blank,
      loanCompletionCall: blank,
      postCompletionCall: blank,
      nextAppointmentAt: null,
      ...over,
    };
  }

  it("未完了 = 未設定 / マエカク未実施 / 実施前。実施済・不要は候補外", () => {
    expect(isOpenCallStatus(null)).toBe(true);
    expect(isOpenCallStatus("pending")).toBe(true);
    expect(isOpenCallStatus("not_done")).toBe(true);
    expect(isOpenCallStatus("done")).toBe(false);
    expect(isOpenCallStatus("unnecessary")).toBe(false);
  });

  it("候補が無ければ null（一覧では未設定表示に落とす）", () => {
    expect(computeNextTask(source(), NOW)).toBeNull();
  });

  it("未来の候補が複数あれば最も近いものを選ぶ", () => {
    const task = computeNextTask(
      source({
        maekaku: { status: "pending", preferredAt: at("2026-08-27T10:00:00Z"), note: null },
        loanCompletionCall: {
          status: "not_done",
          preferredAt: at("2026-08-25T15:00:00Z"),
          note: null,
        },
        nextAppointmentAt: at("2026-08-26T13:00:00Z"),
      }),
      NOW,
    );
    expect(task).toEqual({
      kind: "loan_completion",
      at: at("2026-08-25T15:00:00Z"),
      overdue: false,
    });
  });

  it("実施済・不要のコールは希望日時があっても候補にしない", () => {
    const task = computeNextTask(
      source({
        // より近いが done なので無視される。
        thankYouCall: { status: "done", preferredAt: at("2026-08-25T09:00:00Z"), note: null },
        postCompletionCall: {
          status: "unnecessary",
          preferredAt: at("2026-08-25T10:00:00Z"),
          note: null,
        },
        maekaku: { status: "pending", preferredAt: at("2026-08-28T10:00:00Z"), note: null },
      }),
      NOW,
    );
    expect(task?.kind).toBe("maekaku");
  });

  it("次回アポイントはステータスを持たないので日時があれば常に候補", () => {
    const task = computeNextTask(source({ nextAppointmentAt: at("2026-08-26T13:00:00Z") }), NOW);
    expect(task).toEqual({
      kind: "next_appointment",
      at: at("2026-08-26T13:00:00Z"),
      overdue: false,
    });
  });

  it("未来が無ければ最も直近の過去を期限超過として返す", () => {
    const task = computeNextTask(
      source({
        maekaku: { status: "pending", preferredAt: at("2026-08-01T10:00:00Z"), note: null },
        thankYouCall: { status: "not_done", preferredAt: at("2026-08-20T10:00:00Z"), note: null },
      }),
      NOW,
    );
    // 8/01 ではなく現在に一番近い 8/20 を出す。
    expect(task).toEqual({ kind: "thank_you", at: at("2026-08-20T10:00:00Z"), overdue: true });
  });

  it("未来が 1 件でもあれば過去より優先し overdue にはしない", () => {
    const task = computeNextTask(
      source({
        maekaku: { status: "pending", preferredAt: at("2026-08-20T10:00:00Z"), note: null },
        nextAppointmentAt: at("2026-09-30T10:00:00Z"),
      }),
      NOW,
    );
    expect(task).toEqual({
      kind: "next_appointment",
      at: at("2026-09-30T10:00:00Z"),
      overdue: false,
    });
  });

  it("現在時刻ちょうどは未来側（期限超過にしない）", () => {
    const task = computeNextTask(source({ nextAppointmentAt: new Date(NOW).toISOString() }), NOW);
    expect(task?.overdue).toBe(false);
  });

  it("同時刻の候補は NEXT_TASK_KIND_VALUES の順で先勝ち", () => {
    const same = at("2026-08-25T09:00:00Z");
    const task = computeNextTask(
      source({
        thankYouCall: { status: "not_done", preferredAt: same, note: null },
        postCompletionCall: { status: "not_done", preferredAt: same, note: null },
        nextAppointmentAt: same,
      }),
      NOW,
    );
    expect(task?.kind).toBe("thank_you");
  });

  it("ステータスが未完了でも希望日時が無ければ候補にならない", () => {
    const task = computeNextTask(
      source({ maekaku: { status: "pending", preferredAt: null, note: "在宅は夜間" } }),
      NOW,
    );
    expect(task).toBeNull();
  });
});

describe("コール一覧 — バッジ配色", () => {
  it("実施済=success / 未実施=warning / 不要=secondary（既存 variant のみ）", () => {
    expect(callStatusVariant("done")).toBe("success");
    expect(callStatusVariant("not_done")).toBe("warning");
    expect(callStatusVariant("pending")).toBe("warning");
    expect(callStatusVariant("unnecessary")).toBe("secondary");
    expect(callStatusVariant("unknown")).toBe("secondary");
  });
});
