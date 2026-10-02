// 二次店ポータルのアポイント入力スキーマ。
//
// Google フォーム 2 種の必須・条件付き・値域を表として固定する。画面の required
// だけでは守れない規則（Server Action へ直接送られたとき）をここで担保する。

import { describe, expect, it } from "vitest";

import {
  PartnerFirstVisitCreateSchema,
  PartnerFirstVisitUpdateSchema,
  PartnerVisitCreateSchema,
} from "../src/schemas/partner-appointment.js";

/** 初訪アポの最小の有効入力（販売チャネル = 催事）。 */
function firstVisitBase(overrides: Record<string, unknown> = {}) {
  return {
    closingRelationshipId: "rel-1",
    closingSalespersonId: "sp-1",
    salesChannel: "EVENT",
    eventDate: "2026-04-01",
    venuePlace: "カインズ 浦和美園店",
    venueChain: "CAINZ",
    boothArea: "ENTRANCE",
    name: "山田 太郎",
    kana: "ヤマダ タロウ",
    mobilePhone: "09012345678",
    postalCode: "330-0001",
    prefecture: "埼玉県",
    cityAddress: "さいたま市浦和区1-2-3",
    maekakuOperator: "コール班 鈴木",
    firstVisitAt: "2026-04-05T10:00",
    ...overrides,
  };
}

function issuePaths(input: unknown, schema = PartnerFirstVisitCreateSchema): string[] {
  const r = schema.safeParse(input);
  if (r.success) return [];
  return r.error.issues.map((i) => String(i.path[0]));
}

/** ある項目に付いたメッセージ。画面は項目の近くにこれを出す。 */
function messageFor(
  input: unknown,
  field: string,
  schema = PartnerFirstVisitCreateSchema,
): string | null {
  const r = schema.safeParse(input);
  if (r.success) return null;
  return r.error.issues.find((i) => String(i.path[0]) === field)?.message ?? null;
}

describe("初訪アポ — 必須項目", () => {
  it("すべて揃っていれば通る", () => {
    expect(PartnerFirstVisitCreateSchema.safeParse(firstVisitBase()).success).toBe(true);
  });

  it.each([
    "closingRelationshipId",
    "closingSalespersonId",
    "salesChannel",
    "eventDate",
    "venuePlace",
    "boothArea",
    "name",
    "kana",
    "mobilePhone",
    "postalCode",
    "prefecture",
    "cityAddress",
    "maekakuOperator",
    "firstVisitAt",
  ])("%s が無ければ弾く", (key) => {
    const input = firstVisitBase();
    delete (input as Record<string, unknown>)[key];
    expect(issuePaths(input)).toContain(key);
  });

  it("トス獲得者・固定電話番号・備考は任意", () => {
    const r = PartnerFirstVisitCreateSchema.safeParse(firstVisitBase());
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.tossUpSalespersonId).toBeUndefined();
      expect(r.data.landlinePhone).toBeUndefined();
      expect(r.data.note).toBeUndefined();
    }
  });
});

describe("初訪アポ — 携帯番号", () => {
  it("携帯番号そのものが必須（固定電話では代替できない）", () => {
    const input = firstVisitBase({ landlinePhone: "0312345678" });
    delete (input as Record<string, unknown>).mobilePhone;
    expect(issuePaths(input)).toContain("mobilePhone");
  });

  it("空文字も未入力として弾く", () => {
    expect(issuePaths(firstVisitBase({ mobilePhone: "" }))).toContain("mobilePhone");
  });

  it("数字以外が混ざれば弾く", () => {
    expect(issuePaths(firstVisitBase({ mobilePhone: "090-abcd-5678" }))).toContain("mobilePhone");
  });

  it("固定電話番号は任意だが、入力されれば形式を見る", () => {
    expect(issuePaths(firstVisitBase({ landlinePhone: "03-1234-5678" }))).toEqual([]);
    expect(issuePaths(firstVisitBase({ landlinePhone: "内線123" }))).toContain("landlinePhone");
  });
});

