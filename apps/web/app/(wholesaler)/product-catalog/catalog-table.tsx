"use client";

// 製品カタログの一覧表。
//
// 操作体系はスタッフ一覧・システムユーザー一覧と同一:
//   行のどこか / 右端のシェブロン → 展開・折りたたみ（アコーディオン: 1 行ずつ）
//   展開バナー → 全項目の確認と編集・削除
// 骨格・行高・罫線・余白・シェブロンの共通仕様は list-shell の定数をそのまま使う。
//
// 列はカテゴリごとに変える。全カテゴリで同じ表にすると、そのカテゴリに無い列
// （プレゼント品の「容量」など）が空欄で並ぶだけになるため。
// 幅は table-fixed + 非表示列にも w-0 を置く方式で固定する（展開時に
// colSpan が非表示列へ幅を配分してシェブロンが動くのを防ぐ）。

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import {
  COL_MD,
  COL_SM,
  LIST_CHEVRON_BUTTON,
  LIST_CHEVRON_TD,
  LIST_ROW,
  LIST_TD,
  LIST_TD_NUM,
  LIST_TD_STRONG,
  LIST_TH,
} from "@/components/list/list-shell";
import { labels } from "@/lib/i18n/labels";

import { ProductActiveToggle } from "./product-active-toggle";
import { ProductRowActions } from "./product-row-actions";

import type { CatalogProductListItem } from "./data";
import type { CatalogCategory } from "@solar/contracts";

const t = labels.productCatalog;

/** 金額表示。整数円で運用しているので小数は出さない（契約一覧と同じ体裁）。 */
export function formatYen(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export function formatCapacity(value: string | null): string | null {
  return value ? `${value}${t.capacitySuffix}` : null;
}

export function formatWarranty(years: number | null): string | null {
  return years === null ? null : `${years}${t.warrantySuffix}`;
}

/** 展開バナー内の 1 項目（ラベル上・値下の縦読み）。他一覧と同じ密度。 */
function StackedField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-mute-light text-[11px] leading-tight">{label}</dt>
      <dd className="text-body-light break-words text-sm">
        {value && value.length > 0 ? value : labels.customer.none}
      </dd>
    </div>
  );
}

/**
 * 主要セル。スマホでは 1 セルに 2 行（主 / 副）で入れる。
 * 副の行は sm 以上では独立した列に出るので、そこでは隠す。
 */
