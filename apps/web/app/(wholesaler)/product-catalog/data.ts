// 製品カタログ一覧のデータローダー（RSC から呼ぶ）。
//
// 既存の商品マスタ（/masters/products）と同じ Product テーブルを読む。別テーブルは
// 作らない。読むときの三段（getTenantContext → assertCan → withTenant）も同じで、
// RLS と Prisma extension の二重防御をそのまま通す。
//
// 一覧に出す行の条件:
//   1. 価格改定で閉じられた旧版（isActive = true かつ適用期間が終了）は常に除く。
//      版管理は /masters/products の担当で、カタログに出すと同じ商品が二重に並ぶだけ。
//   2. 既定では isActive = true だけを出す。「無効の商品も表示」で無効な商品も出す
//      （一覧のチェックボックスから有効へ戻せるのはこの表示のとき）。

import "server-only";

import { CATALOG_DB_CATEGORIES, toCatalogCategory, type CatalogCategory } from "@solar/contracts";

import { auth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions/can";
import { getTenantContext } from "@/lib/tenancy/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import { DEFAULT_SORT_FIELD } from "./categories";

import type { SortDirection } from "@/components/list/list-sort";
import type { Prisma } from "@solar/db";

/** 1 ページの表示件数。他の業務一覧（顧客・スタッフ）と揃える。 */
export const PAGE_SIZE = 50;

export interface CatalogProductListItem {
  id: string;
  category: CatalogCategory;
  name: string;
  maker: string;
  series: string | null;
  modelNo: string | null;
  /** kWh。BT のみ。 */
  capacity: string | null;
  batteryFunctionType: string | null;
  warrantyYears: number | null;
  /** 仕入れ値（整数円の文字列）。卸業者テナント内の画面なので保持する。 */
  purchasePrice: string;
  /** 卸値（整数円の文字列）。 */
  dealerPrice: string;
  note: string | null;
  isActive: boolean;
  updatedAt: string;
}

export interface CatalogListResult {
  items: CatalogProductListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CatalogListFilter {
  category: CatalogCategory;
  /**
   * メーカー絞り込み。
   *   undefined … すべて（絞り込まない）
   *   ""        … メーカー未設定の商品だけ（Product.maker は NOT NULL で、
   *               メーカーを持たない商品は空文字で保存される）
   *   それ以外   … その名前と完全一致する商品だけ
   */
  maker?: string;
  query?: string;
  includeRetired?: boolean;
  sortField?: string;
  sortDirection?: SortDirection;
  page?: number;
}

async function requireCatalogReadCtx() {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError({
      code: "INVALID_CREDENTIALS",
      message: "Session missing — sign in is required",
    });
  }
  const ctx = await getTenantContext();
  assertCan({
    user: {
      userId: ctx.actorUserId,
      roles: session.user.roles,
      isSaasAdmin: ctx.isSaasAdmin,
      tenantId: ctx.tenantId,
      wholesalerId: ctx.wholesalerId,
      dealerId: ctx.dealerId,
      relationshipIds: ctx.relationshipIds,
    },
    // 製品カタログは通常機能。既存の product.read をそのまま使い、
    // 新しいロール制限は足さない。
    action: "product.read",
    resource: ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined,
  });
  return ctx;
}

/** URL の並び替え項目 → Prisma の orderBy。値域外は更新日時降順へ落とす。 */
function buildOrderBy(
  sortField: string,
  direction: SortDirection,
): Prisma.ProductOrderByWithRelationInput[] {
  switch (sortField) {
    case "created_at":
      return [{ createdAt: direction }];
    case "maker":
      return [{ maker: direction }, { name: "asc" }];
    case "series":
      return [{ series: direction }, { capacity: "asc" }, { name: "asc" }];
    case "modelNo":
      return [{ modelNo: direction }, { name: "asc" }];
    case "capacity":
      return [{ capacity: direction }, { name: "asc" }];
    case "name":
      return [{ name: direction }];
    case "purchasePrice":
      return [{ purchasePrice: direction }, { name: "asc" }];
    case "dealerPrice":
      return [{ dealerPrice: direction }, { name: "asc" }];
    case "updated_at":
    default:
      return [{ updatedAt: direction }];
  }
}

/**
 * カタログに出す行の条件（一覧と、メーカー絞り込みの候補で共有する）。
 *
 * 1 つ目の節は「価格改定で閉じられた旧版を除く」。旧版は isActive = true のまま
 * effectiveTo だけが過去になっている行なので、それだけを落とす
 * （無効な商品は effectiveTo に関係なく残す — でないと削除済みの商品が
 * 「無効の商品も表示」でも見えなくなり、有効へ戻せなくなる）。
 */
function catalogVisibilityWhere(includeRetired: boolean, now: Date): Prisma.ProductWhereInput[] {
  return [
    { OR: [{ isActive: false }, { effectiveTo: null }, { effectiveTo: { gt: now } }] },
    ...(includeRetired ? [] : [{ isActive: true }]),
  ];
}

/** 容量は Decimal(10,2) なので "6.30" で返ってくる。表示用に末尾 0 を落とす。 */
function formatCapacity(value: Prisma.Decimal | null): string | null {
  if (value === null) return null;
  const n = Number(value.toString());
  return Number.isFinite(n) ? String(n) : value.toString();
}

/** 金額は整数円で運用する。Decimal(14,2) の小数部は表示に持ち込まない。 */
function toYenString(value: Prisma.Decimal): string {
  return String(Math.round(Number(value.toString())));
}

export async function listCatalogProducts(filter: CatalogListFilter): Promise<CatalogListResult> {
  const ctx = await requireCatalogReadCtx();
  const page = Math.max(1, filter.page ?? 1);
  const query = filter.query?.trim() ?? "";
  const sortField = filter.sortField ?? DEFAULT_SORT_FIELD;
  const direction: SortDirection = filter.sortDirection ?? "desc";
  const now = new Date();

  const where: Prisma.ProductWhereInput = {
    category: { in: CATALOG_DB_CATEGORIES[filter.category] },
    // メーカー絞り込みと検索条件は AND で併用する。
    ...(filter.maker !== undefined ? { maker: filter.maker } : {}),
    AND: [
      ...catalogVisibilityWhere(filter.includeRetired ?? false, now),
      ...(query
        ? [
            {
              OR: [
                { name: { contains: query, mode: "insensitive" as const } },
                { maker: { contains: query, mode: "insensitive" as const } },
                { series: { contains: query, mode: "insensitive" as const } },
                { modelNo: { contains: query, mode: "insensitive" as const } },
              ],
            },
          ]
        : []),
    ],
  };

  return withTenant(ctx, async (tx) => {
    const total = await tx.product.count({ where });
    const rows = await tx.product.findMany({
      where,
      orderBy: buildOrderBy(sortField, direction),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        category: true,
        name: true,
        maker: true,
        series: true,
        modelNo: true,
        capacity: true,
        batteryFunctionType: true,
        warrantyYears: true,
        purchasePrice: true,
        dealerPrice: true,
        note: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return {
      items: rows.map((r) => ({
        id: r.id,
        category: toCatalogCategory(r.category),
        name: r.name,
        maker: r.maker,
        series: r.series,
        modelNo: r.modelNo,
        capacity: formatCapacity(r.capacity),
        batteryFunctionType: r.batteryFunctionType,
        warrantyYears: r.warrantyYears,
        purchasePrice: toYenString(r.purchasePrice),
        dealerPrice: toYenString(r.dealerPrice),
        note: r.note,
        isActive: r.isActive,
        updatedAt: r.updatedAt.toISOString(),
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  });
}

/**
 * メーカー絞り込みの候補。
 *
 * 固定のメーカー一覧は持たない（マスタ画面も作らない）。いま登録されている
 * 商品から distinct で拾うので、無効化された商品しか無いメーカーは
 * 通常の候補には出てこない。「無効の商品も表示」時だけ、その条件に合わせて
 * 候補側も広げる（一覧に出ている商品を絞り込めない、という状態を作らない）。
 */
export interface CatalogMakerOptions {
  /** 名前のあるメーカー（昇順）。 */
  makers: string[];
  /** メーカー未設定の商品が 1 件以上あるか（プレゼント品 / その他で起きる）。 */
  hasUnset: boolean;
}

export async function listCatalogMakers(
  category: CatalogCategory,
  includeRetired = false,
): Promise<CatalogMakerOptions> {
  const ctx = await requireCatalogReadCtx();
  const now = new Date();

  const rows = await withTenant(ctx, (tx) =>
    tx.product.findMany({
      where: {
        category: { in: CATALOG_DB_CATEGORIES[category] },
        AND: catalogVisibilityWhere(includeRetired, now),
      },
      distinct: ["maker"],
      select: { maker: true },
    }),
  );

  return {
    // 日本語・英字が混ざるので localeCompare("ja") で安定した昇順にする。
    makers: rows
      .map((r) => r.maker)
      .filter((m) => m.length > 0)
      .sort((a, b) => a.localeCompare(b, "ja")),
    hasUnset: rows.some((r) => r.maker.length === 0),
  };
}

/**
 * 登録・編集フォームのメーカー候補。
 *
 * メーカーはカテゴリをまたぐ共通概念（Panasonic は PV にも IH にも出る）なので、
 * 絞り込みの候補と違ってカテゴリで区切らず、テナント内の全商品から拾う。
 * ここに無い名前は自由入力でそのまま登録できる。
 */
export async function listAllCatalogMakers(): Promise<string[]> {
  const ctx = await requireCatalogReadCtx();
  const rows = await withTenant(ctx, (tx) =>
    tx.product.findMany({
      where: { isActive: true },
      distinct: ["maker"],
      select: { maker: true },
    }),
  );
  return rows
    .map((r) => r.maker)
    .filter((m) => m.length > 0)
    .sort((a, b) => a.localeCompare(b, "ja"));
}
