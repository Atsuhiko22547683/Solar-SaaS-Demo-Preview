// ローカル確認用 DB に入っている「デモ・検証データ」の由来判定。
//
// 最小デモの整備（seed-demo-minimal.ts）と E2E の後片付け（tests/e2e/global-teardown.ts）
// が同じ表を見るように、判定はここ 1 か所に置く。
//
// 方針:
//   - id の接頭辞だけで消さない。名前の目印と、作られ方（乱数つきの名前か）も見る。
//   - どれとも言えない行は "unknown" にして、呼び出し側が消さずに件数だけ報告する。

/** 最小デモ本体。整備で作る行はすべてこの接頭辞を持つ。消してはいけない。 */
export const MINIMAL_PREFIX = "dmin_";

/** 旧デモシードの id 接頭辞。 */
const OLD_DEMO_ID_PREFIXES = ["demo1_", "bizflow_"];

/** 検証用フィクスチャの id 接頭辞。 */
const VERIFY_ID_PREFIXES = ["s1_"];

/** 名前に付く目印（旧デモ）。 */
const OLD_DEMO_NAME_MARKERS = ["[DEMO]", "[BIZ]"];

/** 名前に付く目印（検証用フィクスチャ）。 */
const VERIFY_NAME_MARKERS = ["[VERIFY]", "[S2]", "[確認用]"];

/**
 * Playwright の spec / fixture が作る名前。
 *
 * spec 側は `unique("L1")` のように「接頭辞 + 実行ごとの base36」を付けるので、
 * 接頭辞の一覧と「末尾が乱数」の形の両方で拾う。
 */
const E2E_NAME_PREFIXES = [
  "[E2E",
  "L1-",
  "L2-",
  "L3-",
  "L4-",
  "L5-",
  "L6-",
  "L7-",
  "L8-",
  "D-",
  "D2-",
  "RS-",
  "F他社-",
  "IH-TEST-",
  "IH-TOGGLE-",
  "テスト会場-",
  "他社会場-",
  "管理者会場-",
  "スタッフ会場-",
  "直接入力会場-",
  "テスト顧客-",
  "スタッフ顧客-",
  "催事テスト顧客-",
  "他社顧客-",
  "携帯必須テスト-",
  "テスト電機-",
  "テスト卸業者 ",
  "テスト店舗",
  "テスト会場",
  "検証店舗",
  "検証ホームセンター",
  "クローズ課-",
  "スタッフクローズ課-",
  "管理者クローズ課-",
  "他社クローズ課-",
  "取次拠点-",
  "スタッフ拠点-",
  "管理者拠点-",
  "他社拠点-",
  "次回アクション-",
];

/** 末尾が実行ごとの乱数（base36 7〜12 桁）に見えるか。 */
const RANDOM_SUFFIX = /-[0-9a-z]{7,12}$/;

export type DataOrigin = "minimal" | "old-demo" | "verify" | "e2e" | "base-seed" | "unknown";

export interface OriginInput {
  id?: string | null;
  /** 画面に出る名前（店舗名・顧客名・会場名など）。 */
  name?: string | null;
  /** 基本シード seed.ts が最初に作った行かどうかの補助判定に使う。 */
  createdAt?: Date | null;
}

/**
 * 基本シード seed.ts が作る業務デモ行の id 接頭辞。
 *
 * 最初の seed 実行で一度に作られたため cuid の時刻ブロックが共通している。
 * これは補助的な手がかりで、単独では使わない（名前の形と併せて判定する）。
 */
const BASE_SEED_ID_BLOCK = "cmsft65";

/** 「姓 名」だけの日本語名（基本シードのサンプル顧客・販売員の形）。 */
const PLAIN_JP_PERSON = /^[一-龥゠-ヿ]{1,5}[ \u3000][一-龥゠-ヿ]{1,5}$/;

export function classifyOrigin(input: OriginInput): DataOrigin {
  const id = input.id ?? "";
  const name = input.name ?? "";

  if (
    id.startsWith(MINIMAL_PREFIX) ||
    name.startsWith("【デモA】") ||
    name.startsWith("【デモB】")
  ) {
    return "minimal";
  }
  if (OLD_DEMO_ID_PREFIXES.some((p) => id.startsWith(p))) return "old-demo";
  if (OLD_DEMO_NAME_MARKERS.some((m) => name.includes(m))) return "old-demo";
  if (VERIFY_ID_PREFIXES.some((p) => id.startsWith(p))) return "verify";
  if (VERIFY_NAME_MARKERS.some((m) => name.includes(m))) return "verify";
  if (E2E_NAME_PREFIXES.some((p) => name.startsWith(p))) return "e2e";
  // 乱数つきの名前。空名や純粋な日本語人名は対象にしない。
  if (name.length > 0 && RANDOM_SUFFIX.test(name)) return "e2e";
  if (id.startsWith(BASE_SEED_ID_BLOCK) && (PLAIN_JP_PERSON.test(name) || name.length === 0)) {
    return "base-seed";
  }
  return "unknown";
}

/** 整備で消してよい由来（最小デモと由来不明は消さない）。 */
export const PURGEABLE: DataOrigin[] = ["old-demo", "verify", "e2e", "base-seed"];

/** E2E の後片付けで消す由来（シードが作る行は残す＝次の実行で作り直さない）。 */
export const E2E_PURGEABLE: DataOrigin[] = ["e2e"];

export function isPurgeable(input: OriginInput, allowed: DataOrigin[] = PURGEABLE): boolean {
  return allowed.includes(classifyOrigin(input));
}
