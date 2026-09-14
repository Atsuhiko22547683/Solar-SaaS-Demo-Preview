// 二次店アポイント登録の入力検証
// （Google フォーム「住設事業部/加盟店-①初訪アポフォーム」準拠）。

import { describe, expect, it } from "vitest";

import {
  fromFaceToFaceBoolean,
  PartnerAppointmentCreateSchema,
  toFaceToFaceBoolean,
} from "../src/schemas/partner-appointment.js";

const BASE = { name: "佐藤 太郎", mobilePhone: "09012345678" };

describe("電話番号", () => {
  it("携帯だけでも通る", () => {
    expect(PartnerAppointmentCreateSchema.safeParse(BASE).success).toBe(true);
  });

  it("固定電話だけでも通る", () => {
    expect(
      PartnerAppointmentCreateSchema.safeParse({ name: "佐藤 太郎", landlinePhone: "0312345678" })
        .success,
    ).toBe(true);
  });

  it("どちらも無ければ弾く", () => {
    const r = PartnerAppointmentCreateSchema.safeParse({ name: "佐藤 太郎" });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    // 両方の欄にエラーを出して、どちらを埋めればよいか分かるようにする。
    expect(paths).toContain("mobilePhone");
    expect(paths).toContain("landlinePhone");
  });

  it("空文字は未入力として扱う", () => {
    expect(
      PartnerAppointmentCreateSchema.safeParse({
        name: "佐藤 太郎",
        mobilePhone: "",
        landlinePhone: "",
      }).success,
    ).toBe(false);
  });
});

describe("お客様名", () => {
  it("必須", () => {
    expect(PartnerAppointmentCreateSchema.safeParse({ ...BASE, name: "" }).success).toBe(false);
    expect(PartnerAppointmentCreateSchema.safeParse({ ...BASE, name: "   " }).success).toBe(false);
  });
});

describe("マエカク実施者", () => {
  it("自由記述として保持する（前後の空白は落とす）", () => {
    const parsed = PartnerAppointmentCreateSchema.parse({
      ...BASE,
      maekakuOperator: "  コール班 鈴木  ",
    });
    expect(parsed.maekakuOperator).toBe("コール班 鈴木");
  });

  it("未入力は undefined", () => {
    expect(PartnerAppointmentCreateSchema.parse(BASE).maekakuOperator).toBeUndefined();
  });
});

describe("対面者区分", () => {
  it("Customer.faceToFace の 3 状態と往復できる", () => {
    expect(toFaceToFaceBoolean("SOVEREIGN")).toBe(true);
    expect(toFaceToFaceBoolean("NON_SOVEREIGN")).toBe(false);
    expect(toFaceToFaceBoolean(undefined)).toBeNull();

    expect(fromFaceToFaceBoolean(true)).toBe("SOVEREIGN");
    expect(fromFaceToFaceBoolean(false)).toBe("NON_SOVEREIGN");
    expect(fromFaceToFaceBoolean(null)).toBeUndefined();
  });
});

describe("所属情報", () => {
  it("スキーマに所属系の項目が無い（クライアントから受け取らない）", () => {
    const parsed = PartnerAppointmentCreateSchema.parse({
      ...BASE,
      // 送られてきても取り込まれないこと。
      ...({ relationshipId: "rel_other", wholesalerId: "ws_other" } as Record<string, unknown>),
    }) as Record<string, unknown>;
    expect(parsed.relationshipId).toBeUndefined();
    expect(parsed.wholesalerId).toBeUndefined();
  });
});
