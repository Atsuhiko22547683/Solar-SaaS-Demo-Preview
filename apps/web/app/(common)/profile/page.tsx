// Profile page — common for all roles.
// Shows display name, email, role list, 2FA status.

import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { labels } from "@/lib/i18n/labels";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const t = labels.profile;
  const user = session.user;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-ink text-xl font-bold">{t.title}</h1>
        <p className="text-mute-light mt-1 text-sm">{t.subtitle}</p>
      </div>

      <Card className="space-y-4 p-6">
        <dl className="grid grid-cols-[8rem_1fr] gap-y-3 text-sm">
          <dt className="text-mute-light">{t.fields.displayName}</dt>
          <dd className="text-ink">{user.name ?? "—"}</dd>

          <dt className="text-mute-light">{t.fields.email}</dt>
          <dd className="text-ink">{user.email ?? "—"}</dd>

          <dt className="text-mute-light">{t.fields.role}</dt>
          <dd className="text-ink">{(user.roles ?? []).join(", ") || "—"}</dd>

          <dt className="text-mute-light">{t.fields.twoFaStatus}</dt>
          <dd className="text-ink">{user.mfaSetupRequired ? t.twoFa.disabled : t.twoFa.enabled}</dd>
        </dl>
      </Card>

      <Button asChild variant="outline">
        <Link href="/profile/password">{t.changePassword}</Link>
      </Button>
    </div>
  );
}
