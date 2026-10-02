// 支払い状態による利用制限のルール（純関数）。
//
// 「どの状態のとき、どの画面を開けるか」をここ 1 か所で決める。
// レイアウトのガードもサイドバーの非活性表示も同じ関数を見るので、
// 「ナビでは押せないのに URL 直打ちだと開ける」というズレが起きない。

import type { BillingStatus } from "./status";

/**
 * 支払い状態が原因で通常機能を止めるか。
 *
 * STRIPE_UNAVAILABLE は止めない。Stripe 側の一時障害や設定漏れで、
 * 支払っている利用者の業務まで巻き添えで停止する方が損害が大きいため
 * （代わりにホームへ「決済状態を確認できません」を出して気付けるようにする）。
 * ACTIVE と同一視しているわけではなく、「決済起因のロックはしない」だけ。
 */
export function isBillingBlocked(status: BillingStatus): boolean {
  return status === "PAYMENT_METHOD_MISSING" || status === "UNPAID";
}

/** 支払い状態にかかわらず開ける画面。ホームと決済管理だけ。 */
const ALWAYS_ALLOWED_PATHS = ["/dashboard", "/payments"] as const;

/**
 * 利用停止中でもこのパスを開けるか。
 *
 * 前方一致で判定する（/payments/... のような下位ページも同じ扱い）。
 * ここに載っていない (wholesaler) 配下の画面はすべてホームへ戻す。
 */
export function isPathAllowedWhileBlocked(pathname: string): boolean {
  return ALWAYS_ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * 利用停止中にナビでその項目を押せるか。
 *
 * href を持たないグループ（イベント管理など）は子の href で判定するので、
 * 呼び出し側が子ごとにこれを使う。
 */
export function isNavHrefAllowedWhileBlocked(href: string): boolean {
  return isPathAllowedWhileBlocked(href);
}
