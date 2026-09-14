// 実行バリアント（代理店 / 二次店）。
//
// 同じ Next.js アプリを Railway の 2 サービスとして起動し、環境変数 APP_VARIANT で
// 公開する画面を切り替える。コードベースは 1 つのまま、URL と実行環境だけを分ける。
//
//   未設定 or "agency"  … 既存の代理店向け環境（既存挙動そのまま・後方互換）
//   "partner"           … 二次店専用環境。Partner の 4 領域だけを公開する
//
// "use client" は付けない — 純関数なので Server Component・middleware・
// テストのどこからでも呼べるようにする。判定規則をここ 1 か所に置き、
// middleware（Edge）とレイアウト（Node）が同じ関数を見る。

export type AppVariant = "agency" | "partner";

/** 現在の実行バリアント。値域外は既存挙動（agency）へ倒す。 */
export function resolveAppVariant(raw: string | undefined = process.env.APP_VARIANT): AppVariant {
  return raw?.trim() === "partner" ? "partner" : "agency";
}

export function isPartnerVariant(): boolean {
  return resolveAppVariant() === "partner";
}

/**
 * 二次店ポータルのパス接頭辞。
 *
 * 既存の二次店画面（/d-*）とは別系統にする。あちらは代理店環境に同居する
 * 二次店向け業務画面で、こちらは Google フォーム置き換えに絞った別環境のため。
 */
export const PARTNER_PATH_PREFIX = "/p-";

/** 認証前でも通すパス（両バリアント共通）。 */
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
 * partner 環境で開けるパスか。
 *
 * 公開するのは Partner の 4 領域（トップ / アポイント / 催事日報 / 販売員）と、
 * 認証まわり・ヘルスチェックだけ。代理店向けの画面はすべて閉じる。
 * 「画面を隠す」のではなく、ここで通さないことで URL 直打ちも塞ぐ。
 */
export function isAllowedInPartner(pathname: string): boolean {
  if (pathname === "/") return true; // ロールに応じた振り分け先へ送るだけ
  if (isPublicPath(pathname)) return true;
  if (pathname.startsWith(PARTNER_PATH_PREFIX)) return true;
  // アカウント自身の操作（プロフィール / サインアウト）は環境を問わず必要。
  if (pathname === "/profile" || pathname.startsWith("/profile/")) return true;
  return false;
}

/**
 * agency 環境で開けるパスか。
 *
 * Partner 専用画面だけを閉じる。それ以外は既存のまま一切変えない。
 */
export function isAllowedInAgency(pathname: string): boolean {
  return !pathname.startsWith(PARTNER_PATH_PREFIX);
}

/** バリアントとパスの組み合わせが許されるか。 */
export function isPathAllowedForVariant(variant: AppVariant, pathname: string): boolean {
  return variant === "partner" ? isAllowedInPartner(pathname) : isAllowedInAgency(pathname);
}

/** そのバリアントでのホーム。 */
export function homePathForVariant(variant: AppVariant): string {
  return variant === "partner" ? "/p-home" : "/dashboard";
}
