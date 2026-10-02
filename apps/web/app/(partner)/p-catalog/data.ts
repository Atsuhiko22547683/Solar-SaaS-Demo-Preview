// 二次店ポータル：カタログ（閲覧専用）のデータローダー。
//
// 既存の商品マスタ（Product）を、取引先代理店の公開範囲でスタッフに見せる。
// 公開範囲 = 取引先代理店の isActive な商品。商品マスタに「二次店向け公開フラグ」や
// 資料添付は無いので、それ以上の絞り込み・ダウンロード導線は作らない。
//
// 仕入値（purchasePrice）は二次店に絶対出さない（CLAUDE.md ルール 5）。
// 投影は既存の toDealerDto（キーごと物理除外）に一本化し、ここで select にも入れない。

import "server-only";

import { toDealerDto, type ProductForDealerDto } from "@solar/contracts";

import { requirePartnerContext } from "@/lib/partner/context";
import { DEFAULT_PAGE_SIZE } from "@/lib/partner/list-query";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { CatalogListQuery } from "./query";
import type { Prisma } from "@solar/db";

export interface PartnerCatalogItem extends ProductForDealerDto {
  series: string | null;
  batteryFunctionType: string | null;
  warrantyYears: number | null;
  note: string | null;
}

const PRODUCT_SELECT = {
  id: true,
  category: true,
  maker: true,
  name: true,
  modelNo: true,
  series: true,
  capacity: true,
  unit: true,
  // purchasePrice は select しない（読み出しの時点で持ち込まない）。
  dealerPrice: true,
  listPrice: true,
  effectiveFrom: true,
  effectiveTo: true,
  batteryFunctionType: true,
  warrantyYears: true,
  note: true,
} as const;

type Row = {
  id: string;
  category: string;
  maker: string;
  name: string;
  modelNo: string | null;
  series: string | null;
  capacity: { toString(): string } | null;
  unit: string;
  dealerPrice: { toString(): string };
  listPrice: { toString(): string };
  effectiveFrom: Date;
  effectiveTo: Date | null;
  batteryFunctionType: string | null;
  warrantyYears: number | null;
  note: string | null;
};

function toItem(r: Row): PartnerCatalogItem {
  // toDealerDto は purchasePrice を「キーごと」落とす。select で除外済みだが、
  // 将来 select が広がっても同じ関数を通る限り漏れないよう二重にしておく。
  const dealer = toDealerDto({
    id: r.id,
    category: r.category,
    maker: r.maker,
    name: r.name,
    modelNo: r.modelNo,
    capacity: r.capacity ? r.capacity.toString() : null,
    unit: r.unit,
    purchasePrice: "",
    dealerPrice: r.dealerPrice.toString(),
    listPrice: r.listPrice.toString(),
    effectiveFrom: r.effectiveFrom.toISOString(),
    effectiveTo: r.effectiveTo ? r.effectiveTo.toISOString() : null,
  });
  return {
    ...dealer,
    series: r.series,
    batteryFunctionType: r.batteryFunctionType,
    warrantyYears: r.warrantyYears,
    note: r.note,
  };
}

export interface PartnerCatalogListResult {
  rows: PartnerCatalogItem[];
  total: number;
  page: number;
  pageCount: number;
  /** 公開商品に実在するカテゴリ（絞り込みタブ用）。 */
  categories: string[];
  /** 選択中カテゴリ（未選択なら全体）の公開商品に実在するメーカー。 */
  makers: string[];
  /** 指定されたメーカーがカテゴリの候補に無く「すべて」へ戻したか。 */
  makerReset: boolean;
  /** 実際に適用したカテゴリ / メーカー。 */
  category?: string;
  maker?: string;
}

/**
 * 一覧。権限による対象限定（取引先代理店の isActive）→ 絞り込み → 並べ替え → ページ分割を
 * DB 側で行う。候補（カテゴリ / メーカー）も同じ対象限定の下で全件から取る
 * （表示中の 1 ページからは作らない）。
 */
