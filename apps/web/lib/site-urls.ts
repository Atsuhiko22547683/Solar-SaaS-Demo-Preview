// サイトごとの公開 URL（招待リンク・別サイトへの案内リンクの生成元）。
//
// 各サイトは別プロセス・別 URL で動くので、「いま動いているサイトの URL」を
// そのまま他サイトのリンクに使ってはいけない。招待リンクは招待する利用区分の
// サイトへ向ける（スタッフ招待 → スタッフサイト、管理者招待 → 管理者サイト）。
//
// 値は環境変数から取る。未設定ならローカルの既定ポートへ倒し、ローカルだけで
// 検証できるようにする。値域外（http/https 以外、URL として壊れている）は
// 転送先として使わず、既定へ倒す — 環境変数の設定ミスが不正な転送先になる方が
// 「リンクが localhost を指している」より危険なため。

import "server-only";

import { resolveAppVariant, type AppVariant } from "./app-variant";

/** ローカルの既定ポート。docs と package.json のスクリプトと揃える。 */
const LOCAL_DEFAULTS: Record<AppVariant, string> = {
  agency: "http://localhost:3100",
  partner: "http://localhost:3200",
  "partner-admin": "http://localhost:3300",
  "system-admin": "http://localhost:3400",
};

/** サイトごとの環境変数名。Railway では各サービスに自分の URL を設定する。 */
const ENV_KEYS: Record<AppVariant, string> = {
  agency: "AGENCY_APP_URL",
  partner: "PARTNER_APP_URL",
  "partner-admin": "PARTNER_ADMIN_APP_URL",
  "system-admin": "SYSTEM_ADMIN_APP_URL",
};

function normalize(raw: string | undefined, fallback: string): string {
  const value = raw?.trim();
  if (!value) return fallback;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
    return value.replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

/** そのサイトのベース URL（末尾スラッシュなし）。 */
export function siteBaseUrl(variant: AppVariant): string {
  return normalize(process.env[ENV_KEYS[variant]], LOCAL_DEFAULTS[variant]);
}

/** 二次店の利用区分に対応するサイトのベース URL。 */
export function dealerSiteBaseUrl(role: "DEALER_ADMIN" | "DEALER_STAFF"): string {
  return siteBaseUrl(role === "DEALER_ADMIN" ? "partner-admin" : "partner");
}

/** 招待リンク。受け取り手が使うサイトの /invite/<token> を指す。 */
export function inviteUrlFor(role: "DEALER_ADMIN" | "DEALER_STAFF", token: string): string {
  return `${dealerSiteBaseUrl(role)}/invite/${token}`;
}

/** いま動いているサイトのベース URL。 */
export function currentSiteBaseUrl(): string {
  return siteBaseUrl(resolveAppVariant());
}
