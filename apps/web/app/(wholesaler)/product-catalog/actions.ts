"use server";

// 製品カタログの Server Actions（登録 / 編集 / 論理削除）。
//
// 保存先は既存の Product テーブル。権限も既存の product.create / product.update /
// product.retire をそのまま使い、この画面のために新しいロール制限は足さない。
//
// 既存の商品マスタ（/masters/products）との役割分担:
//   - あちらは「適用期間つきの価格版管理」。価格改定は後継行を作る append-only。
//   - こちらは日々のカタログ整備。価格もその場で書き換える（版は増やさない）。
//     過去の契約は ContractItem の snapshot 列が金額を保持しているので、
//     ここで単価を直しても成立済みの契約の粗利は動かない（CLAUDE.md ルール 4）。
//     変更の履歴は ProductPriceHistory に append-only で残す。
//
// カテゴリごとに使わない項目（hidden）は、入力に混ざっていても保存しない。
// フォームでカテゴリを切り替えたときに前のカテゴリの値が残っても、
// 「見えていない値が保存されている」状態を作らないため。

import {
  CATALOG_FIELDS,
  CATALOG_TO_DB_CATEGORY,
  CatalogProductInputSchema,
  CatalogProductUpdateSchema,
  catalogIdentityKey,
  toCatalogCategory,
  type CatalogCategory,
  type CatalogFieldSpec,
  type CatalogProductInput,
  type CatalogProductUpdate,
} from "@solar/contracts";
import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit/audit-service";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { labels } from "@/lib/i18n/labels";
import { withServerActionContext } from "@/lib/tenancy/server-action";

import { categoryPath } from "./categories";

import type { TxClient } from "@solar/db";

const t = labels.productCatalog;

/** 入力のうち、そのカテゴリで実際に使う項目だけ残す。 */
type CatalogFieldKey = keyof CatalogFieldSpec;

function visible(category: CatalogCategory, field: CatalogFieldKey): boolean {
  return CATALOG_FIELDS[category][field] !== "hidden";
}

function pick<T>(category: CatalogCategory, field: CatalogFieldKey, value: T): T | null {
  if (!visible(category, field)) return null;
  return value ?? null;
}

/**
 * 一覧・契約明細に出る商品名。
 *
 * 商品名を直接入力するのはプレゼント品 / その他だけ。型番やシリーズで識別する
 * カテゴリでは、人が読める名前をここで組み立てて `name` に入れる。
 * `Product.name` は契約明細のスナップショット元でもあるので、必ず埋める。
 */
function deriveName(input: {
  category: CatalogCategory;
  name?: string | null;
  maker?: string | null;
  series?: string | null;
  modelNo?: string | null;
  capacityKwh?: string | null;
  batteryFunctionType?: string | null;
}): string {
  const parts: (string | null | undefined)[] = (() => {
    switch (input.category) {
      case "PV":
      case "IH":
        return [input.maker, input.series, input.modelNo];
      case "BT":
        return [
          input.series,
          input.capacityKwh ? `${input.capacityKwh}${t.capacitySuffix}` : null,
          input.batteryFunctionType ? t.batteryFunctionTypes[input.batteryFunctionType] : null,
        ];
      case "ECO_CUTE":
        return [input.maker, input.series, input.modelNo];
      case "GIFT":
      case "OTHER":
        return [input.name];
    }
  })();

  const derived = parts.filter((v): v is string => Boolean(v && v.length > 0)).join(" ");
  // どの経路でも空文字にはしない（name は NOT NULL）。
  return derived.length > 0
    ? derived
    : (input.name ?? input.maker ?? t.categories[input.category]!);
}

/**
 * 同じ商品がすでに登録されていないか。
 *
 * 型番は違うメーカー間で同じ文字列があり得るので、型番単独では判定しない
 * （カテゴリ + メーカー + 型番、BT はシリーズ + 容量 + 機能区分）。
 * DB のユニーク制約にはしない — 既存の価格改定が同一タプルの後継行を作る
 * 運用なので、制約を張ると過去データと既存機能を壊す。
 */
