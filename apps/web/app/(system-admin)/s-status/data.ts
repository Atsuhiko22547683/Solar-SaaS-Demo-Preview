// 稼働状況の取得。
//
// 監視基盤は新設しない。画面を開いたときに、その場で
//   - 各サイトの /api/health（既存）
//   - データベース（health と同じ経路）
//   - 実装済みの外部連携が「設定されているか」
// を確かめて出すだけ。
//
// 取れない情報は「未取得」、設定が無いものは「未連携」と出す。
// 根拠なく「正常」「0 件」とは書かない。

import "server-only";

import { siteBaseUrl } from "@/lib/site-urls";
import { requireSystemAdmin } from "@/lib/system-admin/context";
import { withTenant } from "@/lib/tenancy/with-tenant";

import type { AppVariant } from "@/lib/app-variant";

export type StatusState = "up" | "down" | "unknown" | "notConnected";

export interface StatusRow {
  key: string;
  name: string;
  state: StatusState;
  /** 取得できた内容・エラー概要。無ければ null。 */
  detail: string | null;
}

export interface StatusResult {
  checkedAt: string;
  sites: StatusRow[];
  db: StatusRow;
  integrations: StatusRow[];
}

const SITES: { key: AppVariant; name: string }[] = [
  { key: "agency", name: "代理店サイト" },
  { key: "partner", name: "パートナースタッフサイト" },
  { key: "partner-admin", name: "パートナー管理者サイト" },
  { key: "system-admin", name: "運営管理サイト" },
];

const PROBE_TIMEOUT_MS = 3_000;

/** 1 サイトぶんの health 確認。応答しない・壊れている場合は理由を残す。 */
async function probeSite(base: string, name: string, key: string): Promise<StatusRow> {
  const url = `${base}/api/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { cache: "no-store", signal: controller.signal });
    const text = await res.text();
    let body: { ok?: boolean; db?: string; error?: string } = {};
    try {
      body = JSON.parse(text) as typeof body;
    } catch {
      // JSON でない応答（プロキシのエラーページ等）はそのまま概要に出す。
      return { key, name, state: "down", detail: `HTTP ${res.status}: ${text.slice(0, 120)}` };
    }
    if (res.ok && body.ok) {
      return { key, name, state: "up", detail: `HTTP ${res.status} / db=${body.db ?? "—"}` };
    }
    return {
      key,
      name,
      state: "down",
      detail: `HTTP ${res.status} / db=${body.db ?? "—"}${body.error ? ` / ${body.error}` : ""}`,
    };
  } catch (err) {
    // 起動していない・到達できない。「正常」とは書かない。
    const reason = err instanceof Error ? err.message : String(err);
    return { key, name, state: "unknown", detail: reason.slice(0, 160) };
  } finally {
    clearTimeout(timer);
  }
}

/** 環境変数が実値として設定されているか（未設定・プレースホルダは未連携）。 */
function configured(value: string | undefined): boolean {
  const v = value?.trim();
  if (!v) return false;
  return !/^(changeme|placeholder|your-|dummy|test)/i.test(v);
}

export async function getStatus(): Promise<StatusResult> {
  const { ctx } = await requireSystemAdmin("system_admin.status.read");

  const sites = await Promise.all(SITES.map((s) => probeSite(siteBaseUrl(s.key), s.name, s.key)));

  // DB は health と同じ経路で確かめる（この画面のためだけの別経路を作らない）。
  let db: StatusRow;
  try {
    const started = Date.now();
    await withTenant(ctx, (tx) => tx.$queryRaw`SELECT 1`);
    db = {
      key: "db",
      name: "PostgreSQL",
      state: "up",
      detail: `応答 ${Date.now() - started}ms`,
    };
  } catch (err) {
    db = {
      key: "db",
      name: "PostgreSQL",
      state: "down",
      detail: (err instanceof Error ? err.message : String(err)).slice(0, 160),
    };
  }

  // 外部連携は「設定されているか」までを見る。実際の疎通確認はここでは行わない
  // （送信・アップロードを副作用として起こさないため）。設定が無ければ未連携。
  const integrations: StatusRow[] = [
    {
      key: "email",
      name: "メール送信（Resend）",
      state: configured(process.env.RESEND_API_KEY) ? "up" : "notConnected",
      detail: configured(process.env.RESEND_API_KEY)
        ? "APIキーが設定されています（疎通確認は行っていません）"
        : "APIキーが未設定のため、メールは送信されません",
    },
    {
      key: "storage",
      name: "オブジェクトストレージ（Cloudflare R2）",
      state: configured(process.env.R2_ACCOUNT_ID) ? "up" : "notConnected",
      detail: configured(process.env.R2_ACCOUNT_ID)
        ? "接続情報が設定されています（疎通確認は行っていません）"
        : "接続情報が未設定です",
    },
    {
      key: "sentry",
      name: "エラー監視（Sentry）",
      state: configured(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN)
        ? "up"
        : "notConnected",
      detail: configured(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN)
        ? "DSN が設定されています（疎通確認は行っていません）"
        : "DSN が未設定です",
    },
  ];

  return { checkedAt: new Date().toISOString(), sites, db, integrations };
}
