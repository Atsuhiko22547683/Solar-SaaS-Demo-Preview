// Stripe ダッシュボードを新しいタブで開くリンク。
//
// URL は lib/config/stripe.ts が唯一の情報源。ここには直書きしない。
// Stripe API へのリクエストは一切行わない（外部リンクを開くだけ）。

import { ExternalLink } from "lucide-react";

export function StripeLinkButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="border-hairline-light text-ink hover:bg-surface-soft/60 inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium"
    >
      {label}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}