async function assertNotDuplicate(
  tx: TxClient,
  category: CatalogCategory,
  candidate: Parameters<typeof catalogIdentityKey>[0],
  excludeId?: string,
): Promise<void> {
  const key = catalogIdentityKey(candidate);
  const now = new Date();
  const rows = await tx.product.findMany({
    where: {
      category: CATALOG_TO_DB_CATEGORY[category],
      isActive: true,
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      category: true,
      name: true,
      maker: true,
      series: true,
      modelNo: true,
      capacity: true,
      batteryFunctionType: true,
    },
  });

  const clash = rows.some(
    (r) =>
      catalogIdentityKey({
        category: toCatalogCategory(r.category),
        name: r.name,
        maker: r.maker,
        series: r.series,
        modelNo: r.modelNo,
        capacityKwh: r.capacity?.toString() ?? null,
        batteryFunctionType: r.batteryFunctionType,
      }) === key,
  );
  if (clash) throw new ValidationError(t.errors.duplicate);
}

// ---------------------------------------------------------------------------
// 登録
// ---------------------------------------------------------------------------

export interface CatalogProductResult {
  id: string;
}

export const createCatalogProductAction = withServerActionContext<
  CatalogProductInput,
  CatalogProductResult
>(
  {
    action: "product.create",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ tx, ctx, input }) => {
    if (!ctx.wholesalerId) {
      throw new ValidationError("wholesalerId is required for product catalog");
    }
    const parsed = CatalogProductInputSchema.parse(input);
    const category = parsed.category;

    const fields = {
      maker: pick(category, "maker", parsed.maker) ?? "",
      series: pick(category, "series", parsed.series),
      modelNo: pick(category, "modelNo", parsed.modelNo),
      capacityKwh: pick(category, "capacityKwh", parsed.capacityKwh),
      batteryFunctionType: pick(category, "batteryFunctionType", parsed.batteryFunctionType),
      warrantyYears: pick(category, "warrantyYears", parsed.warrantyYears),
      note: pick(category, "note", parsed.note),
      name: pick(category, "name", parsed.name),
    };

    await assertNotDuplicate(tx, category, { category, ...fields });

    const created = await tx.product.create({
      data: {
        wholesalerId: ctx.wholesalerId,
        category: CATALOG_TO_DB_CATEGORY[category],
        name: deriveName({ category, ...fields }),
        maker: fields.maker,
        series: fields.series,
        modelNo: fields.modelNo,
        capacity: fields.capacityKwh,
        // 単位はカタログ画面では入力させない。カテゴリごとの既定値を入れる
        // （Product.unit は NOT NULL で、既存のマスタ画面・契約明細が使う）。
        unit: t.defaultUnits[category]!,
        purchasePrice: parsed.purchasePrice,
        dealerPrice: parsed.dealerPrice,
        // 参考売価はこの画面の管理対象外。値が無いと NOT NULL を満たせないため
        // 卸値と同額で初期化する（0 円だと契約明細の小計が 0 になってしまう）。
        // 参考売価そのものを運用するときは従来どおり /masters/products で扱う。
        listPrice: parsed.dealerPrice,
        // カタログは適用期間を持たない運用。登録時点から有効にする。
        effectiveFrom: new Date(),
        batteryFunctionType: fields.batteryFunctionType,
        warrantyYears: fields.warrantyYears,
        note: fields.note,
        createdBy: ctx.actorUserId,
      },
      select: { id: true, name: true },
    });

    await recordAudit(tx, {
      actorUserId: ctx.actorUserId,
      action: "CREATE",
      targetType: "Product",
      targetId: created.id,
      tenantId: ctx.tenantId ?? ctx.wholesalerId ?? "",
      // 監査ログの top-level "name" は PII として ***  に伏せられるため、
      // 商品名は別のキーで残す（商品名は PII ではない）。
      after: { category: CATALOG_TO_DB_CATEGORY[category], productName: created.name },
    });

    revalidatePath(categoryPath(category));
    return { id: created.id };
  },
);

// ---------------------------------------------------------------------------
// 編集
// ---------------------------------------------------------------------------

