// 二次店サイトの利用区分。
//
// 「どのサイトで動いているか（APP_VARIANT）」と「利用者のロール」の両方で決まる。
// ロールだけでは決めない — 管理者ロールの利用者がスタッフサイトを開いたときに、
// 自社全件が見える管理者表示へ勝手に切り替わらないようにするため。
//
//   スタッフサイト（APP_VARIANT=partner）       … DEALER_STAFF が利用対象
//   管理者サイト（APP_VARIANT=partner-admin）   … DEALER_ADMIN が利用対象
//
// どちらのサイトでも、利用対象でないロールは null（＝そのサイトの対象外）。
// 呼び出し側は案内ページを出すか、ForbiddenError で落とす。
//
// "use client" も "server-only" も付けない — レイアウト（Server）と画面枠（Client）の
// 両方から同じ判定を使うための純関数。

import type { PartnerSite } from "@/lib/app-variant";

export type PartnerRole = "ADMIN" | "STAFF";

/**
 * そのサイトでの利用区分。対象外なら null。
 *
 * 管理者ロールしか持たない利用者はスタッフサイトの対象外、
 * スタッフロールしか持たない利用者は管理者サイトの対象外になる。
 * 両方のロールを持つ利用者は、開いているサイトの区分で動く。
 */
export function partnerRoleForSite(
  site: PartnerSite,
  roles: readonly string[],
): PartnerRole | null {
  if (site === "ADMIN") return roles.includes("DEALER_ADMIN") ? "ADMIN" : null;
  return roles.includes("DEALER_STAFF") ? "STAFF" : null;
}

/** そのサイトを利用できるロールを持っているか。 */
export function canUsePartnerSite(site: PartnerSite, roles: readonly string[]): boolean {
  return partnerRoleForSite(site, roles) !== null;
}
