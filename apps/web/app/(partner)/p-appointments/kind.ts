// アポイント区分と URL クエリの対応。
//
// URL は読みやすい `?type=first-visit` / `?type=visit`、DB は Prisma の
// PartnerAppointmentKind（FIRST_VISIT / VISIT）。変換をここ 1 か所に置き、
// 画面・Server Action・テストが同じ表を見るようにする。
//
// "use client" は付けない — Server Component からも Client Component からも
// import する純粋な定数・関数。

import type { PartnerAppointmentKind } from "@solar/contracts";

export const PARTNER_KIND_PARAMS = ["first-visit", "visit"] as const;
export type PartnerAppointmentKindParam = (typeof PARTNER_KIND_PARAMS)[number];

export const KIND_PARAM_TO_KIND: Record<PartnerAppointmentKindParam, PartnerAppointmentKind> = {
  "first-visit": "FIRST_VISIT",
  visit: "VISIT",
};

/** 既定は初訪アポ（フォーム①）。値域外は既定へ倒し、404 にはしない。 */
export function resolveKindParam(raw: string | string[] | undefined): PartnerAppointmentKindParam {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return PARTNER_KIND_PARAMS.find((p) => p === value) ?? "first-visit";
}