export const updateCatalogProductAction = withServerActionContext<
  CatalogProductUpdate,
  CatalogProductResult
>(
  {
    action: "product.update",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ tx, ctx, input }) => {
    const parsed = CatalogProductUpdateSchema.parse(input);
    const category = parsed.category;

    // withTenant 経由なので他テナントの行はそもそも見えない。
    // 見つからない = 未作成 も 他テナント も同じ 404 に寄せる（docs/05 §9.1）。
    const existing = await tx.product.findUnique({
      where: { id: parsed.id },
      select: {
        id: true,
        category: true,
        purchasePrice: true,
        dealerPrice: true,
        listPrice: true,
      },
    });
    if (!existing) throw new NotFoundError(t.errors.notFound);

    // カテゴリの付け替えは受け付けない。カテゴリが変わると必須項目も
    // 同一性キーも変わり、既存の参照（契約明細など）の意味が揺れるため。
    if (toCatalogCategory(existing.category) !== category) {
      throw new ValidationError("商品のカテゴリは変更できません");
    }

    const fields = {
      maker: pick(category, "maker", parsed.maker) ?? "",
      series: pick(category, "series", parsed.series),
      modelNo: pick(category, "modelNo", parsed.modelNo),
      capacityKwh: pick(category, "capacityKwh", parsed.capacityKwh),
      batteryFunctionType: pick(category, "batteryFunctionType", parsed.batteryFunctionType),
      warrantyYears: pick(category, "warrantyYears", parsed.warrantyYears),
      note: pick(category, "note", parsed.note),
      name: pick(category, "name", parsed.name),
    };

    await assertNotDuplicate(tx, category, { category, ...fields }, parsed.id);

    const priceChanged =
      Math.round(Number(existing.purchasePrice.toString())) !== Number(parsed.purchasePrice) ||
      Math.round(Number(existing.dealerPrice.toString())) !== Number(parsed.dealerPrice);

    const updated = await tx.product.update({
      where: { id: parsed.id },
      data: {
        name: deriveName({ category, ...fields }),
        maker: fields.maker,
        series: fields.series,
        modelNo: fields.modelNo,
        capacity: fields.capacityKwh,
        purchasePrice: parsed.purchasePrice,
        dealerPrice: parsed.dealerPrice,
        batteryFunctionType: fields.batteryFunctionType,
        warrantyYears: fields.warrantyYears,
        note: fields.note,
      },
      select: { id: true },
    });

    // 価格の変更は append-only の履歴に残す（誰がいつ何を幾らにしたか）。
    if (priceChanged) {
      await tx.productPriceHistory.create({
        data: {
          productId: parsed.id,
          before: {
            purchasePrice: existing.purchasePrice.toString(),
            dealerPrice: existing.dealerPrice.toString(),
          },
          after: {
            purchasePrice: parsed.purchasePrice,
            dealerPrice: parsed.dealerPrice,
            source: "product-catalog",
          },
          changedBy: ctx.actorUserId,
        },
      });
    }

    await recordAudit(tx, {
      actorUserId: ctx.actorUserId ?? null,
      action: "UPDATE",
      targetType: "Product",
      targetId: updated.id,
      tenantId: ctx.tenantId ?? ctx.wholesalerId ?? "",
      ...(priceChanged
        ? {
            before: {
              purchasePrice: existing.purchasePrice.toString(),
              dealerPrice: existing.dealerPrice.toString(),
            },
          }
        : {}),
      after: {
        category: CATALOG_TO_DB_CATEGORY[category],
        purchasePrice: parsed.purchasePrice,
        dealerPrice: parsed.dealerPrice,
      },
    });

    revalidatePath(categoryPath(category));
    return { id: updated.id };
  },
);

// ---------------------------------------------------------------------------
// 有効 / 無効切替（一時無効）
// ---------------------------------------------------------------------------

export interface SetCatalogProductActiveInput {
  id: string;
  isActive: boolean;
}

