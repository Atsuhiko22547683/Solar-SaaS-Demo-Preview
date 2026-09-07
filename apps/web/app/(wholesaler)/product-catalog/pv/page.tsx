// 製品カタログ > PVカタログ — 中身は未実装のプレースホルダー。

import { Card } from "@/components/ui/card";
import { labels } from "@/lib/i18n/labels";

export const dynamic = "force-dynamic";

export default function PvCatalogPage() {
  const t = labels.productCatalog;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-ink text-xl font-bold">{t.pv.title}</h1>
        <p className="text-mute-light mt-1 text-sm">{t.pv.subtitle}</p>
      </div>
      <Card className="p-12 text-center">
        <p className="text-ink font-medium">{t.placeholderTitle}</p>
        <p className="text-mute-light mt-2 text-sm">{t.placeholderBody}</p>
      </Card>
    </div>
  );
}
