// スタッフの新規登録。フォーム本体は salesperson-form.tsx（作成/編集で共用）。
//
// スタッフ（Salesperson）とシステムユーザー（User）は別物として扱うので、
// この画面から User を紐付けたり、User からスタッフを生成したりはしない。
// 所属取引先の選択肢だけをサーバ側で解決して渡す。

import { ListPageHeader } from "@/components/list/list-shell";
import { Card } from "@/components/ui/card";
import { labels } from "@/lib/i18n/labels";

import { getStaffFormOptions } from "../data";
import { SalespersonForm } from "../salesperson-form";

export const dynamic = "force-dynamic";

export default async function NewSalespersonPage() {
  const t = labels.salespersonList;
  const options = await getStaffFormOptions();

  return (
    <div className="space-y-6">
      <ListPageHeader title={t.newTitle} subtitle={t.subtitle} />
      <Card className="p-5">
        <SalespersonForm
          relationships={options.relationships}
          selfCompanyName={options.selfCompanyName}
        />
      </Card>
    </div>
  );
}
