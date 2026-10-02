// 成約フォーム（Google フォーム置き換え）の入力スキーマ。
//
// 9 項目はすべて必須。画面の required だけでは守れない規則（Server Action へ
// 直接送られたとき）をここで担保する。

import { describe, expect, it } from "vitest";

import {
  DealerContractReportCreateSchema,
  DealerContractReportUpdateSchema,
} from "../src/schemas/dealer-contract-report.js";

const FIELDS = [
  "contractDate",
  "tossDate",
  "tossDept",
  "apptGetter",
  "salesRep",
  "referralBranch",
  "affiliation",
  "affiliationDept",
  "acquisitionChannel",
] as const;

function base(overrides: Record<string, unknown> = {}) {
  return {
    contractDate: "2026-04-10",
    tossDate: "2026-04-01",
    tossDept: "第一営業部",
    apptGetter: "佐々木 孝",
    salesRep: "鳥居 佑馬",
    referralBranch: "さいたま拠点",
    affiliation: "VE",
    affiliationDept: "住設事業部",
    acquisitionChannel: "TELE_APPOINTMENT",
    ...overrides,
  };
}

function issuePaths(input: unknown): string[] {
  const r = DealerContractReportCreateSchema.safeParse(input);
  if (r.success) return [];
  return r.error.issues.map((i) => String(i.path[0]));
}

describe("成約 — 必須項目", () => {
  it("9 項目が揃っていれば通る", () => {
    expect(DealerContractReportCreateSchema.safeParse(base()).success).toBe(true);
  });

  it.each(FIELDS)("%s が無ければ弾く", (key) => {
    const input = base();
    delete (input as Record<string, unknown>)[key];
    expect(issuePaths(input)).toContain(key);
  });

  it("空文字も未入力として弾く", () => {
    expect(issuePaths(base({ tossDept: "   " }))).toContain("tossDept");
    expect(issuePaths(base({ contractDate: "" }))).toContain("contractDate");
  });
});

describe("成約 — 値域", () => {
  it("所属は VE / PS の 2 択", () => {
    expect(issuePaths(base({ affiliation: "VE" }))).toEqual([]);
    expect(issuePaths(base({ affiliation: "PS" }))).toEqual([]);
    expect(issuePaths(base({ affiliation: "OTHER" }))).toContain("affiliation");
  });

  it("アポ獲得時チャネルは 5 択（テレアポを含み「その他」は無い）", () => {
    for (const v of ["VISIT_SALES", "TELE_APPOINTMENT", "REFERRAL", "EVENT", "INBOUND"]) {
      expect(issuePaths(base({ acquisitionChannel: v }))).toEqual([]);
    }
    expect(issuePaths(base({ acquisitionChannel: "OTHER" }))).toContain("acquisitionChannel");
  });

  it("日付は不正値を弾く", () => {
    expect(issuePaths(base({ tossDate: "not-a-date" }))).toContain("tossDate");
  });

  it("日付は Date へ正規化される", () => {
    const r = DealerContractReportCreateSchema.safeParse(base());
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.contractDate).toBeInstanceOf(Date);
      expect(r.data.contractDate.toISOString().slice(0, 10)).toBe("2026-04-10");
    }
  });
});

describe("成約 — 所属情報", () => {
  // 1 つのパートナー会社が複数の代理店から依頼を受けるため、依頼先代理店
  // （relationshipId）だけはフォームから受け取る。ただし値の正当性はサーバー側
  // （resolveRelationship）が自社の取引関係の集合に照らして必ず検証する。
  // 代理店テナント id と登録者は引き続き受け取らない。
  it("依頼先代理店は受け取るが、代理店テナント id と登録者は受け取らない", () => {
    const r = DealerContractReportCreateSchema.safeParse(
      base({ relationshipId: "rel-other", wholesalerId: "w-other", createdByUserId: "u-other" }),
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.relationshipId).toBe("rel-other");
      expect(r.data).not.toHaveProperty("wholesalerId");
      expect(r.data).not.toHaveProperty("createdByUserId");
    }
  });

  it("依頼先代理店は省略できる（取引先が 1 社なら画面で選ばせない）", () => {
    const r = DealerContractReportCreateSchema.safeParse(base());
    expect(r.success).toBe(true);
    expect(r.success && r.data.relationshipId).toBeUndefined();
  });

  it("更新スキーマは id を要求する", () => {
    expect(DealerContractReportUpdateSchema.safeParse(base()).success).toBe(false);
    expect(DealerContractReportUpdateSchema.safeParse({ ...base(), id: "k-1" }).success).toBe(true);
  });
});