function PrimaryCell({ main, sub }: { main: string; sub: string | null }) {
  return (
    <div className="min-w-0">
      <span className="block truncate">{main}</span>
      {sub ? <span className="text-mute-light block truncate text-xs sm:hidden">{sub}</span> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// カテゴリごとの列
// ---------------------------------------------------------------------------
//
// 段の割り当ての考え方（list-shell の COL_* と同じ語彙）:
//   常時 … その商品を特定できる情報（メーカー / 型番 / シリーズ / 商品名）
//   SM   … 判断に要る情報（容量・機能区分・卸値）
//   MD   … 仕入れ値。社外に出ない数字で、走査中に常時見てはいない

interface ColumnDef {
  key: string;
  label: string;
  /** 画面幅の段（COL_SM など）。空文字は常時表示。 */
  breakpoint: string;
  /** 列幅（table-fixed）。非表示列も w-0 を必ず置く。 */
  width: string;
  align?: "num";
  value: (row: CatalogProductListItem) => string | null;
  /** 常時表示の主要セルだけ、スマホ用の副行を持つ。 */
  sub?: (row: CatalogProductListItem) => string | null;
  strong?: boolean;
}

// 列幅は table-fixed で固定する。各段（base / sm / md）で合計が必ず 100% に
// なるようにする — 合計が 100% を割ると余りが全列へ配分され、行を展開した
// ときだけ列幅が変わってシェブロンの x 座標が動く。非表示列にも w-0 を必ず置く。
//
// 右端の 2 列（有効 / シェブロン）は全カテゴリ共通で固定幅を取り、
// 残り（base 68% / sm 80% / md 84%）をカテゴリごとの列で分け合う。
const ACTIVE_WIDTH = "w-[16%] sm:w-[10%] md:w-[9%]";
const CHEVRON_WIDTH = "w-[16%] sm:w-[10%] md:w-[7%]";

/** 仕入れ値 / 卸値の列。幅はカテゴリごとに配分が変わるので引数で受ける。 */
function priceColumns(purchaseWidth: string, dealerWidth: string): ColumnDef[] {
  return [
    {
      key: "purchasePrice",
      label: t.fields.purchasePrice,
      breakpoint: COL_MD,
      width: purchaseWidth,
      align: "num",
      value: (r) => formatYen(r.purchasePrice),
    },
    {
      key: "dealerPrice",
      label: t.fields.dealerPrice,
      breakpoint: COL_SM,
      width: dealerWidth,
      align: "num",
      value: (r) => formatYen(r.dealerPrice),
    },
  ];
}

function columnsFor(category: CatalogCategory): ColumnDef[] {
  switch (category) {
    // PV / IH: メーカー + 型番。スマホは「メーカー / 型番」の 1 セル。
    case "PV":
    case "IH":
      return [
        {
          key: "maker",
          label: t.fields.maker,
          breakpoint: "",
          width: "w-[68%] sm:w-[28%] md:w-[26%]",
          strong: true,
          value: (r) => r.maker,
          sub: (r) => r.modelNo,
        },
        {
          key: "modelNo",
          label: t.fields.modelNo,
          breakpoint: COL_SM,
          width: "w-0 sm:w-[28%] md:w-[26%]",
          value: (r) => r.modelNo,
        },
        ...priceColumns("w-0 md:w-[16%]", "w-0 sm:w-[24%] md:w-[16%]"),
      ];

    // BT: シリーズ × 容量 × 機能区分で商品が分かれる。狭い画面でも
    // 「シリーズ / 容量」と「機能区分」までは出さないと行が区別できない。
    case "BT":
      return [
        {
          key: "series",
          label: t.fields.series,
          breakpoint: "",
          width: "w-[40%] sm:w-[24%] md:w-[16%]",
          strong: true,
          value: (r) => r.series ?? r.maker,
          sub: (r) => formatCapacity(r.capacity),
        },
        {
          key: "maker",
          label: t.fields.maker,
          breakpoint: COL_MD,
          width: "w-0 md:w-[13%]",
          value: (r) => r.maker,
        },
        {
          key: "capacity",
          label: t.fields.capacity,
          breakpoint: COL_SM,
          width: "w-0 sm:w-[14%] md:w-[10%]",
          align: "num",
          value: (r) => formatCapacity(r.capacity),
        },
        {
          key: "batteryFunctionType",
          label: t.fields.batteryFunctionType,
          breakpoint: "",
          width: "w-[28%] sm:w-[16%] md:w-[12%]",
          value: (r) =>
            r.batteryFunctionType ? (t.batteryFunctionTypes[r.batteryFunctionType] ?? null) : null,
        },
        {
          key: "warranty",
          label: t.fields.warranty,
          breakpoint: COL_MD,
          width: "w-0 md:w-[10%]",
          value: (r) => formatWarranty(r.warrantyYears),
        },
        ...priceColumns("w-0 md:w-[12%]", "w-0 sm:w-[26%] md:w-[11%]"),
      ];

    case "ECO_CUTE":
      return [
        {
          key: "series",
          label: t.fields.series,
          breakpoint: "",
          width: "w-[68%] sm:w-[24%] md:w-[18%]",
          strong: true,
          value: (r) => r.series,
          sub: (r) => r.modelNo,
        },
        {
          key: "maker",
          label: t.fields.maker,
          breakpoint: COL_SM,
          width: "w-0 sm:w-[18%] md:w-[17%]",
          value: (r) => r.maker,
        },
        {
          key: "modelNo",
          label: t.fields.modelNo,
          breakpoint: COL_SM,
          width: "w-0 sm:w-[20%] md:w-[18%]",
          value: (r) => r.modelNo,
        },
        ...priceColumns("w-0 md:w-[16%]", "w-0 sm:w-[18%] md:w-[15%]"),
      ];

    // プレゼント品 / その他: 商品名が主。メーカー・型番は任意なので後段へ。
    case "GIFT":
      return [
        {
          key: "name",
          label: t.fields.name,
          breakpoint: "",
          width: "w-[68%] sm:w-[34%] md:w-[30%]",
          strong: true,
          value: (r) => r.name,
          sub: (r) => r.maker || null,
        },
        {
          key: "maker",
          label: t.fields.maker,
          breakpoint: COL_SM,
          width: "w-0 sm:w-[22%] md:w-[20%]",
          value: (r) => r.maker,
        },
        ...priceColumns("w-0 md:w-[17%]", "w-0 sm:w-[24%] md:w-[17%]"),
      ];

    case "OTHER":
      return [
        {
          key: "name",
          label: t.fields.name,
          breakpoint: "",
          width: "w-[68%] sm:w-[26%] md:w-[22%]",
          strong: true,
          value: (r) => r.name,
          sub: (r) => r.maker || r.modelNo,
        },
        {
          key: "maker",
          label: t.fields.maker,
          breakpoint: COL_SM,
          width: "w-0 sm:w-[18%] md:w-[16%]",
          value: (r) => r.maker,
        },
        {
          key: "modelNo",
          label: t.fields.modelNo,
          breakpoint: COL_SM,
          width: "w-0 sm:w-[18%] md:w-[16%]",
          value: (r) => r.modelNo,
        },
        ...priceColumns("w-0 md:w-[15%]", "w-0 sm:w-[18%] md:w-[15%]"),
      ];
  }
}

/** 展開バナーに出す全項目。カテゴリで使わない項目は出さない。 */
function detailFields(row: CatalogProductListItem): { label: string; value: string | null }[] {
  const base: { label: string; value: string | null }[] = [];
  if (row.category === "GIFT" || row.category === "OTHER") {
    base.push({ label: t.fields.name, value: row.name });
  }
  base.push({ label: t.fields.maker, value: row.maker });
  if (row.category !== "GIFT") {
    base.push({ label: t.fields.series, value: row.series });
  }
  if (row.category !== "BT") {
    base.push({ label: t.fields.modelNo, value: row.modelNo });
  }
  if (row.category === "BT") {
    base.push({ label: t.fields.capacity, value: formatCapacity(row.capacity) });
    base.push({
      label: t.fields.batteryFunctionType,
      value: row.batteryFunctionType
        ? (t.batteryFunctionTypes[row.batteryFunctionType] ?? null)
        : null,
    });
    base.push({ label: t.fields.warranty, value: formatWarranty(row.warrantyYears) });
  }
  base.push({ label: t.fields.purchasePrice, value: formatYen(row.purchasePrice) });
  base.push({ label: t.fields.dealerPrice, value: formatYen(row.dealerPrice) });
  base.push({ label: t.fields.note, value: row.note });
  return base;
}

export function CatalogTable({
  category,
  products,
  makerOptions,
}: {
  category: CatalogCategory;
  products: CatalogProductListItem[];
  /** 編集ダイアログのメーカー入力候補（テナント内の既存メーカー）。 */
  makerOptions: string[];
}) {
  // 展開状態は画面上の一時的な UI 状態（保存しない / リロードで閉じる）。
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const columns = columnsFor(category);
  // 列 + 有効 + シェブロン。
  const colSpan = columns.length + 2;

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-hairline-light bg-surface-soft/50 border-b">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`${LIST_TH} ${c.breakpoint} ${c.width} ${c.align === "num" ? "text-right" : ""}`}
              >
                {c.label}
              </th>
            ))}
            {/* 有効 / 無効。チェックだけでは何の列か分からないので見出しを出す。 */}
            <th scope="col" className={`${LIST_TH} ${ACTIVE_WIDTH} text-center`}>
              {t.fields.isActive}
            </th>
            <th className={CHEVRON_WIDTH} aria-hidden />
          </tr>
        </thead>
        <tbody className="divide-hairline-light divide-y">
          {products.map((row) => {
            const isExpanded = expandedId === row.id;
            const bannerId = `catalog-row-detail-${row.id}`;
            const toggle = () => setExpandedId(isExpanded ? null : row.id);

            return [
              <tr
                key={row.id}
                className={`group ${LIST_ROW} ${isExpanded ? "bg-page" : ""}`}
                onClick={toggle}
              >
                {columns.map((c, i) => {
                  const value = c.value(row) ?? labels.customer.none;
                  const cellClass =
                    c.align === "num"
                      ? `${LIST_TD_NUM} text-right`
                      : c.strong
                        ? LIST_TD_STRONG
                        : LIST_TD;
                  return (
                    <td key={c.key} className={`${cellClass} ${c.breakpoint}`} title={value}>
                      {i === 0 ? (
                        // 有効 / 無効は右端のチェックボックスが示すので、
                        // ここにバッジを重ねて出さない。
                        <PrimaryCell main={value} sub={c.sub?.(row) ?? null} />
                      ) : (
                        <span className="block truncate">{value}</span>
                      )}
                    </td>
                  );
                })}
                {/* シェブロンの左。行の展開とは独立した操作なので、
                    セルの中でクリックの伝播を止める（ProductActiveToggle 側）。 */}
                <td className="px-0 py-2.5 text-center align-top">
                  <ProductActiveToggle id={row.id} name={row.name} isActive={row.isActive} />
                </td>
                <td className={LIST_CHEVRON_TD}>
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={bannerId}
                    aria-label={`${row.name} ${isExpanded ? t.expand.close : t.expand.open}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle();
                    }}
                    className={LIST_CHEVRON_BUTTON}
                  >
                    <ChevronDown
                      className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                </td>
              </tr>,

              isExpanded ? (
                <tr key={`${row.id}-detail`} className="bg-surface-soft/40">
                  <td id={bannerId} colSpan={colSpan} className="px-6 py-4">
                    <div className="space-y-4">
                      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 lg:grid-cols-4">
                        {detailFields(row).map((f) => (
                          <StackedField key={f.label} label={f.label} value={f.value} />
                        ))}
                      </dl>
                      {/* 管理操作は展開側に置く（通常行は情報確認に徹する）。 */}
                      <div className="flex items-center justify-end gap-2">
                        <ProductRowActions product={row} makerOptions={makerOptions} />
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
