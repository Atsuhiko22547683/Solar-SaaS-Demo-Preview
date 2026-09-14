import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { isPartnerVariant } from "@/lib/app-variant";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { roles, isSaasAdmin } = session.user;
  const isDealer = roles.some((r) => r === "DEALER_ADMIN" || r === "DEALER_STAFF");

  // 二次店専用環境。二次店アカウントは Partner ホームへ、それ以外は
  // 「この環境は二次店専用」と分かる案内へ送る（黙って 404 にしない）。
  if (isPartnerVariant()) {
    redirect(isDealer ? "/p-home" : "/p-home/unavailable");
  }

  if (isSaasAdmin) {
    redirect("/saas-admin-dashboard");
  }

  if (isDealer) {
    redirect("/d-dashboard");
  }

  redirect("/dashboard");
}