describe("初訪アポ — 条件付き項目", () => {
  it("販売チャネルが催事なら催事種別は必須", () => {
    const input = firstVisitBase();
    delete (input as Record<string, unknown>).venueChain;
    expect(issuePaths(input)).toContain("venueChain");
  });

  it("販売チャネルが催事以外なら催事種別は付けられない", () => {
    expect(issuePaths(firstVisitBase({ salesChannel: "INBOUND", venueChain: "CAINZ" }))).toContain(
      "venueChain",
    );
  });

  it("販売チャネルが訪問販売なら対面者は必須", () => {
    expect(
      issuePaths(firstVisitBase({ salesChannel: "VISIT_SALES", venueChain: undefined })),
    ).toContain("faceToFace");
  });

  it("販売チャネルが訪問販売以外なら対面者は付けられない", () => {
    expect(issuePaths(firstVisitBase({ faceToFace: "SOVEREIGN" }))).toContain("faceToFace");
  });

  it("訪問販売 + 対面者なら通る（催事種別は不要）", () => {
    const r = PartnerFirstVisitCreateSchema.safeParse(
      firstVisitBase({
        salesChannel: "VISIT_SALES",
        venueChain: undefined,
        faceToFace: "SOVEREIGN",
      }),
    );
    expect(r.success).toBe(true);
  });
});

