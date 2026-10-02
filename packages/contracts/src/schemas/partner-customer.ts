// 二次店管理者が自社顧客を編集するときの入力スキーマ。
//
// 代理店側の CustomerUpdateSchema（60 列超）とは別に持つ。あちらは電気契約・
// 設備・契約・施工・補助金など代理店の業務項目まで含むが、二次店ポータルで
// 触れるのは「連絡先・住所・担当者・ステータス・備考」だけ。
// `.strict()` にしてあるので、範囲外の列を送っても黙って通ることはない。
//
// wholesalerId / ownerRelationshipId / registeredBy* は入力に含めない。
// 所属はサーバー側（requirePartnerContext）が決める。

import { z } from "zod";

import { CustomerStatusEnum } from "./customer.js";

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const PartnerCustomerUpdateSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1, "お客様名を入力してください").max(255),
    kana: optionalText(255),
    /** 主たる電話番号（Customer.phone は必須列）。 */
    phone: z.string().trim().min(1, "電話番号を入力してください").max(50),
    landlinePhone: optionalText(50),
    mobilePhone: optionalText(50),
    postalCode: optionalText(20),
    prefecture: optionalText(20),
    city: optionalText(100),
    addressLine: optionalText(255),
    status: CustomerStatusEnum,
    /** 担当販売員。自社の販売員だけを指定できる（サーバー側で再確認する）。 */
    tossUpSalespersonId: z.string().min(1).nullable().optional(),
    closingSalespersonId: z.string().min(1).nullable().optional(),
    note: optionalText(2000),
  })
  .strict();
export type PartnerCustomerUpdateInput = z.input<typeof PartnerCustomerUpdateSchema>;

/**
 * 削除。誤操作を減らすため、確認欄に入力されたお客様名も一緒に送る。
 * 一致確認はサーバー側（DB の値との突き合わせ）で行う。
 */
export const PartnerCustomerDeleteSchema = z
  .object({
    id: z.string().min(1),
    confirmName: z.string().trim().min(1, "お客様名を入力してください").max(255),
  })
  .strict();
export type PartnerCustomerDeleteInput = z.input<typeof PartnerCustomerDeleteSchema>;
