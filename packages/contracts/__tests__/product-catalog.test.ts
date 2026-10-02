import { describe, expect, it } from "vitest";

import {
  CATALOG_CATEGORY_VALUES,
  CATALOG_DB_CATEGORIES,
  CATALOG_TO_DB_CATEGORY,
  CatalogProductInputSchema,
  catalogIdentityKey,
  toCatalogCategory,
} from "../src/schemas/product-catalog.js";

// 製品カタログのカテゴリ定義と入力検証。
// 画面（タブ / サイドバー / 登録フォーム）はすべてここの定義を参照するので、
// 順序とカテゴリごとの必須項目はここで固定する。

const BASE_PRICES = { purchasePrice: "1000", dealerPrice: "1500" };

describe("カテゴリ定義", () => {
  it("表示順は PV → BT → エコキュート → IH → プレゼント品 → その他", () => {
    expect(CATALOG_CATEGORY_VALUES).toEqual(["PV", "BT", "ECO_CUTE", "IH", "GIFT", "OTHER"]);
  });

  it("PV / BT / その他は既存の ProductCategory を再利用する", () => {
    expect(CATALOG_TO_DB_CATEGORY.PV).toBe("PANEL");
    expect(CATALOG_TO_DB_CATEGORY.BT).toBe("BATTERY");
    expect(CATALOG_TO_DB_CATEGORY.OTHER).toBe("OTHER_PART");
  });

  it("旧カテゴリの商品も「その他」から辿れる（画面から消えない）", () => {
    expect(CATALOG_DB_CATEGORIES.OTHER).toContain("POWER_CONDITIONER");
    expect(toCatalogCategory("MOUNT")).toBe("OTHER");
    expect(toCatalogCategory("SET")).toBe("OTHER");
    expect(toCatalogCategory("PANEL")).toBe("PV");
    expect(toCatalogCategory("BATTERY")).toBe("BT");
  });
});

describe("カテゴリごとの必須項目", () => {
  it("PV はメーカーと型番が要る", () => {
    expect(
      CatalogProductInputSchema.safeParse({ category: "PV", maker: "Qセルズ", ...BASE_PRICES })
        .success,
    ).toBe(false);
    expect(
      CatalogProductInputSchema.safeParse({
        category: "PV",
        maker: "Qセルズ",
        modelNo: "ML-G11S",
        ...BASE_PRICES,
      }).success,
    ).toBe(true);
  });

  it("BT はシリーズ・容量・機能区分・保証が要る", () => {
    const base = { category: "BT" as const, maker: "長州産業", ...BASE_PRICES };
    expect(
      CatalogProductInputSchema.safeParse({ ...base, series: "スマートPVマルチ" }).success,
    ).toBe(false);

    const parsed = CatalogProductInputSchema.parse({
      ...base,
      series: "スマートPVマルチ",
      capacityKwh: "6.3",
      batteryFunctionType: "SPECIFIC_LOAD",
      warrantyYears: "20",
    });
    expect(parsed.capacityKwh).toBe("6.3");
    expect(parsed.batteryFunctionType).toBe("SPECIFIC_LOAD");
    // 保証は数値で持ち、表示側で「20年保証」に組み立てる。
    expect(parsed.warrantyYears).toBe(20);
  });

  it("エコキュートはメーカー・シリーズ・型番が要る", () => {
    expect(
      CatalogProductInputSchema.safeParse({
        category: "ECO_CUTE",
        maker: "Panasonic",
        modelNo: "HE-S37LQS",
        ...BASE_PRICES,
      }).success,
    ).toBe(false);
    expect(
      CatalogProductInputSchema.safeParse({
        category: "ECO_CUTE",
        maker: "Panasonic",
        series: "Sシリーズ",
        modelNo: "HE-S37LQS",
        ...BASE_PRICES,
      }).success,
    ).toBe(true);
  });

  it("プレゼント品 / その他は商品名だけが必須", () => {
    expect(
      CatalogProductInputSchema.safeParse({
        category: "GIFT",
        name: "商品券5万円分",
        ...BASE_PRICES,
      }).success,
    ).toBe(true);
    expect(CatalogProductInputSchema.safeParse({ category: "OTHER", ...BASE_PRICES }).success).toBe(
      false,
    );
  });
});

