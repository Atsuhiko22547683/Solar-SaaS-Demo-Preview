// Next.js middleware — request id issuance (T-01-11, docs/05 §10.1).
//
// Every request gets an `x-request-id` header so downstream Route Handlers /
// Server Actions / pino logs can correlate. If the caller already supplied
// one (e.g. a load balancer or Sentry frontend) we honor it.
//
// SP-01 scope: only stamp the header. Actually wrapping each handler in
// `withRequestContext()` so `getLogger()` auto-binds the id is wired in
// SP-02 (alongside the auth-aware handler factory). The header itself is
// already useful — UptimeRobot / curl users can include it in support
// tickets, and the worker propagates it through job payloads.
//
// Why Edge is fine here: AsyncLocalStorage is **not** used in the middleware
// itself, only crypto.randomUUID (web crypto) and Headers manipulation —
// both available on the Edge runtime. The downstream wrap will run in Node
// (Route Handler / Server Action default).

import { NextResponse, type NextRequest } from "next/server";

import {
  homePathForVariant,
  isPathAllowedForVariant,
  resolveAppVariant,
  sessionCookieNames,
} from "@/lib/app-variant";

const REQUEST_ID_HEADER = "x-request-id";
// Server Component（レイアウト）から今どのパスを描いているかを知るためのヘッダ。
// layout は pathname を受け取れないので、Edge で分かるここから渡す。
// 決済状態による利用制限のガードが (wholesaler)/layout.tsx でこれを読む。
const PATHNAME_HEADER = "x-pathname";
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9-_]{8,128}$/;

// 実行バリアント（一次代理店 / 二次店スタッフ / 二次店管理者）。
// Railway では APP_VARIANT で切り替える。Edge で判定できる純関数なので、
// ここで先に弾いて不要なレンダリングを避ける。
// 認可そのものはこの先のサーバー側（レイアウト / Server Action）でも行う。
//
// 値域外の APP_VARIANT はここで例外になり、プロセスが起動しない。
// 打ち間違いが「別のサイトとして公開される」事故にならないようにしている。
const VARIANT = resolveAppVariant();

// セッション Cookie 名はサイトごとに違う（lib/auth-cookies.ts と対になる）。
// ここで別サイトの Cookie を見てしまうと、ログインしていない利用者を通してしまう。
const SESSION_COOKIES = sessionCookieNames(VARIANT);

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/reset",
  "/invite",
  "/api/auth",
  "/api/health",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const inbound = req.headers.get(REQUEST_ID_HEADER);
  const requestId = inbound && REQUEST_ID_PATTERN.test(inbound) ? inbound : crypto.randomUUID();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  requestHeaders.set(PATHNAME_HEADER, pathname);

  // Auth guard: check for session cookie (Edge-safe, no native modules)
  if (!isPublicPath(pathname)) {
    const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));
    if (!hasSession) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      const redirectRes = NextResponse.redirect(loginUrl);
      redirectRes.headers.set(REQUEST_ID_HEADER, requestId);
      return redirectRes;
    }
  }

  // バリアント外の画面は開かせない（二次店環境から代理店画面、その逆とも）。
  // 画面を隠すだけでは URL 直打ちで到達できてしまうため、ここで経路ごと塞ぐ。
  if (!isPathAllowedForVariant(VARIANT, pathname)) {
    const homeUrl = new URL(homePathForVariant(VARIANT), req.url);
    const redirectRes = NextResponse.redirect(homeUrl);
    redirectRes.headers.set(REQUEST_ID_HEADER, requestId);
    return redirectRes;
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set(REQUEST_ID_HEADER, requestId);
  return res;
}

// Skip static assets / internal Next paths. `api/auth/*` is Auth.js — we
// still want a request id there for login-failure debugging.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|webmanifest)$).*)",
  ],
};