export async function listPartnerCatalog(q: CatalogListQuery): Promise<PartnerCatalogListResult> {
  const partner = await requirePartnerContext("partner_catalog.read");
  return withTenant(partner.ctx, async (tx) => {
    // 権限による対象限定。仕入値はどの select にも入れない。
    // 取引先が複数あるときは全代理店の公開商品を対象にする。仕入値はどの select にも入れない。
    const scope: Prisma.ProductWhereInput = {
      wholesalerId: { in: partner.relationships.map((r) => r.wholesalerId) },
      isActive: true,
    };

    const categoryRows = await tx.product.findMany({
      where: scope,
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    });
    const categories: string[] = categoryRows.map((r) => r.category);
    // 値域外のカテゴリ指定は「すべて」に倒す。
    const category = q.category && categories.includes(q.category) ? q.category : undefined;

    const makerRows = await tx.product.findMany({
      where: { ...scope, ...(category ? { category: category as never } : {}) },
      distinct: ["maker"],
      select: { maker: true },
      orderBy: { maker: "asc" },
    });
    const makers = makerRows.map((r) => r.maker);
    // カテゴリ変更で選択中のメーカーが対象外になったら「すべて」へ戻す（他の条件は保持）。
    const makerReset = Boolean(q.maker && !makers.includes(q.maker));
    const maker = q.maker && makers.includes(q.maker) ? q.maker : undefined;

    const where: Prisma.ProductWhereInput = {
      ...scope,
      ...(category ? { category: category as never } : {}),
      ...(maker ? { maker } : {}),
      ...(q.keyword
        ? {
            OR: [
              { name: { contains: q.keyword, mode: "insensitive" } },
              { modelNo: { contains: q.keyword, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(q.dealerPrice.min !== undefined || q.dealerPrice.max !== undefined
        ? {
            dealerPrice: {
              ...(q.dealerPrice.min !== undefined ? { gte: q.dealerPrice.min } : {}),
              ...(q.dealerPrice.max !== undefined ? { lte: q.dealerPrice.max } : {}),
            },
          }
        : {}),
      ...(q.series ? { series: { contains: q.series, mode: "insensitive" } } : {}),
      ...(q.capacity.min !== undefined || q.capacity.max !== undefined
        ? {
            capacity: {
              ...(q.capacity.min !== undefined ? { gte: q.capacity.min } : {}),
              ...(q.capacity.max !== undefined ? { lte: q.capacity.max } : {}),
            },
          }
        : {}),
      ...(q.batteryFunctionType ? { batteryFunctionType: q.batteryFunctionType } : {}),
    };

    // 並べ替え対象は query.ts の許可リストに限る。未設定値（容量など）は昇順・降順とも末尾、
    // 同値は商品名 → id で安定させる。
    const nulls = "last" as const;
    const primary: Prisma.ProductOrderByWithRelationInput =
      q.sort.field === "capacity"
        ? { capacity: { sort: q.sort.direction, nulls } }
        : { [q.sort.field]: q.sort.direction };
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
      primary,
      ...(q.sort.field !== "name" ? [{ name: "asc" as const }] : []),
      { id: "asc" },
    ];

    const total = await tx.product.count({ where });
    const pageCount = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));
    const current = Math.min(q.page, pageCount);
    const rows = await tx.product.findMany({
      where,
      orderBy,
      skip: (current - 1) * DEFAULT_PAGE_SIZE,
      take: DEFAULT_PAGE_SIZE,
      select: PRODUCT_SELECT,
    });
    return {
      rows: rows.map(toItem),
      total,
      page: current,
      pageCount,
      categories,
      makers,
      makerReset,
      category,
      maker,
    };
  });
}

export async function getPartnerCatalogItem(id: string): Promise<PartnerCatalogItem | null> {
  const partner = await requirePartnerContext("partner_catalog.read");
  return withTenant(partner.ctx, async (tx) => {
    const r = await tx.product.findFirst({
      where: {
        id,
        wholesalerId: { in: partner.relationships.map((r) => r.wholesalerId) },
        isActive: true,
      },
      select: PRODUCT_SELECT,
    });
    return r ? toItem(r) : null;
  });
}
