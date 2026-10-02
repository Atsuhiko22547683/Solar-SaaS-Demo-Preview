// サイトごとの認証 Cookie 名。
//
// 3 サイトは同じ Auth.js 設定を共有するが、Cookie 名まで同じだと
// ローカル（localhost:3200 / :3300 は Cookie 上は同じサイト）で片方に
// ログインするともう片方のセッションが上書きされてしまう。
// 接頭辞をサイトごとに変えて、同じブラウザで同時にログインできるようにする。
//
// 親ドメインへ Cookie を広げる（domain 指定）ことはしない。各サイトは自分の
// ホストにだけ Cookie を置き、SSO は行わない（今回の要件どおり）。
//
// 代理店サイトの接頭辞は従来どおり "authjs" なので、既存セッションは切れない。

import { authCookiePrefix } from "./app-variant";

import type { NextAuthConfig } from "next-auth";

type CookiesOption = NonNullable<NextAuthConfig["cookies"]>;

/**
 * Auth.js の既定 Cookie 設定に、サイトごとの接頭辞を付けたもの。
 * オプション（httpOnly / sameSite / path / secure）は Auth.js の既定と同じにする。
 */
export function authCookieConfig(): CookiesOption {
  const prefix = authCookiePrefix();
  const useSecure = process.env.NODE_ENV === "production";
  const securePrefix = useSecure ? "__Secure-" : "";
  const base = { httpOnly: true, sameSite: "lax", path: "/", secure: useSecure } as const;

  return {
    sessionToken: { name: `${securePrefix}${prefix}.session-token`, options: { ...base } },
    callbackUrl: {
      name: `${securePrefix}${prefix}.callback-url`,
      options: { sameSite: "lax", path: "/", secure: useSecure },
    },
    csrfToken: {
      // __Host- は domain を持てず path=/ 固定。サイト間で確実に分離される。
      name: `${useSecure ? "__Host-" : ""}${prefix}.csrf-token`,
      options: { ...base },
    },
    pkceCodeVerifier: {
      name: `${securePrefix}${prefix}.pkce.code_verifier`,
      options: { ...base, maxAge: 900 },
    },
    state: { name: `${securePrefix}${prefix}.state`, options: { ...base, maxAge: 900 } },
    nonce: { name: `${securePrefix}${prefix}.nonce`, options: { ...base } },
  };
}
