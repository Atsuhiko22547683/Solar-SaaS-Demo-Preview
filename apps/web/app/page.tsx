import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { isPartnerVariant, resolveAppVariant } from "@/lib/app-variant";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { roles, isSaasAdmin } = session.user;
  const isDealer = roles.some((r) => r === "DEALER_ADMIN" || r === "DEALER_STAFF");

  // 運営管理サイトは運営管理のトップへ送る。運営者でなければ
  // (system-admin)/layout.tsx がサインインへ戻す。
  if (resolveAppVariant() === "system-admin") {
    redirect("/s-dashboard");
  }

  // 二次店サイト（スタッフ / 管理者）はどちらも Partner ホームへ送る。
  // そのサイトの利用対象でない場合は (partner)/layout.tsx が案内を出す
  // （黙って 404 にせず、正しいサイトへの入口を見せる）。
  if (isPartnerVariant()) {
    redirect("/p-home");
  }

  if (isSaasAdmin) {
    redirect("/saas-admin-dashboard");
  }

  if (isDealer) {
    redirect("/d-dashboard");
  }

  redirect("/dashboard");
}
