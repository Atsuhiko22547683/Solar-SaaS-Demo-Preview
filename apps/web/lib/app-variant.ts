// 実行バリアント（＝どのサイトとして起動しているか）。
//
// 同じ Next.js アプリを複数プロセスとして起動し、環境変数 APP_VARIANT で
// 公開する画面・入口・Cookie を切り替える。コードベースと DB は 1 つのまま、
// サイト（URL と稼働プロセス）だけを分ける。
//
//   "agency"（既定 / 未設定）… 一次代理店サイト。既存挙動そのまま
//   "partner"                … 二次店スタッフサイト（6 業務）
//   "partner-admin"          … 二次店管理者サイト（9 業務）
//   "system-admin"           … システム提供者の運営管理サイト（6 メニュー）
//
// サイト区分はサーバーの起動設定だけで決まる。URL クエリやリクエストヘッダから
// 切り替える経路は用意しない。値域外の APP_VARIANT は「別のサイトとして起動して
// しまう」事故になるので、黙って倒さず起動時に落とす。
//
// "use client" は付けない — 純関数なので Server Component・middleware・
// テストのどこからでも呼べるようにする。判定規則をここ 1 か所に置き、
// middleware（Edge）とレイアウト（Node）が同じ関数を見る。

export const APP_VARIANTS = ["agency", "partner", "partner-admin", "system-admin"] as const;
export type AppVariant = (typeof APP_VARIANTS)[number];

/** 二次店サイトの区分。データの見える範囲（本人 / 自社）を決める。 */
export type PartnerSite = "STAFF" | "ADMIN";

/**
 * 現在の実行バリアント。
 *
 * 未設定は "agency"（既存環境との互換。従来も未設定＝代理店だった）。
 * 値が入っているのに値域外なら、起動を止める。"partner-admn" のような打ち間違いが
 * 一次代理店サイトとして公開されるのが最悪の失敗なので、そこへは倒さない。
 */
export function resolveAppVariant(raw: string | undefined = process.env.APP_VARIANT): AppVariant {
  const value = raw?.trim();
  if (!value) return "agency";
  const found = APP_VARIANTS.find((v) => v === value);
  if (!found) {
    throw new Error(
      `APP_VARIANT の値が不正です: "${value}"。${APP_VARIANTS.join(" / ")} のいずれかを指定してください。`,
    );
  }
  return found;
}

/** 二次店サイト（スタッフ / 管理者）のいずれかか。 */
export function isPartnerVariant(variant: AppVariant = resolveAppVariant()): boolean {
  return variant === "partner" || variant === "partner-admin";
}

/** 二次店サイトの区分。代理店サイトなら null。 */
export function partnerSiteFor(variant: AppVariant = resolveAppVariant()): PartnerSite | null {
  if (variant === "partner") return "STAFF";
  if (variant === "partner-admin") return "ADMIN";
  return null;
}

/**
 * 認証 Cookie の接頭辞。
 *
 * ローカルでは Cookie がポートで分離されない（localhost:3200 と :3300 は同じサイト
 * 扱い）。名前を分けないと、片方へログインするともう片方のセッションが消える。
 * 本番でサブドメインを分ける場合も、名前が違えば取り違えが起きない
 * （親ドメインへ Cookie を広げる設定は使わない）。
 *
 * 代理店サイトは従来どおり "authjs" のままにして、既存セッションを切らない。
 */
export function authCookiePrefix(variant: AppVariant = resolveAppVariant()): string {
  if (variant === "partner") return "partner-authjs";
  if (variant === "partner-admin") return "partner-admin-authjs";
  if (variant === "system-admin") return "system-admin-authjs";
  return "authjs";
}

/** middleware が見るセッション Cookie 名（非 Secure / Secure の 2 つ）。 */
export function sessionCookieNames(variant: AppVariant = resolveAppVariant()): string[] {
  const prefix = authCookiePrefix(variant);
  return [`${prefix}.session-token`, `__Secure-${prefix}.session-token`];
}

/**
 * 二次店ポータルのパス接頭辞。
 *
 * 既存の二次店画面（/d-*）とは別系統にする。あちらは代理店環境に同居する
 * 二次店向け業務画面で、こちらは Google フォーム置き換えに絞った別サイトのため。
 */
export const PARTNER_PATH_PREFIX = "/p-";

