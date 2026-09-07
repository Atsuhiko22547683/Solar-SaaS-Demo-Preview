// 顧客一覧の「次アクション」表示。
//
// 目的:
//   一覧を開いた人が最初に決めたいのは「この顧客に対していま何をするか」で、
//   契約状況そのものではない。契約状況・次回アポ・マエカク・施工・設置申請は
//   すべて既に行データに載っているが、横並びにすると重要度の差が消え、
//   結果として「DB 項目を並べただけ」の一覧になっていた。
//
// 位置づけ:
//   ここは **表示上の導出だけ** を行う純関数。サーバの絞り込み条件・enum・
//   API・保存されるデータの意味には一切触れない。判定に使うのは
//   CustomerListItem が既に持っているフィールドのみ。
//
// 表示の文法（全行で統一する）:
//   label  … 何をするか（動作の名前）
//   detail … いつ / 何が不足しているか
//   日付そのものを label にしない。「2026/08/06 17:11」だけが置かれると、
//   それが予定なのか期限なのか督促なのかが読み取れず、行ごとに意味の粒度が
//   変わってしまうため。
//
// 優先順位の根拠（催事営業の実務）:
//   契約前は「アポが埋まっているか」「マエカクが済んでいるか」で失注が決まる。
//   アポ未設定とマエカク未実施は放置すると獲得した見込みがそのまま消えるため、
//   urgency: "high" にして他の行から浮かせる。
//   契約後は工程が進むだけなので、担当が能動的に動く必要があるのは
//   「申請が未提出のまま完工している」ケースに絞られる。

import type { CustomerListItem } from "./constants";

/** 放置したときの損失で決まる強さ。high だけが色を持つ。 */
export type NextActionUrgency = "high" | "normal" | "none";

/**
 * どの工程のアクションか。色やアイコンではなく、
 * 呼び出し側がテストや条件分岐で参照するための識別子。
 */
export type NextActionType =
  | "appointment" // アポの設定 / 次回アポ
  | "maekaku" // 事前確認コール
  | "survey" // 現地調査
  | "construction" // 着工・施工
  | "subsidy" // 設置申請
  | "done" // 完了（やることなし）
  | "closed"; // 失注・キャンセル（以降の工程なし）

export interface NextAction {
  type: NextActionType;
  /** 何をするか。 */
  label: string;
  /** いつ / 何が不足しているか。空文字は「補足なし」。 */
  detail: string;
  urgency: NextActionUrgency;
}

export interface NextActionLabels {
  closed: string;
  appointmentSet: string;
  appointmentMissing: string;
  appointmentNext: string;
  maekaku: string;
  maekakuPending: string;
  survey: string;
  surveyPending: string;
  construction: string;
  constructionPending: string;
  constructionRunning: string;
  subsidySubmit: string;
  subsidyUnsubmitted: string;
  subsidyResult: string;
  subsidyInReview: string;
  completed: string;
  none: string;
}

type Row = Pick<
  CustomerListItem,
  "contractStatus" | "constructionStatus" | "subsidyStatus" | "maekaku" | "nextAppointmentAt"
>;

/**
 * 行の状態から次アクションを 1 つだけ選ぶ。
 * 複数該当する場合は「放置したときの損失が大きい順」に 1 つへ畳む
 * （一覧では 1 行 1 アクションでないと走査できないため）。
 * 優先順位は従来の導出ロジックのまま。変えたのは返却の形と表示文法だけ。
 */
export function resolveNextAction(
  row: Row,
  t: NextActionLabels,
  /** 次回アポの日時を一覧向けの短い表記へ整える。 */
  formatAppointment: (iso: string) => string,
): NextAction {
  // 失注・キャンセルは以降の工程が無いので、行動を促さない。
  if (row.contractStatus === "lost" || row.contractStatus === "cancelled") {
    return { type: "closed", label: t.closed, detail: "", urgency: "none" };
  }

  if (row.contractStatus === "contracted") {
    if (row.constructionStatus === "done") {
      // 完工しているのに申請が出ていないものだけが、担当の能動的な作業。
      if (row.subsidyStatus === "not_applied" || row.subsidyStatus === "preparing") {
        return {
          type: "subsidy",
          label: t.subsidySubmit,
          detail: t.subsidyUnsubmitted,
          urgency: "high",
        };
      }
      if (row.subsidyStatus === "applied" || row.subsidyStatus === "revising") {
        return {
          type: "subsidy",
          label: t.subsidyResult,
          detail: t.subsidyInReview,
          urgency: "normal",
        };
      }
      return { type: "done", label: t.completed, detail: "", urgency: "none" };
    }
    if (row.constructionStatus === "in_progress") {
      return {
        type: "construction",
        label: t.construction,
        detail: t.constructionRunning,
        urgency: "normal",
      };
    }
    if (row.constructionStatus === "surveyed") {
      return {
        type: "construction",
        label: t.construction,
        detail: t.constructionPending,
        urgency: "normal",
      };
    }
    return { type: "survey", label: t.survey, detail: t.surveyPending, urgency: "normal" };
  }

  // ここから契約前。
  // アポが入っていないのが最も損失が大きい（見込みが動かないまま滞留する）。
  if (!row.nextAppointmentAt) {
    return {
      type: "appointment",
      label: t.appointmentSet,
      detail: t.appointmentMissing,
      urgency: "high",
    };
  }
  // アポはあるがマエカク未実施 —— 当日の訪問が無駄になりうる。
  if (row.maekaku === "absent") {
    return { type: "maekaku", label: t.maekaku, detail: t.maekakuPending, urgency: "high" };
  }
  return {
    type: "appointment",
    label: t.appointmentNext,
    detail: formatAppointment(row.nextAppointmentAt),
    urgency: "normal",
  };
}
