// 運営管理サイトのレイアウト。
//
// このグループの画面は運営者だけが開ける。middleware でパスを絞ったうえで、
// ここでも毎回 requireSystemAdmin() を通す（画面を隠すだけにしない）。
// 起動バリアントが system-admin でないプロセスでは、そもそもこのパスを通さない。

import { redirect } from "next/navigation";

import { SystemAdminShell } from "@/components/system-admin/system-admin-shell";
import { labels } from "@/lib/i18n/labels";
import { requireSystemAdmin } from "@/lib/system-admin/context";

import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

const t = labels.systemAdmin;

/** 環境区分。NODE_ENV と接続先から素直に決める（作り話をしない）。 */
function environmentLabel(): string {
  const raw = process.env.APP_ENV ?? process.env.NODE_ENV;
  if (!raw) return t.envUnknown;
  if (raw === "production") return t.envProduction;
  if (raw === "development" || raw === "test") return t.envLocal;
  return raw;
}

export default async function SystemAdminLayout({ children }: { children: ReactNode }) {
  let operator;
  try {
    operator = await requireSystemAdmin("system_admin.access");
  } catch {
    // 運営者でない利用者（代理店管理者・パートナー管理者を含む）はサインインへ戻す。
    // 何が足りないかは伝えない（アカウントの探りを与えない）。
    redirect("/login");
  }

  return (
    <SystemAdminShell operatorName={operator.actorName} environment={environmentLabel()}>
      {children}
    </SystemAdminShell>
  );
}
