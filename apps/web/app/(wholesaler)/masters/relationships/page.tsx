import { Breadcrumb } from "@/components/ui/breadcrumb";
import { labels } from "@/lib/i18n/labels";
import { assertSettingsAccess } from "@/lib/permissions/settings-guard";

import { listRelationships } from "./data";
import { CreateRelationshipDialog, DeleteRelationshipButton } from "./relationship-actions";
import { RelationshipRow } from "./relationship-row";

// /masters/relationships — 取引先一覧マスタ（設定配下の独立画面）。
// 既存の Relationship 行（招待コード経由でサインアップ済みの取引先を含む）を一覧
// 表示し、ステータス / 対応範囲 / 備考をインライン編集する。追加と削除も
// ここから行う（削除は物理削除ではなく status = TERMINATED の論理削除）。

export const dynamic = "force-dynamic";

export default async function RelationshipsMasterPage() {
  // 設定配下は OWNER / SYSTEM_ADMIN のみ。URL 直打ちもここで 403 にする。
  await assertSettingsAccess();

  const rows = await listRelationships();
  const t = labels.dealerRelationships;
  const bc = labels.breadcrumb.items;

  return (
    <div className="space-y-6">
      {/* この画面はサイドバーの「設定 > 取引先管理」から直接開く独立した画面で、
          「エリア・場所管理」の配下ではない。以前はパンくずと「← 戻る」が
          /masters をこの画面の親として示しており、サイドバーの階層と矛盾していた。
          戻り導線もパンくずと重複していたため、パンくずだけに一本化する。 */}
      <Breadcrumb items={[{ label: bc.settings }, { label: t.title }]} />

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-ink text-xl font-bold">{t.title}</h1>
          <p className="text-mute-light mt-0.5 text-[13px]">{t.subtitle}</p>
        </div>
        <CreateRelationshipDialog />
      </div>

      {rows.length === 0 ? (
        <div className="border-hairline-light rounded-lg border p-12 text-center">
          <p className="text-ink font-medium">{t.empty}</p>
          <p className="text-mute-light mt-2 text-sm">{t.emptyCta}</p>
        </div>
      ) : (
        <div className="border-hairline-light overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">{t.fields.dealerName}</th>
                <th className="px-3 py-2 font-medium">{t.fields.franchiseNo}</th>
                <th className="px-3 py-2 font-medium">{t.fields.status}</th>
                <th className="px-3 py-2 font-medium">{t.fields.defaultScope}</th>
                <th className="px-3 py-2 font-medium">{t.fields.note}</th>
                <th className="px-3 py-2 font-medium">{t.fields.updatedAt}</th>
                <th className="px-3 py-2 font-medium">{t.remove.columnLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <RelationshipRow
                  key={r.id}
                  row={r}
                  action={<DeleteRelationshipButton id={r.id} dealerName={r.dealerName} />}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
