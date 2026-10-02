// Auth.js v5 root — instantiates `NextAuth(authConfig)` at the app boundary
// and exports the handlers / helpers consumed by:
//   - app/api/auth/[...nextauth]/route.ts  (`handlers`)
//   - middleware.ts                         (`auth`)
//   - Server Actions / Route Handlers       (`auth`, `signIn`, `signOut`)
//
// The shared config lives in `@solar/auth` so it can be reused by the worker
// process if/when it needs to mint short-lived service tokens.
//
// Cookie 名だけはサイト（APP_VARIANT）ごとに変える。3 サイトを同じブラウザで
// 同時に使えるようにするため（lib/auth-cookies.ts）。それ以外の設定は共通。

import { authConfig } from "@solar/auth/config";
import NextAuth from "next-auth";

import { authCookieConfig } from "@/lib/auth-cookies";

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  cookies: authCookieConfig(),
});