describe("仕入れ値 / 卸値", () => {
  const withName = { category: "GIFT" as const, name: "炊飯器" };

  it("整数円として保持し、カンマ・全角数字は落として受ける", () => {
    const parsed = CatalogProductInputSchema.parse({
      ...withName,
      purchasePrice: "32,000",
      dealerPrice: "４２０００",
    });
    expect(parsed.purchasePrice).toBe("32000");
    expect(parsed.dealerPrice).toBe("42000");
  });

  it("負数と小数は受け付けない", () => {
    expect(
      CatalogProductInputSchema.safeParse({ ...withName, purchasePrice: "-1", dealerPrice: "10" })
        .success,
    ).toBe(false);
    expect(
      CatalogProductInputSchema.safeParse({ ...withName, purchasePrice: "10.5", dealerPrice: "10" })
        .success,
    ).toBe(false);
  });
});

describe("メーカー", () => {
  it("メーカー必須のカテゴリは未入力を弾く", () => {
    const required = [
      { category: "PV" as const, modelNo: "X-1" },
      {
        category: "BT" as const,
        series: "S",
        capacityKwh: "6.3",
        batteryFunctionType: "SINGLE" as const,
        warrantyYears: "20",
      },
      { category: "ECO_CUTE" as const, series: "S", modelNo: "X-1" },
      { category: "IH" as const, modelNo: "X-1" },
    ];
    for (const spec of required) {
      expect(
        CatalogProductInputSchema.safeParse({ ...spec, ...BASE_PRICES }).success,
        `${spec.category} はメーカー未入力を弾く`,
      ).toBe(false);
      // 空白だけの入力も「未入力」として扱う。
      expect(
        CatalogProductInputSchema.safeParse({ ...spec, maker: "   ", ...BASE_PRICES }).success,
        `${spec.category} は空白だけのメーカーを弾く`,
      ).toBe(false);
    }
  });

  it("プレゼント品 / その他はメーカー無しでも登録できる", () => {
    expect(
      CatalogProductInputSchema.safeParse({ category: "GIFT", name: "商品券", ...BASE_PRICES })
        .success,
    ).toBe(true);
    expect(
      CatalogProductInputSchema.safeParse({ category: "OTHER", name: "電気工事", ...BASE_PRICES })
        .success,
    ).toBe(true);
  });

  it("新規メーカー名は前後の空白を落として保存する", () => {
    const parsed = CatalogProductInputSchema.parse({
      category: "IH",
      maker: "  ○○電機  ",
      modelNo: "X-1",
      ...BASE_PRICES,
    });
    expect(parsed.maker).toBe("○○電機");
  });
});

describe("商品の同一性", () => {
  it("型番はメーカーが違えば別商品", () => {
    const a = catalogIdentityKey({ category: "PV", maker: "A社", modelNo: "X-100" });
    const b = catalogIdentityKey({ category: "PV", maker: "B社", modelNo: "X-100" });
    expect(a).not.toBe(b);
  });

  it("BT は機能区分が違えば別商品、容量の表記ゆれは同じ商品", () => {
    const single = catalogIdentityKey({
      category: "BT",
      maker: "長州産業",
      series: "スマートPVマルチ",
      capacityKwh: "6.3",
      batteryFunctionType: "SINGLE",
    });
    const full = catalogIdentityKey({
      category: "BT",
      maker: "長州産業",
      series: "スマートPVマルチ",
      capacityKwh: "6.3",
      batteryFunctionType: "FULL_LOAD",
    });
    const padded = catalogIdentityKey({
      category: "BT",
      maker: "長州産業",
      series: "スマートPVマルチ",
      // DB の Decimal(10,2) は "6.30" で返る。同じ商品として扱う。
      capacityKwh: "6.30",
      batteryFunctionType: "SINGLE",
    });
    expect(single).not.toBe(full);
    expect(single).toBe(padded);
  });
});
