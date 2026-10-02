// シフトの時間帯重複判定（純関数）。
//
// これまで判定は代理店側の Server Action にインラインで 2 か所書かれていて、
// パートナー側の配置画面からは使えなかった。候補の除外・保存時の検証・テストで
// 同じ規則を使うため、ここに切り出す。
//
// 規則:
//   - 区間は半開区間 [start, end)。「前の催事が 18:00 終了・次が 18:00 開始」は重複としない。
//   - 判定はスタッフ（userId）単位。催事や依頼元代理店では分けない —
//     別の代理店の催事に入っていても、その人はその時間に動けないため。
//   - 複数日の催事は「開催日ごと」のシフト行になるので、初日だけ重なる場合も
//     その日のシフト同士でだけ衝突する（開催期間まるごとを 1 区間にしない）。
//   - 編集中の自分自身の行は相手にしない（ignoreShiftId）。
//
// DB 側にも同じ規則の EXCLUDE 制約（EventShift_user_no_overlap）を張っている。
// こちらは「候補から外す」「保存前に分かりやすいエラーにする」ためのもので、
// 同時操作に対する最終的な保証は DB 制約が担う。

/** 判定に必要な最小の形。DB 行でもフォーム入力でも同じ形に詰めて渡す。 */
export interface ShiftInterval {
  /** 既存行の id。新規なら undefined。 */
  id?: string;
  userId: string;
  start: Date;
  end: Date;
}

/** 半開区間 [aStart, aEnd) と [bStart, bEnd) が重なるか。 */
export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

/** 開始が終了より前か（等しいものは不正）。 */
export function isValidInterval(start: Date, end: Date): boolean {
  return start.getTime() < end.getTime();
}

export interface ConflictCheckInput {
  /** これから入れたい / 直したい区間。 */
  candidate: ShiftInterval;
  /** 比較対象（同じスタッフの既存シフト。呼び出し側で userId を絞っておく必要はない）。 */
  existing: readonly ShiftInterval[];
  /** 編集中の行。自分自身は重複相手にしない。 */
  ignoreShiftId?: string;
}

/** 重複している既存シフトを返す（無ければ空配列）。 */
export function findShiftConflicts(input: ConflictCheckInput): ShiftInterval[] {
  const { candidate, existing, ignoreShiftId } = input;
  return existing.filter((row) => {
    if (row.userId !== candidate.userId) return false;
    if (ignoreShiftId && row.id === ignoreShiftId) return false;
    // candidate 自身が既存行として渡ってきた場合も除く。
    if (candidate.id && row.id === candidate.id) return false;
    return intervalsOverlap(candidate.start, candidate.end, row.start, row.end);
  });
}

/**
 * まとめて配置するときの検証。
 *
 * 既存シフトとの重複だけでなく、同じ操作の中で作る区間同士の重複も見る
 * （同じスタッフを同時刻の 2 催事へ一括で入れようとした場合）。
 * 返り値は重複が見つかった候補の添字と、その相手。
 */
export function findBulkShiftConflicts(
  candidates: readonly ShiftInterval[],
  existing: readonly ShiftInterval[],
  ignoreShiftIds: readonly string[] = [],
): { index: number; candidate: ShiftInterval; conflict: ShiftInterval }[] {
  const out: { index: number; candidate: ShiftInterval; conflict: ShiftInterval }[] = [];
  const ignore = new Set(ignoreShiftIds);
  const accepted: ShiftInterval[] = [];

  candidates.forEach((candidate, index) => {
    const pool = [...existing.filter((e) => !e.id || !ignore.has(e.id)), ...accepted];
    const conflicts = findShiftConflicts({ candidate, existing: pool });
    const first = conflicts[0];
    if (first) out.push({ index, candidate, conflict: first });
    else accepted.push(candidate);
  });

  return out;
}
