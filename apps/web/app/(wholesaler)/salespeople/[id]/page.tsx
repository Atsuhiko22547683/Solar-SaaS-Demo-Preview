// スタッフの編集。生値（マスク前）が要るので getSalespersonEditable を使う
// （内部で salesperson.update 権限 + withTenant を要求する）。

import { notFound } from "next/navigation";

import { ListPageHeader } from "@/components/list/list-shell";
import { Card } from "@/components/ui/card";
import { labels } from "@/lib/i18n/labels";

import { getSalespersonEditable, getStaffFormOptions } from "../data";
import { SalespersonForm } from "../salesperson-form";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSalespersonPage({ params }: PageProps) {
  const { id } = await params;
  // 逐次実行にして、1 リクエストで同時に開く DB トランザクションを 1 本に保つ。
  const initial = await getSalespersonEditable(id);
  if (!initial) notFound();
  const options = await getStaffFormOptions();

  const t = labels.salespersonList;
  return (
    <div className="space-y-6">
      <ListPageHeader title={t.editTitle} subtitle={initial.name} />
      <Card className="p-5">
        <SalespersonForm
          initial={initial}
          relationships={options.relationships}
          selfCompanyName={options.selfCompanyName}
        />
      </Card>
    </div>
  );
}