describe("初訪アポ — 値域", () => {
  it("催事種別はカインズ / 島忠 / コメリ の 3 択（日報の W / V は使わない）", () => {
    expect(issuePaths(firstVisitBase({ venueChain: "CAINZ_W" }))).toContain("venueChain");
    for (const v of ["CAINZ", "SHIMACHU", "KOMERI"]) {
      expect(issuePaths(firstVisitBase({ venueChain: v }))).toEqual([]);
    }
  });

  it("催事ブース場所は 3 択", () => {
    expect(issuePaths(firstVisitBase({ boothArea: "ROOFTOP" }))).toContain("boothArea");
  });

  // 画面の select は未選択のとき "" を送る。英文の既定メッセージ
  // （Invalid enum value. Expected …）ではなく、項目別の日本語を返すこと。
  it.each([
    ["未選択（空文字）", ""],
    ["未指定（undefined）", undefined],
    ["値域外", "ROOFTOP"],
  ])("催事ブース場所 %s は「ブース場所を選択してください」を返す", (_label, value) => {
    const input = firstVisitBase({ boothArea: value });
    expect(issuePaths(input)).toContain("boothArea");
    expect(messageFor(input, "boothArea")).toBe("ブース場所を選択してください");
  });

  it("正しく選べばブース場所の指摘は出ない", () => {
    for (const v of ["ENTRANCE", "REFORM_CORNER"]) {
      expect(issuePaths(firstVisitBase({ boothArea: v }))).toEqual([]);
    }
    // OTHER は自由記述と合わせて有効。
    expect(issuePaths(firstVisitBase({ boothArea: "OTHER" }))).toEqual([]);
  });

  it("販売チャネルの未選択（空文字）も項目別の日本語を返す", () => {
    const input = firstVisitBase({ salesChannel: "", venueChain: undefined });
    expect(messageFor(input, "salesChannel")).toBe("販売チャネルを選択してください");
  });

  it("どの指摘も英文の既定メッセージを返さない", () => {
    const r = PartnerFirstVisitCreateSchema.safeParse(
      firstVisitBase({ boothArea: "", salesChannel: "" }),
    );
    expect(r.success).toBe(false);
    if (r.success) return;
    for (const issue of r.error.issues) {
      expect(issue.message).not.toMatch(/Invalid enum value|Expected '/);
    }
  });

  it("販売チャネルは 5 択", () => {
    expect(issuePaths(firstVisitBase({ salesChannel: "TELE_APPOINTMENT" }))).toContain(
      "salesChannel",
    );
  });

  it("ブース場所の自由記述は「その他」のときだけ", () => {
    expect(issuePaths(firstVisitBase({ boothAreaNote: "2階催事スペース" }))).toContain(
      "boothAreaNote",
    );
    expect(
      issuePaths(firstVisitBase({ boothArea: "OTHER", boothAreaNote: "2階催事スペース" })),
    ).toEqual([]);
  });

  it("日付・日時は不正値を弾く", () => {
    expect(issuePaths(firstVisitBase({ eventDate: "not-a-date" }))).toContain("eventDate");
    expect(issuePaths(firstVisitBase({ firstVisitAt: "" }))).toContain("firstVisitAt");
  });
});

describe("初訪アポ — 所属情報", () => {
  // 依頼先代理店（relationshipId）は、複数の代理店から依頼を受ける構成のために
  // フォームから受け取る。サーバー側で自社の取引関係かを必ず検証する。
  // 加盟店番号と代理店テナント id は引き続き受け取らない。
  it("依頼先代理店は受け取るが、加盟店番号と代理店テナント id は受け取らない", () => {
    const r = PartnerFirstVisitCreateSchema.safeParse(
      firstVisitBase({
        franchiseNo: "ERP99",
        relationshipId: "rel-other",
        wholesalerId: "w-other",
      }),
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).not.toHaveProperty("franchiseNo");
      expect(r.data.relationshipId).toBe("rel-other");
      expect(r.data).not.toHaveProperty("wholesalerId");
    }
  });

  it("催事からの登録では催事 id と開催日 id を受け取る", () => {
    const r = PartnerFirstVisitCreateSchema.safeParse(
      firstVisitBase({ eventId: "evt-1", eventDayId: "day-1" }),
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.eventId).toBe("evt-1");
      expect(r.data.eventDayId).toBe("day-1");
    }
  });

  it("トス部署は初訪アポフォームに無いので受け取らない", () => {
    const r = PartnerFirstVisitCreateSchema.safeParse(firstVisitBase({ tossDept: "第一営業部" }));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).not.toHaveProperty("tossDept");
  });

  it("更新スキーマは id を要求する", () => {
    expect(PartnerFirstVisitUpdateSchema.safeParse(firstVisitBase()).success).toBe(false);
    expect(
      PartnerFirstVisitUpdateSchema.safeParse({ ...firstVisitBase(), id: "c-1" }).success,
    ).toBe(true);
  });
});

describe("訪問アポ — 5 項目", () => {
  const base = {
    tossDept: "第一営業部",
    maekakuOperator: "コール班 鈴木",
    closeDept: "クローズ第二課",
    salespersonId: "sp-1",
    salesChannel: "VISIT_SALES",
  };

  it("5 項目が揃っていれば通る", () => {
    expect(PartnerVisitCreateSchema.safeParse(base).success).toBe(true);
  });

  it.each(["tossDept", "maekakuOperator", "closeDept", "salespersonId", "salesChannel"])(
    "%s が無ければ弾く",
    (key) => {
      const input = { ...base };
      delete (input as Record<string, unknown>)[key];
      expect(issuePaths(input, PartnerVisitCreateSchema)).toContain(key);
    },
  );

  it("販売チャネルの値域は初訪アポと同じ 5 択", () => {
    expect(
      issuePaths({ ...base, salesChannel: "TELE_APPOINTMENT" }, PartnerVisitCreateSchema),
    ).toContain("salesChannel");
  });

  it("フォームに無い顧客情報は受け取らない", () => {
    const r = PartnerVisitCreateSchema.safeParse({ ...base, name: "山田 太郎", firstVisitAt: "x" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).not.toHaveProperty("name");
      expect(r.data).not.toHaveProperty("firstVisitAt");
    }
  });
});
