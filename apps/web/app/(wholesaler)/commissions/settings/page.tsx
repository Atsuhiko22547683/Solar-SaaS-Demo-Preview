// 手数料設定 — 二次店ごとのインセンティブ率（トスアップ / クロージング）を設定する。
//
// DB-backed (DealerCommissionRate / DealerCommissionRateChange). 未保存の関係は
// loader 側でデフォルト値を返すので、初回保存で row + 履歴 1 行が作成される。

import { labels } from "@/lib/i18n/labels";

import { listDealerRateSettings } from "./data";
import { SettingsPanel } from "./settings-panel";

export const dynamic = "force-dynamic";

export default async function CommissionSettingsPage() {
  const t = labels.commission.settings;
  const dealers = await listDealerRateSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-ink text-xl font-bold">{t.title}</h1>
        <p className="text-body-light mt-1 text-sm">{t.subtitle}</p>
      </div>

      <SettingsPanel dealers={dealers} />
    </div>
  );
}
