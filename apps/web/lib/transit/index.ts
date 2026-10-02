// 公共交通機関の経路・所要時間の取得（駅すぱあと連携の受け口）。
//
// 現状: **未接続**。
//   この repo には駅すぱあとの API キー・契約・エンドポイント設定が存在しない
//   （.env.example にも該当の変数は無い）。接続情報が揃うまでは、この層は常に
//   status: "unavailable" を返す。
//
// 守っていること:
//   - 直線距離や推定値を「公共交通機関の検索結果」として返さない。
//     所要時間・運賃・経路は、実連携が入るまで一切表示しない。
//   - 画面には「経路情報は未取得（未接続）」と出す。空欄や 0 分にはしない。
//   - 接続できるようになったら fetchTransitRoute の中身だけを差し替えればよい形にする。
//     呼び出し側（配置画面）はこのインターフェースだけを見ている。
//
// 残っている接続作業（実連携に必要なもの）:
//   1. 駅すぱあと Web サービスの契約とアクセスキーの取得
//   2. 環境変数 EKISPERT_API_KEY（および必要ならエンドポイント）の設定
//   3. 公式仕様（search/course/extreme 等）に合わせたリクエスト組み立てと応答の写し取り
//   4. 住所 → 最寄り駅の解決方法の決定（駅すぱあと側の機能を使うか、別の手段か）
//   5. 呼び出し回数・キャッシュ方針（配置画面はスタッフ数 × 催事数ぶん引く可能性がある）

import "server-only";

/** 出発地・目的地。住所の自由記述で受ける（最寄り駅の解決は連携側の責務）。 */
export interface TransitQuery {
  /** 出発地点。スタッフの自宅住所。 */
  from: string;
  /** 目的地。催事の開催場所。 */
  to: string;
  /** 到着希望時刻（開催開始）。 */
  arriveBy?: Date;
}

export type TransitResult =
  | {
      status: "ok";
      /** 所要時間（分）。実連携の検索結果のみ。 */
      minutes: number;
      /** 運賃（円）。 */
      fare: number | null;
      /** 乗換回数。 */
      transfers: number | null;
      /** 取得元（表示用）。 */
      source: string;
    }
  | {
      status: "unavailable";
      /** 未取得の理由。画面にそのまま出せる日本語。 */
      reason: string;
    };

/** 連携が設定されているか。環境変数の有無だけで判定する。 */
export function isTransitConfigured(): boolean {
  return Boolean(process.env.EKISPERT_API_KEY?.trim());
}

/**
 * 経路を引く。未接続の間は必ず unavailable を返す。
 *
 * 推定値・直線距離は返さない。デモ用の仮データを使う場合も、この関数からは返さず
 * 画面側で「仮データ」と明示すること。
 */
export async function fetchTransitRoute(_query: TransitQuery): Promise<TransitResult> {
  if (!isTransitConfigured()) {
    return {
      status: "unavailable",
      reason: "経路情報は未取得です（駅すぱあと未接続）",
    };
  }

  // 接続情報が入ったらここで駅すぱあと Web サービスを呼ぶ。
  // 公式仕様を確認したうえで実装する。仕様未確認のまま推測で組み立てない。
  return {
    status: "unavailable",
    reason: "経路情報は未取得です（連携が未実装）",
  };
}