/**
 * 運営管理サイトのパス接頭辞。
 *
 * 既存の SaaS 運営画面（/tenants /plans 等・代理店サイトに同居）とは別系統にする。
 * 運営管理サイトはこの接頭辞の画面だけを公開し、他サイトはこの接頭辞を通さない。
 */
export const SYSTEM_ADMIN_PATH_PREFIX = "/s-";

/** 運営管理サイトで公開するメニュー（6 つ）。 */
export const SYSTEM_ADMIN_PREFIXES = [
  "/s-dashboard",
  "/s-companies",
  "/s-users",
  "/s-operators",
  "/s-audit",
  "/s-status",
] as const;

/** 認証前でも通すパス（全サイト共通）。 */
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/reset",
  "/invite",
  "/api/auth",
  "/api/health",
] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * 二次店スタッフサイトで公開する業務（6 業務）＋個人設定。
 * 管理者向けの画面（販売員 / アカウント / 手数料 / 希望ライン）はここに無い。
 */
export const PARTNER_STAFF_PREFIXES = [
  "/p-home",
  "/p-appointments",
  "/p-contracts",
  "/p-reports",
  "/p-catalog",
  "/p-customers",
  "/p-shifts",
  // 本人の販売員情報の確認・変更。他人の情報は対象にならない。
  "/p-profile",
] as const;

/**
 * 二次店管理者サイトで公開する業務（9 業務）。
 * カタログはスタッフ向けの閲覧機能なのでここには無い。
 */
export const PARTNER_ADMIN_PREFIXES = [
  "/p-home",
  "/p-profile",
  "/p-appointments",
  "/p-contracts",
  "/p-reports",
  "/p-salespeople",
  "/p-accounts",
  "/p-commissions",
  "/p-customers",
  "/p-lane-preferences",
  "/p-consultations",
  "/p-shifts",
] as const;

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** アカウント自身の操作（プロフィール / サインアウト）はサイトを問わず必要。 */
function isSelfServicePath(pathname: string): boolean {
  return pathname === "/profile" || pathname.startsWith("/profile/");
}

/**
 * 二次店サイトで開けるパスか。
 *
 * 「画面を隠す」のではなく、ここで通さないことで URL 直打ちも塞ぐ。
 * スタッフサイトと管理者サイトで公開範囲が違うので、site ごとに表を分ける。
 */
export function isAllowedInPartnerSite(site: PartnerSite, pathname: string): boolean {
  if (pathname === "/") return true; // サイトのホームへ振り分けるだけ
  if (isPublicPath(pathname)) return true;
  if (isSelfServicePath(pathname)) return true;
  return matchesPrefix(
    pathname,
    site === "ADMIN" ? PARTNER_ADMIN_PREFIXES : PARTNER_STAFF_PREFIXES,
  );
}

/**
 * agency 環境で開けるパスか。
 *
 * Partner 専用画面だけを閉じる。それ以外は既存のまま一切変えない。
 */
export function isAllowedInAgency(pathname: string): boolean {
  return (
    !pathname.startsWith(PARTNER_PATH_PREFIX) && !pathname.startsWith(SYSTEM_ADMIN_PATH_PREFIX)
  );
}

/**
 * 運営管理サイトで開けるパスか。
 *
 * 公開するのは 6 メニューだけ。既存の業務画面（代理店 / 二次店）は開かせない
 * ——「画面を隠す」のではなく、ここで通さないことで URL 直打ちも塞ぐ。
 */
export function isAllowedInSystemAdminSite(pathname: string): boolean {
  if (pathname === "/") return true; // サイトのホームへ振り分けるだけ
  if (isPublicPath(pathname)) return true;
  if (isSelfServicePath(pathname)) return true;
  return matchesPrefix(pathname, SYSTEM_ADMIN_PREFIXES);
}

/** バリアントとパスの組み合わせが許されるか。 */
export function isPathAllowedForVariant(variant: AppVariant, pathname: string): boolean {
  if (variant === "system-admin") return isAllowedInSystemAdminSite(pathname);
  const site = partnerSiteFor(variant);
  return site ? isAllowedInPartnerSite(site, pathname) : isAllowedInAgency(pathname);
}

/** そのサイトでのホーム。 */
export function homePathForVariant(variant: AppVariant): string {
  if (variant === "system-admin") return "/s-dashboard";
  return isPartnerVariant(variant) ? "/p-home" : "/dashboard";
}