/**
 * 一覧のチェックボックスからの有効 / 無効切替。
 *
 * 「削除」とは別操作として扱う:
 *   一時無効 … isActive を落とすだけ。effectiveTo には触らない。
 *              「いまは新規の商品選択に出したくない」という日常的な出し入れで、
 *              いつでもチェックを戻して有効へ復帰できる。
 *   削除     … isActive を落とし、effectiveTo も締める（retireCatalogProductAction）。
 *
 * 有効へ戻すときだけ effectiveTo を見る。過去日で締まったままだと適用期間が
 * 終了した扱いになり、チェックを入れても一覧・商品選択に戻ってこないため、
 * その場合に限って開き直す。カタログは価格改定の旧版を表示しない
 * （data.ts の catalogVisibilityWhere）ので、ここに来る行は版管理の途中の
 * 行ではなく、カタログ自身が閉じた行だけになる。
 */
export const setCatalogProductActiveAction = withServerActionContext<
  SetCatalogProductActiveInput,
  CatalogProductResult
>(
  {
    action: "product.set_active",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ tx, ctx, input }) => {
    // 対象は必ず DB から引き直す。クライアントから来た id をそのまま
    // update に流さない（withTenant 経由なので他テナントの行は見えず 404 になる）。
    const existing = await tx.product.findUnique({
      where: { id: input.id },
      select: { id: true, category: true, isActive: true, effectiveTo: true },
    });
    if (!existing) throw new NotFoundError(t.errors.notFound);

    const now = new Date();
    const reopen =
      input.isActive &&
      existing.effectiveTo !== null &&
      existing.effectiveTo.getTime() <= now.getTime();

    await tx.product.update({
      where: { id: existing.id },
      data: {
        isActive: input.isActive,
        ...(reopen ? { effectiveTo: null } : {}),
      },
    });

    await recordAudit(tx, {
      actorUserId: ctx.actorUserId ?? null,
      action: "UPDATE",
      targetType: "Product",
      targetId: existing.id,
      tenantId: ctx.tenantId ?? ctx.wholesalerId ?? "",
      before: { isActive: existing.isActive },
      after: { isActive: input.isActive, reopened: reopen },
    });

    revalidatePath(categoryPath(toCatalogCategory(existing.category)));
    return { id: existing.id };
  },
);

// ---------------------------------------------------------------------------
// 削除（論理削除）
// ---------------------------------------------------------------------------

export interface RetireCatalogProductInput {
  id: string;
}

/**
 * 商品の削除。物理 DELETE はしない。
 *
 * isActive = false にして一覧と新規の商品選択から外すだけ。行は残るので、
 * 過去の契約・見積から productId で参照されている情報は壊れない
 * （既存の商品ピッカーはいずれも isActive = true で絞っている）。
 */
export const retireCatalogProductAction = withServerActionContext<
  RetireCatalogProductInput,
  CatalogProductResult
>(
  {
    action: "product.retire",
    resource: ({ ctx }) => (ctx.wholesalerId ? { wholesalerId: ctx.wholesalerId } : undefined),
  },
  async ({ tx, ctx, input }) => {
    const existing = await tx.product.findUnique({
      where: { id: input.id },
      select: { id: true, category: true, effectiveFrom: true },
    });
    if (!existing) throw new NotFoundError(t.errors.notFound);

    // 既存の retireProductAction と同じ締め方。適用開始が未来の行は
    // CHECK 制約（effectiveFrom < effectiveTo）を壊さないよう +1ms で閉じる。
    const now = new Date();
    const cutoff =
      existing.effectiveFrom.getTime() >= now.getTime()
        ? new Date(existing.effectiveFrom.getTime() + 1)
        : now;

    await tx.product.update({
      where: { id: input.id },
      data: { isActive: false, effectiveTo: cutoff },
    });

    await recordAudit(tx, {
      actorUserId: ctx.actorUserId ?? null,
      action: "DELETE",
      targetType: "Product",
      targetId: input.id,
      tenantId: ctx.tenantId ?? ctx.wholesalerId ?? "",
      after: { isActive: false },
    });

    revalidatePath(categoryPath(toCatalogCategory(existing.category)));
    return { id: input.id };
  },
);
