// 成果報告（日報）のデータ型 + デモ用の決定論的生成器。
//
// Google フォーム「ES_日報」の項目に準拠。レーン/単発イベント共通で利用する。
// 本番の永続データ連携は今後の課題で、現状はイベント/日付をシードにした
// 決定論的なデモ値を生成する（同じイベント・日付では常に同じ内容になる）。
//
// 純粋な TS モジュール（"use client" なし）なので、Server Component からも
// Client Component からも import できる。

export type ResultReportCategory = "housing" | "realestate";
export type ResultReportChannel = "cainzW" | "cainzV" | "shimachu";

export interface ResultReportData {
  eventDate: string; // 催事実施日 (YYYY-MM-DD)
  franchiseNo: string; // 加盟店番号 (例: ERP12)
  category: ResultReportCategory; // 種別（住宅設備 / 不動産）
  venuePlace: string; // 催事場所（県 + 店舗）
  areaInFacility: string; // 施設内エリア
  startTime: string; // 稼働開始 (HH:MM)
  endTime: string; // 稼働終了 (HH:MM)
  lotteryTotal: number; // 抽選数
  lotteryBoth: number; // 抽選内訳_両面
  lotterySingle: number; // 抽選内訳_片面
  seatedTotal: number; // 着座数
  seatedBoth: number; // 着座内訳_両面
  seatedSingle: number; // 着座内訳_片面
  apptTotal: number; // アポ数
  apptBoth: number; // アポ内訳_両面
  apptSingle: number; // アポ内訳_片面
  salesChannel: ResultReportChannel; // 種別（販売チャネル）
  impression: string; // 所感
}

export interface ResultReportContext {
  date?: string | null; // 催事実施日（YYYY-MM-DD）
  venuePlace?: string | null; // 催事場所（県 + 店舗）
  channel?: ResultReportChannel; // 販売チャネル
}

// 文字列シード → 32bit ハッシュ → mulberry32 PRNG（決定論的）。
function makeRng(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AREAS = [
  "1階エレベーター前",
  "正面入口横",
  "2階催事スペース",
  "レジ前特設ブース",
  "屋外駐車場テント",
  "フードコート横",
];

const PLACES = [
  "群馬県 前橋みなみモール店",
  "埼玉県 浦和美園店",
  "千葉県 幕張店",
  "神奈川県 横浜瀬谷店",
  "東京都 テックランド町田店",
  "栃木県 宇都宮インターパーク店",
  "茨城県 つくば研究学園店",
];

const IMPRESSIONS = [
  "天候に恵まれ来場者多数。蓄電池への関心が高く、好感触のアポを複数獲得。次回も同枠を希望。",
  "午前は客足が鈍かったが午後に挽回。電気代高騰の話題で足を止める方が多かった。",
  "ファミリー層に蓄電池＋V2H の提案が刺さった。単価の高い見込みを確保できた。",
  "高齢層中心。補助金説明への反応が良く、後日訪問のアポにつながった。",
  "オープン直後から問い合わせ多数。要員2名では捌ききれず、増員を検討したい。",
  "競合ブースと隣接し苦戦したが、シミュレーション提示で差別化できた。",
];

const CHANNELS: ResultReportChannel[] = ["cainzW", "cainzV", "shimachu"];

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// イベント/日付をシードにした決定論的なデモ成果報告を生成する。
export function buildDemoResultReport(
  seed: string,
  ctx: ResultReportContext = {},
): ResultReportData {
  const rng = makeRng(seed || "demo");
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)]!;
  const between = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  const split = (total: number, ratioMin: number, ratioMax: number): [number, number] => {
    const both = Math.round(total * (ratioMin + rng() * (ratioMax - ratioMin)));
    return [both, Math.max(0, total - both)];
  };

  const lotteryTotal = between(28, 96);
  const [lotteryBoth, lotterySingle] = split(lotteryTotal, 0.4, 0.65);
  const seatedTotal = Math.max(4, Math.round(lotteryTotal * (0.4 + rng() * 0.25)));
  const [seatedBoth, seatedSingle] = split(seatedTotal, 0.4, 0.65);
  const apptTotal = Math.max(2, Math.round(seatedTotal * (0.3 + rng() * 0.25)));
  const [apptBoth, apptSingle] = split(apptTotal, 0.4, 0.65);

  const startHour = pick(["09:30", "10:00", "10:00", "11:00"]);
  const endHour = pick(["17:00", "18:00", "18:00", "19:00"]);

  return {
    eventDate: ctx.date ?? todayStr(),
    franchiseNo: `ERP${String(between(1, 70)).padStart(2, "0")}`,
    category: rng() < 0.82 ? "housing" : "realestate",
    venuePlace: ctx.venuePlace ?? pick(PLACES),
    areaInFacility: pick(AREAS),
    startTime: startHour,
    endTime: endHour,
    lotteryTotal,
    lotteryBoth,
    lotterySingle,
    seatedTotal,
    seatedBoth,
    seatedSingle,
    apptTotal,
    apptBoth,
    apptSingle,
    salesChannel: ctx.channel ?? pick(CHANNELS),
    impression: pick(IMPRESSIONS),
  };
}
